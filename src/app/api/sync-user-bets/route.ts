import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { fetchEspnSchedule } from '@/lib/espn';
import { gradeUserBets } from '@/lib/bet-grading';
import type { CompletedGame, UserBet } from '@/lib/types';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    return handleSyncUserBets(request);
}

export async function POST(request: NextRequest) {
    return handleSyncUserBets(request);
}

async function handleSyncUserBets(request: NextRequest) {
    try {
        const reqUrl = new URL(request.url);
        const targetUserId = reqUrl.searchParams.get('userId');

        console.log(`[sync-user-bets] Starting user bet grading process${targetUserId ? ` for user ${targetUserId}` : ' for all users'}...`);

        // 1. Fetch completed games from ESPN schedule (covers past 4 days & today)
        const espnGames = await fetchEspnSchedule();
        const completedGamesMap = new Map<string, CompletedGame>();

        for (const game of espnGames) {
            if (game.liveScore && (game.completed || game.statusState === 'post')) {
                completedGamesMap.set(game.id, {
                    id: game.id,
                    sportKey: game.sport,
                    commenceTime: game.startTime,
                    homeTeam: game.homeTeam.name,
                    awayTeam: game.awayTeam.name,
                    homeScore: game.liveScore.home,
                    awayScore: game.liveScore.away,
                    completed: true,
                });
            }
        }

        // 2. Merge completed_games from Firestore (e.g. Odds API completed games)
        try {
            const completedGamesSnapshot = await db.collection('completed_games').get();
            completedGamesSnapshot.forEach(doc => {
                const cg = doc.data() as CompletedGame;
                if (cg.id && cg.homeScore !== undefined && cg.awayScore !== undefined) {
                    // Merge, keeping ESPN or existing data
                    if (!completedGamesMap.has(cg.id)) {
                        completedGamesMap.set(cg.id, cg);
                    }
                }
            });
        } catch (e: any) {
            console.warn('[sync-user-bets] Error reading completed_games collection:', e.message);
        }

        console.log(`[sync-user-bets] Loaded ${completedGamesMap.size} completed games for grading.`);

        // 3. Fetch completed player stats for player props
        const completedPlayerStatsMap = new Map<string, any>();
        try {
            const playerStatsSnapshot = await db.collection('completed_player_stats').get();
            playerStatsSnapshot.forEach(doc => {
                completedPlayerStatsMap.set(doc.id, doc.data());
            });
        } catch (e: any) {
            console.warn('[sync-user-bets] Error reading completed_player_stats collection:', e.message);
        }

        // 4. Query pending bets without expensive collectionGroup queries
        const pendingBets: Array<{ bet: UserBet; userId: string; docRef: FirebaseFirestore.DocumentReference }> = [];

        if (targetUserId) {
            try {
                const betsSnapshot = await db.collection('users')
                    .doc(targetUserId)
                    .collection('bets')
                    .where('status', '==', 'pending')
                    .get();

                betsSnapshot.forEach(doc => {
                    pendingBets.push({
                        bet: { ...doc.data() as UserBet, id: doc.id },
                        userId: targetUserId,
                        docRef: doc.ref,
                    });
                });
            } catch (e: any) {
                console.error(`[sync-user-bets] Error fetching bets for user ${targetUserId}:`, e.message);
            }
        } else {
            try {
                const usersSnapshot = await db.collection('users').get();
                for (const userDoc of usersSnapshot.docs) {
                    try {
                        const betsSnapshot = await db.collection('users')
                            .doc(userDoc.id)
                            .collection('bets')
                            .where('status', '==', 'pending')
                            .get();

                        betsSnapshot.forEach(doc => {
                            pendingBets.push({
                                bet: { ...doc.data() as UserBet, id: doc.id },
                                userId: userDoc.id,
                                docRef: doc.ref,
                            });
                        });
                    } catch (e: any) {
                        console.warn(`[sync-user-bets] Error fetching bets for user ${userDoc.id}:`, e.message);
                    }
                }
            } catch (e: any) {
                console.error('[sync-user-bets] Error fetching users list:', e.message);
            }
        }

        console.log(`[sync-user-bets] Found ${pendingBets.length} pending user bets to evaluate.`);

        if (pendingBets.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No pending bets found to grade.',
                gradedCount: 0,
                totalPayout: 0
            });
        }

        // 5. Grade pending bets
        const betsToGrade = pendingBets.map(pb => pb.bet);
        const { updates, totalPayout } = gradeUserBets(betsToGrade, completedGamesMap, completedPlayerStatsMap);

        const gradedDetails: any[] = [];
        let totalPayoutApplied = 0;

        // 6. Apply updates to Firestore
        for (const update of updates) {
            const matchItem = pendingBets.find(pb => pb.bet.id === update.betId);
            if (!matchItem) continue;

            const { bet, userId, docRef } = matchItem;
            const newStatus = update.payload.status;

            console.log(`[sync-user-bets] Updating bet ${bet.id} for user ${userId} -> status: ${newStatus}`);

            await docRef.update({
                ...update.payload,
                gradedAt: new Date().toISOString(),
            });

            let payoutForThisBet = 0;
            if (newStatus === 'won') {
                payoutForThisBet = bet.potentialWinnings || 0;
            } else if (newStatus === 'push') {
                payoutForThisBet = bet.stake || 0;
            }

            if (payoutForThisBet > 0) {
                try {
                    await db.collection('users').doc(userId).update({
                        balance: admin.firestore.FieldValue.increment(payoutForThisBet)
                    });
                    totalPayoutApplied += payoutForThisBet;
                    console.log(`[sync-user-bets] Credited +${payoutForThisBet} coins to user ${userId}`);
                } catch (e: any) {
                    console.error(`[sync-user-bets] Failed to update balance for user ${userId}:`, e.message);
                }
            }

            gradedDetails.push({
                betId: bet.id,
                userId,
                pick: bet.pick,
                matchup: bet.matchup,
                oldStatus: bet.status,
                newStatus,
                payout: payoutForThisBet
            });
        }

        return NextResponse.json({
            success: true,
            gradedCount: updates.length,
            totalPayout: totalPayoutApplied,
            details: gradedDetails
        });

    } catch (error: any) {
        console.error('[sync-user-bets] Error during user bets sync:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
