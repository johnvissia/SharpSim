import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { fetchEspnSchedule } from '@/lib/espn';
import { normalizeTeamName } from '@/lib/team-names';
import { DailyGame } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    // Auth check (if CRON_SECRET is configured)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

        // Cleanup check: Re-open predictions that were mistakenly graded as 0-0 for non-soccer sports
        const SOCCER_SPORTS = ['EPL', 'MLS', 'UCL', 'LIGA MX'];
        const mistakenZeroZeroSnapshot = await db.collection('model_predictions')
            .where('status', '==', 'graded')
            .get();

        for (const doc of mistakenZeroZeroSnapshot.docs) {
            const data = doc.data();
            const sportUpper = (data.sport || '').toUpperCase();
            if (!SOCCER_SPORTS.includes(sportUpper)) {
                if (data.actualScore && data.actualScore.home === 0 && data.actualScore.away === 0) {
                    console.log(`[sync-accuracy] Resetting prematurely graded 0-0 prediction for ${data.awayTeam} @ ${data.homeTeam} back to pending`);
                    await db.collection('model_predictions').doc(doc.id).update({
                        status: 'pending',
                        actualScore: null,
                        actualSpread: null,
                        correct: null,
                        gradedAt: null
                    });
                    activePredictionsSnapshot.docs.push(doc);
                }
            }
        }

        const pendingGameIds = new Set(activePredictionsSnapshot.docs.map(d => d.data().gameId));

        for (const game of allGames) {
            const gameTime = new Date(game.startTime);
            const timeUntilStart = gameTime.getTime() - now.getTime();
            const hName = normalizeTeamName(game.homeTeam.name);
            const aName = normalizeTeamName(game.awayTeam.name);

            // --- SNAPSHOT LOGIC (Lock predictions starting < 15m ago or soon) ---
            // Only snapshot games that are about to start or recently started (prevent running predictions on 4 days of history)
            const isRelevantForSnapshot = timeUntilStart <= 15 * 60 * 1000 && timeUntilStart > -2 * 60 * 60 * 1000;
            
            if (isRelevantForSnapshot && !pendingGameIds.has(game.id)) {
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

                    // --- Find the Vegas spread from Odds API bookmakers ---
                    let spreadPoints = 0;
                    let spreadSource = 'none';
                    
                    if (dg?.bookmakerOdds) {
                        for (const bkStr of dg.bookmakerOdds) {
                            try {
                                const bookmaker = JSON.parse(bkStr);
                                const sm = bookmaker.markets.find((m: any) => m.key === 'spreads');
                                if (sm) {
                                    const outcome = sm.outcomes.find((o: any) => normalizeTeamName(o.name) === hName);
                                    if (outcome && outcome.point !== undefined) {
                                        if (outcome.point !== 0 || spreadPoints === 0) {
                                            spreadPoints = outcome.point;
                                            spreadSource = bookmaker.title || 'Odds API';
                                            if (spreadPoints !== 0) break;
                                        }
                                    }
                                }
                            } catch (e) { }
                        }
                    }

                    // --- Skip games with no spread source (can't grade without a line) ---
                    if (spreadSource === 'none' && spreadPoints === 0) {
                        if (game.sport === 'MLB') {
                            spreadSource = 'Default Line';
                        } else {
                            console.log(`[sync-accuracy] SKIP ${aName} @ ${hName} — no spread found in daily_games`);
                            continue;
                        }
                    }

                    console.log(`[sync-accuracy] Snapshotting ${game.sport} game: ${aName} @ ${hName} | Line: ${spreadPoints} (${spreadSource})`);

                    let endpoint = '/api/predict-game';
                    if (game.sport === 'NCAAM') endpoint = '/api/predict-ncaam';
                    if (game.sport === 'MLB') endpoint = '/api/predict-mlb';

                    try {
                        const predRes = await fetch(`${baseUrl}${endpoint}?home=${encodeURIComponent(hName)}&away=${encodeURIComponent(aName)}&marketSpread=${spreadPoints}`);
                        const predJson = await predRes.json();

                        if (predRes.ok && predJson.prediction) {
                            const prediction = predJson.prediction;
                            const predData = {
                                gameId: game.id,
                                sport: game.sport,
                                homeTeam: game.homeTeam.name,
                                awayTeam: game.awayTeam.name,
                                startTime: game.startTime,
                                snapshotTime: now.toISOString(),
                                marketSpread: spreadPoints,
                                spreadSource: spreadSource,
                                projectedSpread: prediction.projectedSpread,
                                zScore: prediction.zScore,
                                betSignal: prediction.betSignal,
                                recommendedSide: prediction.recommendedSide,
                                status: 'pending',
                                actualScore: null,
                                correct: null
                            };
                            
                            await db.collection('model_predictions').doc(game.id).set(predData);
                            results.snapshots.push(`${game.sport}: ${aName} @ ${hName} (Line: ${spreadPoints})`);
                            
                            // Make it available for immediate grading if game is already over
                            pendingGameIds.add(game.id);
                            const newDoc = {
                                data: () => ({ ...predData, gameId: game.id })
                            } as any;
                            activePredictionsSnapshot.docs.push(newDoc);
                        }
                    } catch (e: any) {
                        results.errors.push(`Prediction failed for ${game.id}: ${e.message}`);
                    }
                }
            }

            // --- GRADING LOGIC ---
            const isGameCompleted = game.completed === true || (game.statusState === 'post' && game.statusDetail?.toLowerCase().includes('final'));
            
            if (isGameCompleted && pendingGameIds.has(game.id)) {
                const predDoc = activePredictionsSnapshot.docs.find(d => d.data().gameId === game.id);
                if (predDoc) {
                    const data = predDoc.data();
                    const homeScore = game.liveScore?.home;
                    const awayScore = game.liveScore?.away;

                    // Require valid numeric scores
                    if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || isNaN(homeScore) || isNaN(awayScore)) {
                        console.log(`[sync-accuracy] SKIP GRADING ${aName} @ ${hName} — invalid scores: home=${homeScore}, away=${awayScore}`);
                        continue;
                    }

                    // For non-soccer sports, a 0-0 score indicates incomplete data from ESPN
                    const isSoccer = SOCCER_SPORTS.includes((game.sport || '').toUpperCase());
                    if (!isSoccer && homeScore === 0 && awayScore === 0) {
                        console.log(`[sync-accuracy] SKIP GRADING ${game.sport} game: ${aName} @ ${hName} — score is 0-0 (waiting for ESPN final score)`);
                        continue;
                    }

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
                    results.graded.push(`${game.sport}: ${aName} ${awayScore} - ${homeScore} ${hName} (${correct ? 'HIT' : 'MISS'})`);
                }
            }
        }

        return NextResponse.json(results);

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
