import { NextResponse } from 'next/server';
import { updateRestDoc, resilientGetCollection } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

const EPL_POWER_RATINGS: Record<string, { att: number; def: number }> = {
    'manchester city': { att: 0.58, def: -0.42 },
    'arsenal': { att: 0.52, def: -0.45 },
    'liverpool': { att: 0.54, def: -0.38 },
    'aston villa': { att: 0.32, def: -0.15 },
    'tottenham': { att: 0.36, def: -0.12 },
    'tottenham hotspur': { att: 0.36, def: -0.12 },
    'chelsea': { att: 0.28, def: -0.10 },
    'newcastle': { att: 0.25, def: -0.08 },
    'newcastle united': { att: 0.25, def: -0.08 },
    'manchester united': { att: 0.18, def: 0.02 },
    'brighton': { att: 0.16, def: 0.05 },
    'brighton & hove albion': { att: 0.16, def: 0.05 },
    'west ham': { att: 0.08, def: 0.12 },
    'west ham united': { att: 0.08, def: 0.12 },
    'fulham': { att: 0.02, def: 0.14 },
    'bournemouth': { att: 0.05, def: 0.16 },
    'afc bournemouth': { att: 0.05, def: 0.16 },
    'brentford': { att: 0.04, def: 0.18 },
    'crystal palace': { att: -0.02, def: 0.15 },
    'everton': { att: -0.08, def: 0.12 },
    'nottingham forest': { att: -0.05, def: 0.10 },
    'wolverhampton': { att: -0.12, def: 0.20 },
    'wolverhampton wanderers': { att: -0.12, def: 0.20 },
    'leicester': { att: -0.15, def: 0.25 },
    'leicester city': { att: -0.15, def: 0.25 },
    'ipswich': { att: -0.22, def: 0.32 },
    'ipswich town': { att: -0.22, def: 0.32 },
    'southampton': { att: -0.25, def: 0.35 }
};

function resolveRating(team: string) {
    const t = team.toLowerCase().trim();
    if (EPL_POWER_RATINGS[t]) return EPL_POWER_RATINGS[t];
    for (const [k, v] of Object.entries(EPL_POWER_RATINGS)) {
        if (t.includes(k) || k.includes(t)) return v;
    }
    return { att: -0.15, def: 0.25 };
}

