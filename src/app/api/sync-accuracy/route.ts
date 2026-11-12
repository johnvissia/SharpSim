import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { fetchEspnSchedule } from '@/lib/espn';
import { normalizeTeamName } from '@/lib/team-names';
import { DailyGame } from '@/lib/types';
import {
    resilientGetCollection,
    resilientUpdateDoc,
    resilientSetDoc
} from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function getEspnSportPath(sport: string): string | null {
    const s = (sport || '').toUpperCase().trim();
    switch (s) {
        case 'NBA': return 'basketball/nba';
        case 'NCAAM': return 'basketball/mens-college-basketball';
        case 'MLB': return 'baseball/mlb';
        case 'NFL': return 'football/nfl';
        case 'NHL': return 'hockey/nhl';
        case 'EPL': return 'soccer/eng.1';
        case 'MLS': return 'soccer/usa.1';
        case 'UCL': return 'soccer/uefa.champions';
        default: return null;
    }
}

async function fetchScoreFromEspnSummary(gameId: string, sport: string) {
    const sportPath = getEspnSportPath(sport);
    if (!sportPath || !gameId) return null;
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${encodeURIComponent(gameId)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        const comp = data.header?.competitions?.[0];
        if (!comp) return null;

        const isCompleted = comp.status?.type?.completed === true ||
            (comp.status?.type?.state === 'post' &&
                comp.status?.type?.name !== 'STATUS_POSTPONED' &&
                comp.status?.type?.name !== 'STATUS_CANCELED');
        if (!isCompleted) return null;

        const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
        const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
        if (!home || !away) return null;

        const homeScore = parseInt(home.score, 10);
        const awayScore = parseInt(away.score, 10);
        if (isNaN(homeScore) || isNaN(awayScore)) return null;

        return {
            homeScore,
            awayScore,
            statusDetail: comp.status?.type?.detail || 'Final'
        };
    } catch (e) {
        return null;
    }
}

