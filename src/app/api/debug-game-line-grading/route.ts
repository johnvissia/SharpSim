
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { UserBet, CompletedGame, ParlayLeg } from '@/lib/types';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    } catch (e) {
        console.error('Firebase admin initialization error', e);
    }
}
const db = admin.firestore();

// Helpers from bet-grading.ts
const normalizeName = (name: string): string => {
    if (!name) return '';
    return name.toLowerCase().replace(/[\s.&()']/g, '');
};
const extractNumber = (str: string | undefined): number | null => {
    if (!str) return null;
    const match = str.match(/[-+]?\d*\.?\d+/g);
    if (!match) return null;
    return parseFloat(match[match.length - 1]);
};


export async function GET(request: Request) {
    let log = `--- Starting Game Line Grading Debug ---\n\n`;

    try {
        // 1. Find one pending bet that is a game line (moneyline, spread, total, or parlay)
        const betsCollection = db.collectionGroup('bets');
        const q = await betsCollection
            .where('status', '==', 'pending')
            .where('betType', 'in', ['moneyline', 'spread', 'total', 'parlay'])
            .limit(1)
            .get();

        if (q.empty) {
            log += "No pending game line bets found to test.\n";
            return NextResponse.json({ log });
        }

        const betDoc = q.docs[0];
        const bet = betDoc.data() as UserBet;
        const betId = betDoc.id;
        const userId = betDoc.ref.parent.parent!.id;

        log += `Found pending bet to debug.\n`;
        log += `User ID: ${userId}\n`;
        log += `Bet ID: ${betId}\n`;
        log += `Bet Details:\n${JSON.stringify(bet, null, 2)}\n\n`;

        // 2. Simulate grading for this bet
        const legsToProcess: Partial<ParlayLeg>[] = bet.legs ? bet.legs : [{
            gameId: bet.gameId,
            pick: bet.pick,
            betType: bet.betType,
            status: bet.status,
            sport: bet.sport,
            matchup: bet.matchup,
        }];

        let finalVerdict = 'Undetermined';
        let isBetFinalized = true;
        const legVerdicts: string[] = [];

        for (const leg of legsToProcess) {
             if (!leg.gameId || !leg.pick || !leg.betType) {
                log += `--- Invalid leg found in bet. Skipping. ---\n\n`;
                continue;
            }
            if (leg.status !== 'pending') {
                log += `--- Leg for "${leg.pick}" is already settled with status: ${leg.status}. Skipping. ---\n\n`;
                continue;
            }

            log += `--- Processing Leg: "${leg.pick}" on Game ID: ${leg.gameId} ---\n`;
            
            const gameRef = db.collection('completed_games').doc(leg.gameId);
            const gameDoc = await gameRef.get();

            if (!gameDoc.exists) {
                log += `Game check: [NOT FOUND]\n`;
                log += `  - No document found in 'completed_games' with ID: ${leg.gameId}\n\n`;
                isBetFinalized = false;
                legVerdicts.push('pending');
                continue;
            }

            log += `Game check: [FOUND]\n`;
            const game = gameDoc.data() as CompletedGame;
            log += `Completed game data:\n${JSON.stringify(game, null, 2)}\n\n`;

            const isGameCompleted = game.completed === true;
            log += `Is game completed? [${isGameCompleted ? 'YES' : 'NO'}] (Value: ${game.completed})\n`;

            if (!isGameCompleted) {
                log += `  - Game is not final. Grading cannot proceed for this leg.\n\n`;
                isBetFinalized = false;
                legVerdicts.push('pending');
                continue;
            }

            let legResult: 'won' | 'lost' | 'push' = 'push';
            
            switch(leg.betType) {
                case 'moneyline': {
                    log += `Grading as Moneyline...\n`;
                    const winner = game.homeScore > game.awayScore ? game.homeTeam : game.awayScore > game.homeScore ? game.awayTeam : null;
                    if (!winner) {
                        legResult = 'push';
                        log += `  - Outcome: Game was a tie. Result is a PUSH.\n`;
                    } else {
                        const isWinner = normalizeName(winner) === normalizeName(leg.pick);
                        legResult = isWinner ? 'won' : 'lost';
                        log += `  - Winner was ${winner}. Bet was on ${leg.pick}.\n`;
                        log += `  - Match? ${isWinner ? 'YES' : 'NO'}. Result is ${legResult.toUpperCase()}.\n`;
                    }
                    break;
                }
                case 'spread': {
                    log += `Grading as Spread...\n`;
                    const lastSpaceIndex = leg.pick.lastIndexOf(' ');
                    if (lastSpaceIndex === -1) { log += '  - ERROR: Invalid spread format.\n'; break; }
                    const teamName = leg.pick.substring(0, lastSpaceIndex).trim();
                    const line = parseFloat(leg.pick.substring(lastSpaceIndex + 1));
                    if (isNaN(line)) { log += '  - ERROR: Could not parse spread line.\n'; break; }

                    const isHomePick = normalizeName(game.homeTeam) === normalizeName(teamName);
                    const margin = isHomePick ? (game.homeScore - game.awayScore) : (game.awayScore - game.homeScore);
                    const finalMargin = margin + line;
                    
                    log += `  - Pick: ${teamName} ${line > 0 ? '+' : ''}${line}\n`;
                    log += `  - Actual Score: ${game.awayTeam} ${game.awayScore} @ ${game.homeTeam} ${game.homeScore}\n`;
                    log += `  - Effective margin for bet: ${margin}. With spread: ${finalMargin}.\n`;
                    
                    if (finalMargin > 0) legResult = 'won';
                    else if (finalMargin < 0) legResult = 'lost';
                    else legResult = 'push';
                    log += `  - Result is ${legResult.toUpperCase()}.\n`;
                    break;
                }
                case 'total': {
                    log += `Grading as Total...\n`;
                    const line = extractNumber(leg.pick);
                    if (line === null) { log += '  - ERROR: Could not parse total line.\n'; break; }
                    
                    const correctedTotalScore = game.homeScore + game.awayScore;
                    log += `  - Line: ${line}. Actual Total: ${correctedTotalScore}\n`;

                    if (correctedTotalScore === line) legResult = 'push';
                    else if (leg.pick.toLowerCase().includes('over')) legResult = correctedTotalScore > line ? 'won' : 'lost';
                    else legResult = correctedTotalScore < line ? 'won' : 'lost';
                    log += `  - Result is ${legResult.toUpperCase()}.\n`;
                    break;
                }
                default:
                    log += `  - Bet type '${leg.betType}' not supported by this debug tool.\n`;
                    isBetFinalized = false;
            }
            legVerdicts.push(legResult);
            log += '\n';
        }

        if(isBetFinalized) {
            if (bet.betType === 'parlay') {
                if (legVerdicts.includes('lost')) finalVerdict = 'LOST';
                else if (legVerdicts.every(v => v === 'push')) finalVerdict = 'PUSH';
                else finalVerdict = 'WON';
            } else {
                finalVerdict = legVerdicts[0].toUpperCase();
            }
             log += `--- Final Verdict ---\n`;
             log += `The bet would be graded as: ${finalVerdict}\n`;
        } else {
             log += `--- Final Verdict ---\n`;
             log += `Bet cannot be finalized yet as one or more legs are still pending or could not be graded.\n`;
        }

        return NextResponse.json({ log, betDetails: bet, finalVerdict });

    } catch (error: any) {
        console.error("[DEBUG GAME LINE GRADING] An error occurred:", error);
        log += `\n\n---!! UNEXPECTED ERROR !!---\n${error.message}\n${error.stack}`;
        return NextResponse.json({ log }, { status: 500 });
    }
}
