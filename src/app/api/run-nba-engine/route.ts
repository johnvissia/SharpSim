import { NextRequest, NextResponse } from 'next/server';
import { fetchEspnSchedule } from '@/lib/espn';
import { normalizeTeamName } from '@/lib/team-names';
import { DailyGame } from '@/lib/types';
import { resilientGetCollection, resilientSetDoc } from '@/lib/firestore-rest';
import { syncAllInjuriesFromESPN } from '@/lib/services/espn-injuries';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    try {
        const reqUrl = new URL(request.url);
        const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
        const now = new Date();

        // 1. Update NBA injuries from ESPN in background
        await syncAllInjuriesFromESPN().catch(e => {
            console.warn('[run-nba-engine] Failed to sync injuries:', e.message);
        });

        // 2. Fetch full schedule and odds
        const [allGames, dailyGames] = await Promise.all([
            fetchEspnSchedule(),
            resilientGetCollection<DailyGame>('daily_games', 300)
        ]);

        const formatNyDate = (date: Date) => {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(date);
            return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
        };
        const todayNy = formatNyDate(now);

        const twentyFourHours = 24 * 60 * 60 * 1000;
        const todayNbaGames = allGames.filter(g => {
            if (g.sport !== 'NBA') return false;
            if (g.statusState === 'post') return false;
            const gameNy = formatNyDate(new Date(g.startTime));
            return gameNy === todayNy || g.statusState === 'in';
        });

        const targetNbaGames = todayNbaGames.length > 0 ? todayNbaGames : allGames.filter(g => {
            if (g.sport !== 'NBA') return false;
            const gameTime = new Date(g.startTime).getTime();
            const timeUntilStart = gameTime - now.getTime();
            if (timeUntilStart > twentyFourHours && g.statusState !== 'in') return false;
            if (g.statusState === 'post') return false;
            return true;
        });

        const predictedGames: any[] = [];

        for (const game of targetNbaGames) {
            const hName = normalizeTeamName(game.homeTeam.name);
            const aName = normalizeTeamName(game.awayTeam.name);

            const dg = (dailyGames as any[]).find((d: any) =>
                normalizeTeamName(d.homeTeam) === hName &&
                normalizeTeamName(d.awayTeam) === aName
            );

            let spreadPoints = 0;
            let spreadSource = 'Consensus';
            if (dg?.bookmakerOdds) {
                for (const bkStr of dg.bookmakerOdds) {
                    try {
                        const bookmaker = JSON.parse(bkStr);
                        const sm = bookmaker.markets?.find((m: any) => m.key === 'spreads');
                        if (sm) {
                            const outcome = sm.outcomes?.find((o: any) => normalizeTeamName(o.name) === hName);
                            if (outcome && outcome.point !== undefined) {
                                spreadPoints = outcome.point;
                                spreadSource = bookmaker.title || 'Odds API';
                                if (spreadPoints !== 0) break;
                            }
                        }
                    } catch (e) {}
                }
            }

            try {
                const predRes = await fetch(
                    `${baseUrl}/api/predict-game?home=${encodeURIComponent(hName)}&away=${encodeURIComponent(aName)}&marketSpread=${spreadPoints}`
                );
                const predJson = await predRes.json();

                if (predRes.ok) {
                    const prediction = predJson.prediction || {
                        projectedSpread: -(predJson.predictedMargin ?? 0),
                        zScore: predJson.zScore ?? 0,
                        betSignal: predJson.betSignal ?? 'No Play',
                        recommendedSide: predJson.recommendedSide ?? predJson.modelPick ?? null,
                        confidence: predJson.confidence ?? 'Medium'
                    };

                    const gameData = {
                        id: game.id,
                        gameId: game.id,
                        sport: 'NBA',
                        matchup: `${game.awayTeam.name} @ ${game.homeTeam.name}`,
                        homeTeam: game.homeTeam.name,
                        awayTeam: game.awayTeam.name,
                        startTime: game.startTime,
                        snapshotTime: now.toISOString(),
                        marketSpread: spreadPoints,
                        spreadSource,
                        projectedSpread: prediction.projectedSpread,
                        zScore: prediction.zScore,
                        signal: prediction.betSignal || 'No Play',
                        betSignal: prediction.betSignal || 'No Play',
                        recommendedSide: prediction.recommendedSide,
                        confidence: prediction.confidence,
                        status: 'pending',
                        isFrozen: false
                    };

                    predictedGames.push(gameData);

                    // Persist prediction to Firestore
                    await resilientSetDoc('model_predictions', game.id, gameData).catch(err => {
                        console.warn(`[run-nba-engine] Failed to cache prediction for ${game.id}:`, err.message);
                    });
                }
            } catch (err: any) {
                console.error(`[run-nba-engine] Prediction failed for ${aName} @ ${hName}:`, err.message);
            }
        }

        return NextResponse.json({
            success: true,
            sport: 'NBA',
            generatedAt: now.toISOString(),
            totalGames: predictedGames.length,
            games: predictedGames
        });

    } catch (error: any) {
        console.error('[run-nba-engine] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to run NBA engine' }, { status: 500 });
    }
}
