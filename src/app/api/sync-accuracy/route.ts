import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { fetchEspnSchedule } from '@/lib/espn';
import { normalizeTeamName } from '@/lib/team-names';
import { DailyGame } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    // Derive base URL from the incoming request so we work on any port
    const reqUrl = new URL(request.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;

    try {
        const now = new Date();
        const results: any = {
            snapshots: [],
            graded: [],
            errors: []
        };

        // 1. Fetch Schedule and Odds
        const allGames = await fetchEspnSchedule();
        const dailySnapshot = await db.collection('daily_games').get();
        const dailyGames = dailySnapshot.docs.map(d => d.data() as DailyGame);

        // 2. Load Existing Predictions (to avoid duplicates)
        const activePredictionsSnapshot = await db.collection('model_predictions')
            .where('status', '==', 'pending')
            .get();
        const pendingGameIds = new Set(activePredictionsSnapshot.docs.map(d => d.data().gameId));

        for (const game of allGames) {
            const gameTime = new Date(game.startTime);
            const timeUntilStart = gameTime.getTime() - now.getTime();
            const fifteenMinutes = 15 * 60 * 1000;
            const hName = normalizeTeamName(game.homeTeam.name);
            const aName = normalizeTeamName(game.awayTeam.name);

            // --- SNAPSHOT LOGIC (Lock predictions starting < 15m ago or soon) ---
            // If game starts in <= 15 mins OR started in last 10 mins (catch-up), and no snapshot exists:
            if (((timeUntilStart <= 15 * 60 * 1000 && timeUntilStart > 0) || (timeUntilStart <= 0 && timeUntilStart > -10 * 60 * 1000)) && !pendingGameIds.has(game.id)) {
                // Check if already snapshotted
                const existing = await db.collection('model_predictions')
                    .where('gameId', '==', game.id)
                    .limit(1)
                    .get();

                if (existing.empty) {
                    const dg = dailyGames.find(d =>
                        normalizeTeamName(d.homeTeam) === hName &&
                        normalizeTeamName(d.awayTeam) === aName
                    );

                    let spreadPoints = 0;
                    if (dg?.bookmakerOdds?.[0]) {
                        try {
                            const bookmaker = JSON.parse(dg.bookmakerOdds[0]);
                            const sm = bookmaker.markets.find((m: any) => m.key === 'spreads');
                            spreadPoints = sm?.outcomes.find((o: any) => normalizeTeamName(o.name) === hName)?.point || 0;
                        } catch (e) { }
                    }

                    const endpoint = game.sport === 'NBA' ? '/api/predict-game' : '/api/predict-ncaam';

                    try {
                        const predRes = await fetch(`${baseUrl}${endpoint}?home=${hName}&away=${aName}&marketSpread=${spreadPoints}`);
                        const predJson = await predRes.json();

                        if (predRes.ok) {
                            const prediction = predJson.prediction;
                            await db.collection('model_predictions').doc(game.id).set({
                                gameId: game.id,
                                sport: game.sport,
                                homeTeam: game.homeTeam.name,
                                awayTeam: game.awayTeam.name,
                                startTime: game.startTime,
                                snapshotTime: now.toISOString(),
                                marketSpread: spreadPoints,
                                projectedSpread: prediction.projectedSpread,
                                zScore: prediction.zScore,
                                betSignal: prediction.betSignal,
                                recommendedSide: prediction.recommendedSide,
                                status: 'pending',
                                actualScore: null,
                                correct: null
                            });
                            results.snapshots.push(`${aName} @ ${hName}`);
                        }
                    } catch (e: any) {
                        results.errors.push(`Prediction failed for ${game.id}: ${e.message}`);
                    }
                }
            }

            // --- GRADING LOGIC ---
            if (game.statusState === 'post' && pendingGameIds.has(game.id)) {
                const predDoc = activePredictionsSnapshot.docs.find(d => d.data().gameId === game.id);
                if (predDoc) {
                    const data = predDoc.data();
                    const homeScore = game.liveScore?.home || 0;
                    const awayScore = game.liveScore?.away || 0;
                    const actualSpread = awayScore - homeScore;

                    let correct = false;
                    const recommendedSide = data.recommendedSide;
                    const marketSpread = data.marketSpread;

                    if (recommendedSide === data.homeTeam) {
                        if (actualSpread < marketSpread) correct = true;
                    } else if (recommendedSide === data.awayTeam) {
                        if (actualSpread > marketSpread) correct = true;
                    }

                    await db.collection('model_predictions').doc(game.id).update({
                        status: 'graded',
                        actualScore: { home: homeScore, away: awayScore },
                        actualSpread: actualSpread,
                        correct: correct,
                        gradedAt: now.toISOString()
                    });
                    results.graded.push(`${aName} ${awayScore} - ${homeScore} ${hName} (${correct ? 'HIT' : 'MISS'})`);
                }
            }
        }

        return NextResponse.json(results);

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
