'use server';

import { Firestore, collectionGroup, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { UserBet } from './types';

// Assumed type for Tank01 Box Score Player Stats
interface Tank01PlayerStats {
    PlayerID: string;
    minutes: string;
    points: number;
    assists: number;
    rebounds: number;
    three_points_made: number;
    steals: number;
    blocks: number;
}

// Assumed type for Tank01 Box Score API response
interface Tank01BoxScoreResponse {
    body: {
        playerStats: Tank01PlayerStats[];
    };
}

// Maps our app's market string to the key in the Tank01 stats object
const marketToStatKey: Record<string, keyof Tank01PlayerStats> = {
    'pts': 'points',
    'reb': 'rebounds',
    'ast': 'assists',
    '3pt': 'three_points_made',
    'stl': 'steals',
    'blk': 'blocks',
};

/**
 * Grades all pending player prop bets for a specific game by fetching the box score.
 * @param firestore The Firestore instance.
 * @param gameId The ID of the game to grade props for.
 * @returns A promise that resolves to a detailed log string of the operation.
 */
export async function gradePlayerProps(firestore: Firestore, gameId: string): Promise<string> {
    let log = `--- Grading Player Props for Game ID: ${gameId} ---\n\n`;

    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiHost = process.env.RAPIDAPI_HOST;

    if (!rapidApiKey || !rapidApiHost) {
        const errorMsg = "API credentials (RAPIDAPI_KEY, RAPIDAPI_HOST) are not configured on the server.";
        console.error(errorMsg);
        log += `ERROR: ${errorMsg}\n`;
        return log;
    }

    // 1. Fetch Box Score from Tank01
    log += "Fetching box score from Tank01 API...\n";
    const url = `https://tank01-fantasy-stats.p.rapidapi.com/getNBAPlayerGameStats?gameID=${gameId}&fantasyPoints=false`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': rapidApiHost,
        }
    };

    let boxScoreResponse: Tank01BoxScoreResponse;
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tank01 API Error ${response.status}: ${errorText}`);
        }
        boxScoreResponse = await response.json();
        log += `Raw API Response (Box Score):\n${JSON.stringify(boxScoreResponse.body, null, 2)}\n\n`;
    } catch (error: any) {
        log += `Failed to fetch box score: ${error.message}\n`;
        return log;
    }

    if (!boxScoreResponse.body?.playerStats) {
        log += "Box score data or playerStats array not found in API response.\n";
        return log;
    }
    
    const playerStatsMap = new Map<string, Tank01PlayerStats>(
        boxScoreResponse.body.playerStats.map(p => [p.PlayerID.toString(), p])
    );
    log += `Successfully created stats map for ${playerStatsMap.size} players.\n\n`;

    // 2. Query Firestore for pending props for this game
    log += "Querying Firestore for pending player prop bets...\n";
    const betsRef = collectionGroup(firestore, 'bets');
    const q = query(betsRef, where('gameId', '==', gameId), where('status', '==', 'pending'), where('betType', '==', 'player_prop'));

    const pendingBetsSnapshot = await getDocs(q);
    if (pendingBetsSnapshot.empty) {
        log += "No pending player prop bets found for this game.\n";
        return log;
    }
    log += `Found ${pendingBetsSnapshot.docs.length} pending bets to grade.\n\n`;

    // 3. Compare and Grade
    const batch = writeBatch(firestore);
    let updatedCount = 0;

    for (const betDoc of pendingBetsSnapshot.docs) {
        const bet = betDoc.data() as UserBet;
        log += `--- Grading Bet ID: ${betDoc.id} (Player ID: ${bet.playerId}) ---\n`;
        log += `Pick: ${bet.pick} ${bet.line} @ ${bet.odds}\n`;
        log += `Market: ${bet.market}\n`;

        const playerStats = playerStatsMap.get(bet.playerId!);
        
        // DNP (Did Not Play) Check - marked as "Void" (push)
        if (!playerStats || !playerStats.minutes || playerStats.minutes === "0" || playerStats.minutes.startsWith("0:")) {
            log += "Player DNP (Did Not Play) or has no stats. Marking as 'Void' (push).\n";
            batch.update(betDoc.ref, { status: 'push' });
            updatedCount++;
            log += `  - Bet Result: PUSH\n\n`;
            continue;
        }

        let actualStat: number | undefined;
        const market = bet.market!;
        
        // Handle combo props
        if (market === 'pts+reb+ast') {
            actualStat = (playerStats.points || 0) + (playerStats.rebounds || 0) + (playerStats.assists || 0);
        } else if (market === 'blk+stl') {
            actualStat = (playerStats.blocks || 0) + (playerStats.steals || 0);
        } else {
            const statKey = marketToStatKey[market];
            if (statKey) {
                actualStat = playerStats[statKey] as number;
            }
        }
        
        log += `Actual Stat Value from API: ${actualStat}\n`;
        
        if (actualStat === undefined) {
            log += `ERROR: Could not determine actual stat for market '${market}'. Skipping bet.\n\n`;
            continue;
        }

        const line = bet.line!;
        let result: 'won' | 'lost' | 'push';

        if (actualStat === line) {
            result = 'push';
        } else if (bet.pick.toLowerCase().startsWith('over')) {
            result = actualStat > line ? 'won' : 'lost';
        } else if (bet.pick.toLowerCase().startsWith('under')) {
            result = actualStat < line ? 'won' : 'lost';
        } else {
             log += `ERROR: Could not determine Over/Under from pick '${bet.pick}'. Skipping bet.\n\n`;
             continue;
        }
        
        log += `Comparison: Actual (${actualStat}) vs Line (${line})\n`;
        log += `  - Bet Result: ${result.toUpperCase()}\n\n`;

        batch.update(betDoc.ref, { status: result });
        updatedCount++;
    }

    if (updatedCount > 0) {
        try {
            await batch.commit();
            log += `Successfully committed updates for ${updatedCount} bets to Firestore.\n`;
        } catch (error: any) {
            log += `ERROR: Failed to commit batch to Firestore: ${error.message}\n`;
        }
    } else {
        log += "No bets were updated in this run.\n";
    }

    return log;
}
