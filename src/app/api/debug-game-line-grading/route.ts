import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import type { UserBet, CompletedGame, ParlayLeg } from '@/lib/types';

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
    let log = `=== GAME LINE GRADING DEBUG REPORT ===\n`;
    log += `Generated: ${new Date().toISOString()}\n\n`;

    try {
        // 1. Get statistics about completed_games collection
        log += `--- STEP 1: Checking completed_games collection ---\n`;
        const completedGamesSnapshot = await db.collection('completed_games').get();
        log += `Total games in completed_games: ${completedGamesSnapshot.size}\n`;

        const completedGamesMap = new Map<string, CompletedGame>();
        const sampleGameIds: string[] = [];

        completedGamesSnapshot.forEach(doc => {
            const game = doc.data() as CompletedGame;
            completedGamesMap.set(doc.id, game);
            if (sampleGameIds.length < 5) {
                sampleGameIds.push(doc.id);
            }
        });

        log += `Sample game IDs in completed_games:\n`;
        sampleGameIds.forEach(id => log += `  - ${id}\n`);
        log += `\n`;

        // 2. Find ALL pending bets (not just one)
        log += `--- STEP 2: Finding pending bets ---\n`;

        const usersSnapshot = await db.collection('users').get();
        const allPendingBets: Array<{ bet: UserBet; userId: string; betId: string }> = [];

        for (const userDoc of usersSnapshot.docs) {
            const betsSnapshot = await db.collection('users').doc(userDoc.id).collection('bets')
                .where('status', '==', 'pending')
                .get();

            betsSnapshot.forEach(betDoc => {
                allPendingBets.push({
                    bet: betDoc.data() as UserBet,
                    userId: userDoc.id,
                    betId: betDoc.id
                });
            });
        }

        log += `Total pending bets found: ${allPendingBets.length}\n\n`;

        if (allPendingBets.length === 0) {
            log += "No pending bets to analyze.\n";
            return NextResponse.json({ log, summary: "No pending bets" });
        }

        // 3. Analyze ID matching
        log += `--- STEP 3: Analyzing ID matches ---\n`;
        let matchedCount = 0;
        let unmatchedCount = 0;
        const unmatchedExamples: string[] = [];

        for (const { bet, userId, betId } of allPendingBets) {
            const legsToCheck: Partial<ParlayLeg>[] = bet.legs ? bet.legs : [{
                gameId: bet.gameId,
                pick: bet.pick,
                betType: bet.betType as any, // Cast to avoid 'parlay' mismatch
                playerId: bet.playerId,
                market: bet.market,
                line: bet.line,
            }];

            for (const leg of legsToCheck) {
                if (!leg.gameId) continue;

                if (completedGamesMap.has(leg.gameId)) {
                    matchedCount++;
                } else {
                    unmatchedCount++;
                    if (unmatchedExamples.length < 10) {
                        unmatchedExamples.push(`  GameID: ${leg.gameId} | Pick: ${leg.pick}`);
                    }
                }
            }
        }

        log += `Matched game IDs: ${matchedCount}\n`;
        log += `Unmatched game IDs: ${unmatchedCount}\n\n`;

        if (unmatchedExamples.length > 0) {
            log += `Examples of unmatched game IDs:\n`;
            unmatchedExamples.forEach(ex => log += `${ex}\n`);
            log += `\n`;
        }

        // 4. Detailed analysis of first unmatched bet
        log += `--- STEP 4: Detailed analysis of first pending bet ---\n`;
        const firstBet = allPendingBets[0];
        log += `User ID: ${firstBet.userId}\n`;
        log += `Bet ID: ${firstBet.betId}\n`;
        log += `Bet Type: ${firstBet.bet.betType}\n`;
        log += `Status: ${firstBet.bet.status}\n`;
        log += `Placed At: ${firstBet.bet.placedAt}\n`;
        log += `\nBet Details:\n${JSON.stringify(firstBet.bet, null, 2)}\n\n`;

        const legsToProcess: Partial<ParlayLeg>[] = firstBet.bet.legs ? firstBet.bet.legs : [{
            gameId: firstBet.bet.gameId,
            pick: firstBet.bet.pick,
            betType: firstBet.bet.betType as any,
            status: firstBet.bet.status as any,
            matchup: firstBet.bet.matchup,
            playerId: firstBet.bet.playerId,
            market: firstBet.bet.market,
            line: firstBet.bet.line,
        }];

        for (const [index, leg] of legsToProcess.entries()) {
            log += `\n--- Analyzing Leg ${index + 1} ---\n`;
            log += `Pick: ${leg.pick}\n`;
            log += `Game ID: ${leg.gameId}\n`;
            log += `Bet Type: ${leg.betType}\n`;

            if (!leg.gameId) {
                log += `ERROR: No game ID in leg!\n`;
                continue;
            }

            const game = completedGamesMap.get(leg.gameId);

            if (!game) {
                log += `❌ GAME NOT FOUND in completed_games collection\n`;
                log += `This is why the bet cannot be graded!\n`;

                // Try to find similar IDs
                const similarIds = Array.from(completedGamesMap.keys())
                    .filter(id => id.includes(leg.gameId!.substring(0, 10)) || leg.gameId!.includes(id.substring(0, 10)))
                    .slice(0, 3);

                if (similarIds.length > 0) {
                    log += `\nPossible similar game IDs found:\n`;
                    similarIds.forEach(id => {
                        const g = completedGamesMap.get(id)!;
                        log += `  ${id}: ${g.awayTeam} @ ${g.homeTeam}\n`;
                    });
                }
                continue;
            }

            log += `✓ GAME FOUND in completed_games\n`;
            log += `Matchup: ${game.awayTeam} @ ${game.homeTeam}\n`;
            log += `Score: ${game.awayScore} - ${game.homeScore}\n`;
            log += `Completed: ${game.completed}\n`;
            log += `Commence Time: ${game.commenceTime}\n`;

            if (!game.completed) {
                log += `⚠️  Game has scores but completed flag is FALSE\n`;
                log += `This game needs completed=true to be graded\n`;
            } else {
                log += `✓ Game is marked as completed and can be graded\n`;
            }
        }

        log += `\n\n=== SUMMARY ===\n`;
        log += `Total pending bets: ${allPendingBets.length}\n`;
        log += `Games in completed_games: ${completedGamesSnapshot.size}\n`;
        log += `Matched game IDs: ${matchedCount}\n`;
        log += `Unmatched game IDs: ${unmatchedCount}\n`;

        if (unmatchedCount > 0) {
            log += `\n⚠️  ISSUE DETECTED: ${unmatchedCount} bets have game IDs not found in completed_games\n`;
            log += `ACTION REQUIRED: Run the game sync to fetch latest scores\n`;
        }

        return NextResponse.json({
            log,
            summary: {
                pendingBets: allPendingBets.length,
                completedGames: completedGamesSnapshot.size,
                matched: matchedCount,
                unmatched: unmatchedCount
            }
        });

    } catch (error: any) {
        console.error("[DEBUG] Error:", error);
        log += `\n\n=== ERROR ===\n${error.message}\n${error.stack}`;
        return NextResponse.json({ log, error: error.message }, { status: 500 });
    }
}