function factorial(n: number): number {
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

function poisson(k: number, l: number): number {
    return (Math.pow(l, k) * Math.exp(-l)) / factorial(k);
}

export async function POST() {
    try {
        const dates: string[] = [];
        const now = new Date();
        for (let i = 0; i <= 2; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            dates.push(d.toLocaleDateString('en-CA').replace(/-/g, ''));
        }

        const eventsMap = new Map<string, any>();
        await Promise.all(
            dates.map(async (dt) => {
                try {
                    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=${dt}&limit=50`);
                    if (!res.ok) return;
                    const json = await res.json();
                    (json.events || []).forEach((e: any) => eventsMap.set(e.id, e));
                } catch {}
            })
        );

        const events = Array.from(eventsMap.values());
        const calculatedFixtures: any[] = [];
        const dailyGames = await resilientGetCollection<any>('daily_games', 100).catch(() => []);

        for (const event of events) {
            const eventTime = new Date(event.date).getTime();
            const timeUntilStart = eventTime - now.getTime();
            // STRICT: Games can ONLY be predicted if starting within 24 hours
            if (timeUntilStart > 24 * 3600 * 1000 || timeUntilStart < -4 * 3600 * 1000) {
                continue;
            }

            const comp = event.competitions?.[0];
            if (!comp) continue;
            const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home');
            const awayComp = comp.competitors?.find((c: any) => c.homeAway === 'away');
            if (!homeComp || !awayComp) continue;

            const homeTeam = homeComp.team.displayName;
            const awayTeam = awayComp.team.displayName;

            const hRate = resolveRating(homeTeam);
            const aRate = resolveRating(awayTeam);

            const lamHome = Math.max(0.4, Math.min(4.5, Math.exp(hRate.att + aRate.def + 0.30)));
            const lamAway = Math.max(0.2, Math.min(3.8, Math.exp(aRate.att + hRate.def)));

            let pHome = 0;
            let pDraw = 0;
            let pAway = 0;
            let pOver25 = 0;
            const rho = -0.05;

            for (let h = 0; h <= 6; h++) {
                for (let a = 0; a <= 6; a++) {
                    let p = poisson(h, lamHome) * poisson(a, lamAway);
                    if (h === 0 && a === 0) p *= (1 - lamHome * lamAway * rho);
                    else if (h === 1 && a === 0) p *= (1 + lamAway * rho);
                    else if (h === 0 && a === 1) p *= (1 + lamHome * rho);
                    else if (h === 1 && a === 1) p *= (1 - rho);

                    if (h > a) pHome += p;
                    else if (h === a) pDraw += p;
                    else pAway += p;

                    if (h + a > 2.5) pOver25 += p;
                }
            }

            const total = pHome + pDraw + pAway || 1;
            const winHome = Math.round((pHome / total) * 100);
            const draw = Math.round((pDraw / total) * 100);
            const winAway = Math.round((pAway / total) * 100);
            const margin = parseFloat((lamHome - lamAway).toFixed(2));
            const projectedSpread = parseFloat((-margin).toFixed(2));

            // Determine marketSpread from daily_games or power-rating consensus
            const hNorm = homeTeam.toLowerCase().replace(/[^a-z0-9]/g, '');
            const aNorm = awayTeam.toLowerCase().replace(/[^a-z0-9]/g, '');

            const dg = dailyGames.find((d: any) => {
                const dh = (d.homeTeam || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const da = (d.awayTeam || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return (dh.includes(hNorm) || hNorm.includes(dh)) && (da.includes(aNorm) || aNorm.includes(da));
            });

            let marketSpread: number | null = null;
            let spreadSource = 'Consensus Handicap';

            if (dg?.bookmakerOdds) {
                for (const bkStr of dg.bookmakerOdds) {
                    try {
                        const bm = typeof bkStr === 'string' ? JSON.parse(bkStr) : bkStr;
                        const sm = bm.markets?.find((m: any) => m.key === 'spreads');
                        if (sm?.outcomes) {
                            const outcome = sm.outcomes.find((o: any) => {
                                const on = (o.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                return on.includes(hNorm) || hNorm.includes(on);
                            });
                            if (outcome && typeof outcome.point === 'number') {
                                marketSpread = outcome.point;
                                spreadSource = bm.title || 'Market';
                                break;
                            }
                        }
                    } catch { }
                }
            }

            if (marketSpread === null) {
                marketSpread = -Math.round(margin * 2) / 2;
                spreadSource = 'Consensus Handicap';
            }

            // Calculate cover probabilities for marketSpread
            const targetThreshold = -marketSpread;
            let pHomeCover = 0;
            let pAwayCover = 0;

            for (let h = 0; h <= 6; h++) {
                for (let a = 0; a <= 6; a++) {
                    let p = poisson(h, lamHome) * poisson(a, lamAway);
                    if (h === 0 && a === 0) p *= (1 - lamHome * lamAway * rho);
                    else if (h === 1 && a === 0) p *= (1 + lamAway * rho);
                    else if (h === 0 && a === 1) p *= (1 + lamHome * rho);
                    else if (h === 1 && a === 1) p *= (1 - rho);

                    if (h - a > targetThreshold) pHomeCover += p;
                    else if (h - a < targetThreshold) pAwayCover += p;
                }
            }

            const totalCover = pHomeCover + pAwayCover || 1;
            const homeCoverProb = Math.round((pHomeCover / totalCover) * 100);
            const awayCoverProb = Math.round((pAwayCover / totalCover) * 100);

            const isHomePick = homeCoverProb >= awayCoverProb;
            const recSide = isHomePick ? homeTeam : awayTeam;
            const coverProb = Math.max(homeCoverProb, awayCoverProb);

            const edge = parseFloat((marketSpread - projectedSpread).toFixed(2));
            const absEdge = Math.abs(edge);
            const zScore = parseFloat((edge / 1.25).toFixed(2));

            let signal = 'No Play';
            if (absEdge >= 1.05 && coverProb >= 58) signal = 'ELITE VALUE';
            else if (absEdge >= 0.70 && coverProb >= 55) signal = 'STRONG VALUE';
            else if (absEdge >= 0.35 && coverProb >= 52.5) signal = 'PLAYABLE';

            const predRecord = {
                id: `EPL_${event.id}`,
                gameId: event.id,
                sport: 'EPL',
                homeTeam,
                awayTeam,
                startTime: event.date,
                marketSpread,
                spreadSource,
                projectedSpread,
                recommendedSide: recSide,
                betSignal: signal,
                status: 'pending',
                predictedHomeGoals: parseFloat(lamHome.toFixed(2)),
                predictedAwayGoals: parseFloat(lamAway.toFixed(2)),
                winProbHome: winHome,
                winProbAway: winAway,
                drawProb: draw,
                coverProb,
                over25Prob: Math.round(pOver25 * 100),
                updatedAt: new Date().toISOString()
            };

            calculatedFixtures.push(predRecord);

            // Persist to model_predictions for tracking
            try {
                await updateRestDoc('model_predictions', `EPL_${event.id}`, predRecord);
            } catch (err) {
                console.warn(`[run-epl-engine] Firestore write warning for ${event.id}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            sport: 'EPL',
            fixturesCalculated: calculatedFixtures.length,
            fixtures: calculatedFixtures,
        });

    } catch (error: any) {
        console.error('[run-epl-engine] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to run EPL engine' }, { status: 500 });
    }
}
