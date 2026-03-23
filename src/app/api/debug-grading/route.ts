
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import type { UserBet } from '@/lib/types';

// Helper types for API responses
interface Tank01PlayerStats {
    PlayerID: string;
    PlayerName: string;
    minutes?: string;
    points?: number;
    assists?: number;
    rebounds?: number;
    three_points_made?: number;
    steals?: number;
    blocks?: number;
}

interface Tank01BoxScoreResponse {
    body?: {
        gameStatus?: string;
        playerStats?: Tank01PlayerStats[];
    };
    message?: string;
}

const marketToStatKey: Record<string, (keyof Omit<Tank01PlayerStats, 'PlayerID' | 'PlayerName' | 'minutes'>)[]> = {
    'pts': ['points'],
    'reb': ['rebounds'],
    'ast': ['assists'],
    '3pt': ['three_points_made'],
    'stl': ['steals'],
    'blk': ['blocks'],
    'blk+stl': ['blocks', 'steals'],
    'pts+reb+ast': ['points', 'rebounds', 'assists'],
};

export async function GET(request: Request) {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiHost = process.env.RAPIDAPI_HOST;

    if (!rapidApiKey || !rapidApiHost) {
        return NextResponse.json({ message: "API credentials are not configured on the server." }, { status: 500 });
    }

    try {
        // 1. Query Firestore for one pending player prop bet
        const betsCollection = db.collectionGroup('bets');
        const q = await betsCollection.where('betType', '==', 'player_prop').where('status', '==', 'pending').limit(1).get();

        if (q.empty) {
            return NextResponse.json({ message: "No pending player prop bets found to test." });
        }

        const betDoc = q.docs[0];
        const bet = betDoc.data() as UserBet;

        const { gameId, playerId, playerName, market, line, pick } = bet;

        if (!gameId || !playerId || !market || line === undefined || !pick) {
            return NextResponse.json({ message: `Found pending bet ${betDoc.id}, but it is missing required fields (gameId, playerId, market, line, pick).` }, { status: 400 });
        }

        const betDetails = {
            DocID: betDoc.id,
            Player: playerName || 'Unknown',
            Market: market,
            Line: line,
            Pick: pick
        };

        // 2. Fetch Box Score from Tank01
        const url = `https://tank01-fantasy-stats.p.rapidapi.com/getNBAPlayerGameStats?gameID=${gameId}&fantasyPoints=false`;
        const options = {
            method: 'GET',
            headers: { 'X-RapidAPI-Key': rapidApiKey, 'X-RapidAPI-Host': rapidApiHost }
        };

        const apiResponse = await fetch(url, options);
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`Tank01 API Error ${apiResponse.status}: ${errorText}`);
        }

        const boxScoreData: Tank01BoxScoreResponse = await apiResponse.json();

        if (boxScoreData.message || !boxScoreData.body?.playerStats) {
            return NextResponse.json({
                message: "Could not retrieve valid box score data from Tank01.",
                apiResponse: boxScoreData
            });
        }

        const gameStatus = boxScoreData.body.gameStatus || 'Unknown';
        const playerStats = boxScoreData.body.playerStats.find(p => p.PlayerID.toString() === playerId.toString());

        // 3. Construct verdict
        let verdict = "Could not determine verdict.";

        if (!playerStats) {
            verdict = `Player with ID ${playerId} not found in the box score.`;
        } else if (!gameStatus.toLowerCase().includes('final')) {
            verdict = `Game status is '${gameStatus}'. Grading can only happen on 'Final' games.`;
        } else if (!playerStats.minutes || playerStats.minutes === '0' || playerStats.minutes.startsWith("0:")) {
            verdict = `Player had 0 minutes (DNP). Would mark as PUSH.`;
        } else {
            const statKeys = marketToStatKey[market];
            if (!statKeys) {
                verdict = `Market '${market}' is not recognized by the grading logic.`;
            } else {
                const actualStat = statKeys.reduce((sum, key) => {
                    const statValue = playerStats[key];
                    return sum + (typeof statValue === 'number' ? statValue : 0);
                }, 0);

                if (actualStat === line) {
                    verdict = `PUSH: Actual stat (${actualStat}) equals line (${line}). Would mark as PUSH.`;
                } else if (pick.toLowerCase().includes('over')) {
                    if (actualStat > line) {
                        verdict = `WON: Actual stat (${actualStat}) is greater than line (${line}). Would mark as WON.`;
                    } else {
                        verdict = `LOST: Actual stat (${actualStat}) is not greater than line (${line}). Would mark as LOST.`;
                    }
                } else if (pick.toLowerCase().includes('under')) {
                    if (actualStat < line) {
                        verdict = `WON: Actual stat (${actualStat}) is less than line (${line}). Would mark as WON.`;
                    } else {
                        verdict = `LOST: Actual stat (${actualStat}) is not less than line (${line}). Would mark as LOST.`;
                    }
                } else {
                    verdict = `Could not determine Over/Under from pick: "${pick}".`;
                }
            }
        }

        return NextResponse.json({
            betDetails,
            gameStatus,
            playerStats: playerStats || `Player with ID ${playerId} not found.`,
            verdict,
            rawBoxScore: boxScoreData,
        });


    } catch (error) {
        console.error("[DEBUG GRADING] An error occurred:", error);
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message, stack: error.stack }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown error occurred' }, { status: 500 });
    }
}