export async function GET(request: NextRequest) {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authorized) {
        return authResult.errorResponse!;
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

        // 1. Fetch Schedule and Daily Games
        const allGames = await fetchEspnSchedule();
        const dailyGames = await resilientGetCollection<DailyGame>('daily_games', 300);

        // 2. Load Existing Predictions (resilient to Admin SDK auth issues)
        const allPredictions = await resilientGetCollection<any>('model_predictions', 500);

        // Cleanup check: Re-open predictions that were mistakenly graded as 0-0 for non-soccer sports
        const SOCCER_SPORTS = ['EPL', 'MLS', 'UCL'];
        for (const pred of allPredictions) {
            if (pred.status === 'graded') {
                const sportUpper = (pred.sport || '').toUpperCase();
                if (!SOCCER_SPORTS.includes(sportUpper)) {
                    if (pred.actualScore && pred.actualScore.home === 0 && pred.actualScore.away === 0) {
                        console.log(`[sync-accuracy] Resetting prematurely graded 0-0 prediction for ${pred.awayTeam} @ ${pred.homeTeam} back to pending`);
                        await resilientUpdateDoc('model_predictions', pred.id, {
                            status: 'pending',
                            actualScore: null,
                            actualSpread: null,
                            correct: null,
                            gradedAt: null
                        });
                        pred.status = 'pending';
                        pred.actualScore = null;
                    }
                }
            }
        }

        const pendingPredictions = allPredictions.filter(p => p.status === 'pending');
        const knownGameIds = new Set(allPredictions.map(p => p.gameId || p.id));

        // 3. Snapshot Today's Upcoming Games
        for (const game of allGames) {
            const gameTime = new Date(game.startTime);
            const timeUntilStart = gameTime.getTime() - now.getTime();
            const hName = normalizeTeamName(game.homeTeam.name);
            const aName = normalizeTeamName(game.awayTeam.name);

            // Snapshot any game scheduled for today (within the next 24 hours) that has not started yet
            const isRelevantForSnapshot = timeUntilStart <= 24 * 60 * 60 * 1000 && timeUntilStart >= 0 && game.statusState !== 'in' && game.statusState !== 'post';

            // Freeze the prediction 15 minutes before kickoff or if the game is already in progress
            const shouldFreeze = (timeUntilStart <= 15 * 60 * 1000 || game.statusState === 'in') && game.statusState !== 'post';

            if (shouldFreeze) {
                const existingPred = allPredictions.find(p => (p.gameId || p.id) === game.id);
                if (existingPred && !existingPred.isFrozen && existingPred.status === 'pending') {
                    console.log(`[sync-accuracy] Freezing existing prediction for ${game.sport}: ${aName} @ ${hName}`);
                    await resilientUpdateDoc('model_predictions', existingPred.id || game.id, {
                        isFrozen: true,
                        frozenAt: now.toISOString(),
                    });
                    existingPred.isFrozen = true;
                    results.snapshots.push(`Locked: ${game.sport}: ${aName} @ ${hName}`);
                }
            }

            if (isRelevantForSnapshot && !knownGameIds.has(game.id)) {
                const dg = dailyGames.find(d =>
                    normalizeTeamName(d.homeTeam) === hName &&
                    normalizeTeamName(d.awayTeam) === aName
                );

                let spreadPoints = 0;
                let spreadSource = 'none';

                if (dg?.bookmakerOdds) {
                    for (const bkStr of dg.bookmakerOdds) {
                        try {
                            const bookmaker = JSON.parse(bkStr);
                            const sm = bookmaker.markets?.find((m: any) => m.key === 'spreads');
                            if (sm) {
                                const outcome = sm.outcomes?.find((o: any) => normalizeTeamName(o.name) === hName);
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

                if (spreadSource === 'none' && spreadPoints === 0) {
                    if (game.sport === 'MLB') {
                        spreadSource = 'Default Line';
                    } else if (game.sport === 'UCL' || game.sport === 'EPL') {
                        spreadSource = 'Consensus Handicap';
                    } else if (game.sport === 'NBA') {
                        spreadSource = 'Consensus Line';
                    } else {
                        console.log(`[sync-accuracy] SKIP ${aName} @ ${hName} — no spread found in daily_games`);
                        continue;
                    }
                }

                console.log(`[sync-accuracy] Snapshotting ${game.sport} game: ${aName} @ ${hName} | Line: ${spreadPoints} (${spreadSource})`);

                let endpoint = `/api/predict-game?home=${encodeURIComponent(hName)}&away=${encodeURIComponent(aName)}&marketSpread=${spreadPoints}`;
                if (game.sport === 'NCAAM') endpoint = `/api/predict-ncaam?home=${encodeURIComponent(hName)}&away=${encodeURIComponent(aName)}&marketSpread=${spreadPoints}`;
                if (game.sport === 'MLB') endpoint = `/api/predict-mlb?home=${encodeURIComponent(hName)}&away=${encodeURIComponent(aName)}&marketSpread=${spreadPoints}`;
                if (game.sport === 'NFL') endpoint = `/api/predict-nfl?home=${encodeURIComponent(hName)}&away=${encodeURIComponent(aName)}&marketSpread=${spreadPoints}`;
                if (game.sport === 'UCL' || game.sport === 'EPL') {
                    const spreadQuery = spreadPoints !== 0 ? `&marketSpread=${spreadPoints}` : '';
                    endpoint = `/api/predict-soccer?home=${encodeURIComponent(hName)}&away=${encodeURIComponent(aName)}&league=${game.sport}${spreadQuery}`;
                }

                try {
                    const predRes = await fetch(`${baseUrl}${endpoint}`);
                    const predJson = await predRes.json();

                    const prediction = predJson.prediction || (predJson.modelPick ? {
                        projectedSpread: -(predJson.predictedMargin ?? 0),
                        zScore: predJson.zScore ?? 0,
                        betSignal: predJson.betSignal ?? 'No Play',
                        recommendedSide: predJson.modelPick
                    } : null);

                    if (predRes.ok && prediction) {
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
                            isFrozen: true,
                            frozenAt: now.toISOString(),
                            actualScore: null,
                            correct: null
                        };

                        await resilientSetDoc('model_predictions', game.id, predData);
                        results.snapshots.push(`${game.sport}: ${aName} @ ${hName} (Line: ${spreadPoints})`);
                        knownGameIds.add(game.id);
                        pendingPredictions.push({ ...predData, id: game.id });
                    }
                } catch (e: any) {
                    results.errors.push(`Prediction failed for ${game.id}: ${e.message}`);
                }
            }
        }

        // 4. Grade Pending Predictions
        // Matches by:
        // A) Direct gameId / event ID match against allGames
        // B) Team name matching fallback against allGames
        // C) Direct fetch from ESPN summary endpoint by ID (if not in allGames or score not yet populated)
        for (const pred of pendingPredictions) {
            const predId = pred.id || pred.gameId;
            const predGameId = pred.gameId || pred.id;
            const hNorm = normalizeTeamName(pred.homeTeam || '').toLowerCase();
            const aNorm = normalizeTeamName(pred.awayTeam || '').toLowerCase();
            const isSoccer = SOCCER_SPORTS.includes((pred.sport || '').toUpperCase());

            let finalHomeScore: number | null = null;
            let finalAwayScore: number | null = null;
            let isFinal = false;

            // Step A: Check allGames by ID
            let matchedGame = allGames.find(g => g.id === predGameId || g.id === predId);

            // Step B: Check allGames by normalized team names
            if (!matchedGame) {
                matchedGame = allGames.find(g => {
                    const ghNorm = normalizeTeamName(g.homeTeam?.name || '').toLowerCase();
                    const gaNorm = normalizeTeamName(g.awayTeam?.name || '').toLowerCase();
                    return ghNorm === hNorm && gaNorm === aNorm;
                });
            }

            if (matchedGame) {
                const isCompleted = matchedGame.completed === true ||
                    (matchedGame.statusState === 'post' && (
                        matchedGame.statusDetail?.toLowerCase().includes('final') ||
                        matchedGame.statusDetail?.toLowerCase().includes('ft') ||
                        isSoccer
                    ));

                if (isCompleted) {
                    const hs = matchedGame.liveScore?.home;
                    const as = matchedGame.liveScore?.away;
                    if (typeof hs === 'number' && typeof as === 'number' && !isNaN(hs) && !isNaN(as)) {
                        if (isSoccer || !(hs === 0 && as === 0)) {
                            finalHomeScore = hs;
                            finalAwayScore = as;
                            isFinal = true;
                        }
                    }
                }
            }

            // Step C: Fallback to direct ESPN summary fetch (for games outside the schedule window or not yet resolved in allGames)
            if (!isFinal && predGameId) {
                const gameStartTime = pred.startTime ? new Date(pred.startTime).getTime() : 0;
                // If game was scheduled in the past or now
                if (!gameStartTime || gameStartTime <= now.getTime()) {
                    const espnSummary = await fetchScoreFromEspnSummary(predGameId, pred.sport);
                    if (espnSummary) {
                        const { homeScore, awayScore } = espnSummary;
                        if (isSoccer || !(homeScore === 0 && awayScore === 0)) {
                            finalHomeScore = homeScore;
                            finalAwayScore = awayScore;
                            isFinal = true;
                        }
                    }
                }
            }

            // Grade if completed
            if (isFinal && finalHomeScore !== null && finalAwayScore !== null) {
                const actualSpread = finalAwayScore - finalHomeScore;
                const marketSpread = Number(pred.marketSpread ?? 0);
                const projectedSpread = Number(pred.projectedSpread ?? 0);
                const sportUpper = (pred.sport || '').toUpperCase();
                const isSoccerSport = SOCCER_SPORTS.includes(sportUpper);
                const isMlb = sportUpper === 'MLB';
                const isBasketballOrFootball = sportUpper === 'NBA' || sportUpper === 'NCAAM' || sportUpper === 'NFL';

                const edge = marketSpread - projectedSpread;
                const absEdge = Math.abs(edge);

                // Determine if this game has an actionable edge
                let isActionableEdge = false;
                if (isSoccerSport) isActionableEdge = absEdge >= 0.35;
                else if (isMlb) isActionableEdge = absEdge >= 0.40;
                else if (isBasketballOrFootball) isActionableEdge = absEdge >= 1.50;
                else isActionableEdge = absEdge > 0;

                // Resolve recommendedSide: use stored side, or if missing/null but edge is actionable, derive it
                let effectiveRecSide = pred.recommendedSide;
                if ((!effectiveRecSide || effectiveRecSide.toLowerCase().includes('pass') || effectiveRecSide.toLowerCase().includes('no play')) && isActionableEdge) {
                    effectiveRecSide = edge > 0 ? pred.homeTeam : pred.awayTeam;
                }

                const recNorm = normalizeTeamName(effectiveRecSide || '').toLowerCase();
                let isHomeSide = recNorm === hNorm || hNorm.includes(recNorm) || recNorm.includes(hNorm);
                let isAwaySide = recNorm === aNorm || aNorm.includes(recNorm) || recNorm.includes(aNorm);
                if (!isHomeSide && !isAwaySide && effectiveRecSide) {
                    if (effectiveRecSide === pred.homeTeam) isHomeSide = true;
                    else if (effectiveRecSide === pred.awayTeam) isAwaySide = true;
                }

                let correct: boolean | null = null;
                let outcomeLabel = 'PASS';

                if (!isActionableEdge || (!isHomeSide && !isAwaySide && effectiveRecSide !== 'Draw')) {
                    // Truly a Pass / No Bet: cannot count as a Win or a Loss
                    correct = null;
                    outcomeLabel = 'PASS';
                } else if (isHomeSide) {
                    const adjustedHome = finalHomeScore + marketSpread;
                    if (adjustedHome > finalAwayScore) {
                        correct = true;
                        outcomeLabel = 'HIT';
                    } else if (adjustedHome < finalAwayScore) {
                        correct = false;
                        outcomeLabel = 'MISS';
                    } else {
                        correct = null; // Push
                        outcomeLabel = 'PUSH';
                    }
                } else if (isAwaySide) {
                    const awaySpread = -marketSpread;
                    const adjustedAway = finalAwayScore + awaySpread;
                    if (adjustedAway > finalHomeScore) {
                        correct = true;
                        outcomeLabel = 'HIT';
                    } else if (adjustedAway < finalHomeScore) {
                        correct = false;
                        outcomeLabel = 'MISS';
                    } else {
                        correct = null; // Push
                        outcomeLabel = 'PUSH';
                    }
                } else if (effectiveRecSide === 'Draw') {
                    if (finalHomeScore === finalAwayScore) {
                        correct = true;
                        outcomeLabel = 'HIT';
                    } else {
                        correct = false;
                        outcomeLabel = 'MISS';
                    }
                }

                await resilientUpdateDoc('model_predictions', predId, {
                    status: 'graded',
                    actualScore: { home: finalHomeScore, away: finalAwayScore },
                    actualSpread: actualSpread,
                    correct: correct,
                    recommendedSide: effectiveRecSide || null,
                    gradedAt: now.toISOString(),
                    isFrozen: true
                });

                results.graded.push(`${pred.sport}: ${pred.awayTeam} ${finalAwayScore} - ${finalHomeScore} ${pred.homeTeam} (${outcomeLabel})`);
                console.log(`[sync-accuracy] GRADED ${pred.sport}: ${pred.awayTeam} ${finalAwayScore} - ${finalHomeScore} ${pred.homeTeam} => ${outcomeLabel}`);
            }
        }

        return NextResponse.json(results);

    } catch (error: any) {
        console.error('[sync-accuracy] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
