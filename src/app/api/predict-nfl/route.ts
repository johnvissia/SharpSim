import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { normalizeTeamName } from '@/lib/team-names';
import { NFL_TEAMS, nflTeamNameToAbbreviation, normalizeNFLTeamAbbreviation } from '@/lib/nfl-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const homeParam = searchParams.get('home');
    const awayParam = searchParams.get('away');
    const marketSpreadStr = searchParams.get('marketSpread');
    const hasMarketSpread = marketSpreadStr !== null && marketSpreadStr !== 'null';
    const marketSpread = hasMarketSpread ? parseFloat(marketSpreadStr || '0') : 0;

    if (!homeParam || !awayParam) {
        return NextResponse.json({ error: 'Missing home or away team' }, { status: 400 });
    }

    const homeCanonical = normalizeTeamName(homeParam);
    const awayCanonical = normalizeTeamName(awayParam);

    const homeAbbr = nflTeamNameToAbbreviation[homeCanonical] || normalizeNFLTeamAbbreviation(homeParam) || 'DET';
    const awayAbbr = nflTeamNameToAbbreviation[awayCanonical] || normalizeNFLTeamAbbreviation(awayParam) || 'KC';

    const homeInfo = NFL_TEAMS[homeAbbr];
    const awayInfo = NFL_TEAMS[awayAbbr];

    if (!homeInfo || !awayInfo) {
        return NextResponse.json({ error: 'Unrecognized NFL team' }, { status: 400 });
    }

    try {
        // 1. Try checking Firestore model_predictions for cached/locked snapshot
        let cachedDoc: any = null;
        if (db) {
            try {
                const snapshot = await db.collection('model_predictions')
                    .where('sport', '==', 'NFL')
                    .where('homeTeam', '==', homeInfo.name)
                    .where('awayTeam', '==', awayInfo.name)
                    .limit(1)
                    .get();

                if (!snapshot.empty) {
                    cachedDoc = snapshot.docs[0].data();
                }
            } catch (err) {
                console.warn('[predict-nfl] Firestore lookup failed, falling back to dynamic computation');
            }
        }

        // 2. If cached document exists, use it
        if (cachedDoc) {
            const gameTime = cachedDoc.startTime ? new Date(cachedDoc.startTime).getTime() : 0;
            const timeUntilStart = gameTime - Date.now();
            const isWithinLockdown = (timeUntilStart <= 15 * 60 * 1000 && timeUntilStart > -4 * 3600 * 1000) || cachedDoc.isFrozen === true;

            return NextResponse.json({
                matchup: `${awayInfo.name} @ ${homeInfo.name}`,
                prediction: {
                    projectedSpread: cachedDoc.projectedSpread,
                    marketSpread: hasMarketSpread ? marketSpread : cachedDoc.marketSpread,
                    zScore: cachedDoc.zScore,
                    betSignal: cachedDoc.betSignal,
                    recommendedSide: cachedDoc.recommendedSide,
                    confidence: cachedDoc.confidence || 'High',
                    projectedTotal: cachedDoc.projectedTotal,
                    marketTotal: cachedDoc.marketTotal,
                    homeWinProb: cachedDoc.winProbHome,
                    awayWinProb: cachedDoc.winProbAway,
                    isLocked: isWithinLockdown,
                    isFrozen: cachedDoc.isFrozen ?? isWithinLockdown,
                    frozenAt: cachedDoc.frozenAt || null,
                },
                components: {
                    home: {
                        baseRating: Math.round(homeInfo.baseEPA.passOffEPA * 30 + homeInfo.baseEPA.rushOffEPA * 20),
                        injuryPenalty: 0,
                        finalTPR: cachedDoc.predictedHomeScore || 24.5,
                        passOffEPA: homeInfo.baseEPA.passOffEPA,
                        rushOffEPA: homeInfo.baseEPA.rushOffEPA,
                        successRate: Math.round(homeInfo.baseEPA.successRate * 100),
                    },
                    away: {
                        baseRating: Math.round(awayInfo.baseEPA.passOffEPA * 30 + awayInfo.baseEPA.rushOffEPA * 20),
                        injuryPenalty: 0,
                        finalTPR: cachedDoc.predictedAwayScore || 21.0,
                        passOffEPA: awayInfo.baseEPA.passOffEPA,
                        rushOffEPA: awayInfo.baseEPA.rushOffEPA,
                        successRate: Math.round(awayInfo.baseEPA.successRate * 100),
                    },
                    hca: {
                        total: 1.65,
                        breakdown: { base: 1.65 },
                    },
                    weather: {
                        venue: cachedDoc.weatherVenue || homeInfo.stadium.name,
                        isDome: cachedDoc.weatherIsDome ?? homeInfo.stadium.isDome,
                        windMph: cachedDoc.weatherWindMph ?? 6,
                    }
                },
                injuries: {
                    home: [{ name: homeInfo.startingQB.name, status: 'Healthy', impact: 'Starting QB' }],
                    away: [{ name: awayInfo.startingQB.name, status: 'Healthy', impact: 'Starting QB' }],
                },
                bestBet: {
                    selection: cachedDoc.bestBetSelection,
                    ev: `+${cachedDoc.bestBetEV || 0}%`,
                    signal: cachedDoc.betSignal,
                }
            });
        }

        // 3. Fallback Dynamic Handicapping (matches Python engine)
        const LEAGUE_AVG_PASS = 0.05;
        const LEAGUE_AVG_RUSH = -0.02;

        const homePassEPA = homeInfo.baseEPA.passOffEPA + awayInfo.baseEPA.passDefEPA - LEAGUE_AVG_PASS;
        const homeRushEPA = homeInfo.baseEPA.rushOffEPA + awayInfo.baseEPA.rushDefEPA - LEAGUE_AVG_RUSH;
        const homeBlendedEPA = (homeInfo.baseEPA.neutralPassRate * homePassEPA) + ((1 - homeInfo.baseEPA.neutralPassRate) * homeRushEPA);

        const awayPassEPA = awayInfo.baseEPA.passOffEPA + homeInfo.baseEPA.passDefEPA - LEAGUE_AVG_PASS;
        const awayRushEPA = awayInfo.baseEPA.rushOffEPA + homeInfo.baseEPA.rushDefEPA - LEAGUE_AVG_RUSH;
        const awayBlendedEPA = (awayInfo.baseEPA.neutralPassRate * awayPassEPA) + ((1 - awayInfo.baseEPA.neutralPassRate) * awayRushEPA);

        const hca = 1.65;
        const homeExpectedPts = 21.8 + (homeBlendedEPA * 63.5) + (hca * 0.55);
        const awayExpectedPts = 21.8 + (awayBlendedEPA * 63.5) - (hca * 0.45);

        const projectedMargin = homeExpectedPts - awayExpectedPts;
        const projectedSpread = -Math.round(projectedMargin * 2) / 2; // SharpSim convention
        const projectedTotal = Math.round((homeExpectedPts + awayExpectedPts) * 2) / 2;

        const spreadEdge = marketSpread - projectedSpread;
        const zScore = Math.abs(spreadEdge) / 13.8;

        let betSignal = 'No Play';
        let recommendedSide: string | null = null;
        if (spreadEdge >= 3.0) {
            betSignal = spreadEdge >= 5.5 ? 'ELITE VALUE' : 'STRONG VALUE';
            recommendedSide = homeInfo.name;
        } else if (spreadEdge <= -3.0) {
            betSignal = spreadEdge <= -5.5 ? 'ELITE VALUE' : 'STRONG VALUE';
            recommendedSide = awayInfo.name;
        } else if (Math.abs(spreadEdge) >= 1.5) {
            betSignal = 'PLAYABLE';
            recommendedSide = spreadEdge > 0 ? homeInfo.name : awayInfo.name;
        }

        return NextResponse.json({
            matchup: `${awayInfo.name} @ ${homeInfo.name}`,
            prediction: {
                projectedSpread,
                marketSpread,
                zScore: parseFloat(zScore.toFixed(2)),
                betSignal,
                recommendedSide,
                confidence: betSignal === 'ELITE VALUE' || betSignal === 'STRONG VALUE' ? 'High' : (betSignal === 'PLAYABLE' ? 'Moderate' : 'Low'),
                projectedTotal,
                marketTotal: 44.5,
                homeWinProb: Math.round((0.50 + (projectedMargin * 0.032)) * 100),
                awayWinProb: Math.round((0.50 - (projectedMargin * 0.032)) * 100),
            },
            components: {
                home: {
                    baseRating: Math.round(homeInfo.baseEPA.passOffEPA * 30 + homeInfo.baseEPA.rushOffEPA * 20),
                    injuryPenalty: 0,
                    finalTPR: parseFloat(homeExpectedPts.toFixed(1)),
                    passOffEPA: homeInfo.baseEPA.passOffEPA,
                    rushOffEPA: homeInfo.baseEPA.rushOffEPA,
                    successRate: Math.round(homeInfo.baseEPA.successRate * 100),
                },
                away: {
                    baseRating: Math.round(awayInfo.baseEPA.passOffEPA * 30 + awayInfo.baseEPA.rushOffEPA * 20),
                    injuryPenalty: 0,
                    finalTPR: parseFloat(awayExpectedPts.toFixed(1)),
                    passOffEPA: awayInfo.baseEPA.passOffEPA,
                    rushOffEPA: awayInfo.baseEPA.rushOffEPA,
                    successRate: Math.round(awayInfo.baseEPA.successRate * 100),
                },
                hca: {
                    total: hca,
                    breakdown: { base: hca },
                },
                weather: {
                    venue: homeInfo.stadium.name,
                    isDome: homeInfo.stadium.isDome,
                    windMph: 5,
                }
            },
            injuries: {
                home: [{ name: homeInfo.startingQB.name, status: 'Healthy', impact: 'Starting QB' }],
                away: [{ name: awayInfo.startingQB.name, status: 'Healthy', impact: 'Starting QB' }],
            }
        });
    } catch (e: any) {
        console.error('[predict-nfl] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
