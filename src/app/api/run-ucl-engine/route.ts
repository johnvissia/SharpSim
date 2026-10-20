import { NextResponse } from 'next/server';
import { resilientSetDoc } from '@/lib/firestore-rest';

export const dynamic = 'force-dynamic';

const LEAGUE_COEFFICIENTS: Record<string, number> = {
    'Premier League': 1.00,
    'La Liga': 0.96,
    'Serie A': 0.93,
    'Bundesliga': 0.93,
    'Ligue 1': 0.85,
    'Liga Portugal': 0.78,
    'Eredivisie': 0.76,
    'Belgian Pro': 0.72,
    'Scottish Prem': 0.65,
    'Rest of Europe': 0.60
};

const UCL_POWER_RATINGS: Record<string, { att: number; def: number; league: string }> = {
    'manchester city': { att: 0.58, def: -0.42, league: 'Premier League' },
    'real madrid': { att: 0.56, def: -0.40, league: 'La Liga' },
    'bayern munich': { att: 0.55, def: -0.38, league: 'Bundesliga' },
    'liverpool': { att: 0.54, def: -0.38, league: 'Premier League' },
    'arsenal': { att: 0.52, def: -0.45, league: 'Premier League' },
    'barcelona': { att: 0.50, def: -0.35, league: 'La Liga' },
    'inter milan': { att: 0.45, def: -0.40, league: 'Serie A' },
    'internazionale': { att: 0.45, def: -0.40, league: 'Serie A' },
    'paris saint-germain': { att: 0.44, def: -0.32, league: 'Ligue 1' },
    'psg': { att: 0.44, def: -0.32, league: 'Ligue 1' },
    'bayer leverkusen': { att: 0.42, def: -0.30, league: 'Bundesliga' },
    'atletico madrid': { att: 0.35, def: -0.38, league: 'La Liga' },
    'atlético madrid': { att: 0.35, def: -0.38, league: 'La Liga' },
    'borussia dortmund': { att: 0.36, def: -0.22, league: 'Bundesliga' },
    'dortmund': { att: 0.36, def: -0.22, league: 'Bundesliga' },
    'aston villa': { att: 0.32, def: -0.15, league: 'Premier League' },
    'sporting cp': { att: 0.32, def: -0.18, league: 'Liga Portugal' },
    'sporting lisbon': { att: 0.32, def: -0.18, league: 'Liga Portugal' },
    'juventus': { att: 0.30, def: -0.30, league: 'Serie A' },
    'ac milan': { att: 0.28, def: -0.26, league: 'Serie A' },
    'milan': { att: 0.28, def: -0.26, league: 'Serie A' },
    'atalanta': { att: 0.32, def: -0.22, league: 'Serie A' },
    'napoli': { att: 0.28, def: -0.25, league: 'Serie A' },
    'benfica': { att: 0.28, def: -0.15, league: 'Liga Portugal' },
    'fc porto': { att: 0.26, def: -0.15, league: 'Liga Portugal' },
    'porto': { att: 0.26, def: -0.15, league: 'Liga Portugal' },
    'as roma': { att: 0.26, def: -0.14, league: 'Serie A' },
    'roma': { att: 0.26, def: -0.14, league: 'Serie A' },
    'villarreal': { att: 0.25, def: -0.14, league: 'La Liga' },
    'rb leipzig': { att: 0.30, def: -0.18, league: 'Bundesliga' },
    'leipzig': { att: 0.30, def: -0.18, league: 'Bundesliga' },
    'monaco': { att: 0.24, def: -0.12, league: 'Ligue 1' },
    'psv eindhoven': { att: 0.22, def: -0.10, league: 'Eredivisie' },
    'psv': { att: 0.22, def: -0.10, league: 'Eredivisie' },
    'real betis': { att: 0.20, def: -0.10, league: 'La Liga' },
    'betis': { att: 0.20, def: -0.10, league: 'La Liga' },
    'feyenoord': { att: 0.18, def: -0.08, league: 'Eredivisie' },
    'feyenoord rotterdam': { att: 0.18, def: -0.08, league: 'Eredivisie' },
    'lille': { att: 0.16, def: -0.08, league: 'Ligue 1' },
    'stuttgart': { att: 0.15, def: -0.06, league: 'Bundesliga' },
    'vfb stuttgart': { att: 0.15, def: -0.06, league: 'Bundesliga' },
    'bologna': { att: 0.12, def: -0.05, league: 'Serie A' },
    'girona': { att: 0.10, def: -0.05, league: 'La Liga' },
    'fenerbahce': { att: 0.08, def: 0.00, league: 'Rest of Europe' },
    'fenerbahçe': { att: 0.08, def: 0.00, league: 'Rest of Europe' },
    'club brugge': { att: 0.06, def: 0.02, league: 'Belgian Pro' },
    'brugge': { att: 0.06, def: 0.02, league: 'Belgian Pro' },
    'celtic': { att: 0.02, def: 0.05, league: 'Scottish Prem' },
    'shakhtar donetsk': { att: 0.00, def: 0.08, league: 'Rest of Europe' },
    'shakhtar': { att: 0.00, def: 0.08, league: 'Rest of Europe' },
    'brest': { att: -0.04, def: 0.12, league: 'Ligue 1' },
    'como': { att: -0.05, def: 0.10, league: 'Serie A' },
    'bodo/glimt': { att: -0.04, def: 0.12, league: 'Rest of Europe' },
    'bodø/glimt': { att: -0.04, def: 0.12, league: 'Rest of Europe' },
    'dinamo zagreb': { att: -0.05, def: 0.12, league: 'Rest of Europe' },
    'salzburg': { att: -0.06, def: 0.14, league: 'Rest of Europe' },
    'sparta prague': { att: -0.08, def: 0.15, league: 'Rest of Europe' },
    'slavia prague': { att: -0.08, def: 0.15, league: 'Rest of Europe' },
    'red star belgrade': { att: -0.10, def: 0.18, league: 'Rest of Europe' },
    'sturm graz': { att: -0.12, def: 0.20, league: 'Rest of Europe' },
    'lask linz': { att: -0.12, def: 0.20, league: 'Rest of Europe' },
    'lask': { att: -0.12, def: 0.20, league: 'Rest of Europe' },
    'young boys': { att: -0.15, def: 0.22, league: 'Rest of Europe' },
    'aek athens': { att: -0.15, def: 0.22, league: 'Rest of Europe' },
    'aek': { att: -0.15, def: 0.22, league: 'Rest of Europe' },
    'slovan bratislava': { att: -0.22, def: 0.28, league: 'Rest of Europe' },
    'slovan': { att: -0.22, def: 0.28, league: 'Rest of Europe' },
    'sabah fk': { att: -0.35, def: 0.40, league: 'Rest of Europe' },
    'sabah': { att: -0.35, def: 0.40, league: 'Rest of Europe' },
    'viking fk': { att: -0.25, def: 0.30, league: 'Rest of Europe' },
    'lens': { att: 0.08, def: 0.02, league: 'Ligue 1' },
    'galatasaray': { att: 0.10, def: 0.00, league: 'Rest of Europe' },
};

function resolveRating(team: string) {
    const t = team.toLowerCase().trim();
    if (UCL_POWER_RATINGS[t]) return UCL_POWER_RATINGS[t];
    for (const [k, v] of Object.entries(UCL_POWER_RATINGS)) {
        if (t.includes(k) || k.includes(t)) return v;
    }
    return { att: -0.15, def: 0.22, league: 'Rest of Europe' };
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

        // Check today, tomorrow, and the next 2 days to capture the upcoming matchday slate
        for (let i = 0; i <= 3; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            dates.push(d.toLocaleDateString('en-CA').replace(/-/g, ''));
        }

        const eventsMap = new Map<string, any>();
        await Promise.all(
            dates.map(async (dt) => {
                try {
                    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=${dt}&limit=50`);
                    if (!res.ok) return;
                    const json = await res.json();
                    (json.events || []).forEach((e: any) => eventsMap.set(e.id, e));
                } catch {}
            })
        );

        const events = Array.from(eventsMap.values());
        const calculatedFixtures: any[] = [];

        for (const event of events) {
            const eventTime = new Date(event.date).getTime();
            const timeUntilStart = eventTime - now.getTime();

            // Run games starting within the next 36 hours (covering tomorrow's full matchday slate) or live/recent within 4h
            if (timeUntilStart > 36 * 3600 * 1000 || timeUntilStart < -4 * 3600 * 1000) {
                continue;
            }

            const comp = event.competitions?.[0];
            if (!comp) continue;
            const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home');
            const awayComp = comp.competitors?.find((c: any) => c.homeAway === 'away');
            if (!homeComp || !awayComp) continue;

            const homeTeam = homeComp.team?.displayName || 'Home Team';
            const awayTeam = awayComp.team?.displayName || 'Away Team';

            const hRate = resolveRating(homeTeam);
            const aRate = resolveRating(awayTeam);

            const hCoeff = LEAGUE_COEFFICIENTS[hRate.league] || 0.60;
            const aCoeff = LEAGUE_COEFFICIENTS[aRate.league] || 0.60;
            const leagueDiff = (hCoeff - aCoeff) * 0.35;
            const homeAdv = 0.26; // European home advantage

            const lamHome = Math.max(0.4, Math.min(4.8, Math.exp(hRate.att + aRate.def + homeAdv + leagueDiff)));
            const lamAway = Math.max(0.2, Math.min(4.2, Math.exp(aRate.att + hRate.def - leagueDiff)));

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

            let recSide = homeTeam;
            let spreadLine = -0.5;
            if (winAway > winHome) {
                recSide = awayTeam;
                spreadLine = 0.5;
            } else if (draw > winHome && draw > winAway) {
                recSide = 'Draw';
                spreadLine = 0;
            }

            const zScore = parseFloat((margin / 1.15).toFixed(2));
            let signal = 'No Play';
            if (Math.abs(zScore) >= 1.0 || Math.max(winHome, winAway) >= 65) signal = 'ELITE VALUE';
            else if (Math.abs(zScore) >= 0.70 || Math.max(winHome, winAway) >= 54) signal = 'STRONG VALUE';
            else if (Math.abs(zScore) >= 0.40) signal = 'PLAYABLE';

            const isWithin15m = timeUntilStart <= 15 * 60 * 1000;
            const predRecord = {
                id: `UCL_${event.id}`,
                gameId: event.id,
                sport: 'UCL',
                homeTeam,
                awayTeam,
                startTime: event.date,
                marketSpread: 0,
                spreadSource: 'Consensus',
                projectedSpread: -margin,
                recommendedSide: recSide,
                betSignal: signal,
                status: 'pending',
                isFrozen: isWithin15m,
                frozenAt: isWithin15m ? now.toISOString() : null,
                predictedHomeGoals: parseFloat(lamHome.toFixed(2)),
                predictedAwayGoals: parseFloat(lamAway.toFixed(2)),
                winProbHome: winHome,
                winProbAway: winAway,
                drawProb: draw,
                over25Prob: Math.round(pOver25 * 100),
                updatedAt: new Date().toISOString()
            };

            calculatedFixtures.push(predRecord);

            // Persist to model_predictions for tracking
            try {
                await resilientSetDoc('model_predictions', `UCL_${event.id}`, predRecord);
            } catch (err) {
                console.warn(`[run-ucl-engine] Firestore write warning for ${event.id}:`, err);
            }
        }

        // Sort fixtures by absolute margin descending
        calculatedFixtures.sort((a, b) => Math.abs(b.projectedSpread) - Math.abs(a.projectedSpread));

        return NextResponse.json({
            success: true,
            sport: 'UCL',
            fixturesCalculated: calculatedFixtures.length,
            fixtures: calculatedFixtures,
            topTeams: Object.entries(UCL_POWER_RATINGS).slice(0, 12).map(([team, r], i) => ({
                rank: i + 1,
                team: team.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                attack: r.att.toFixed(2),
                defense: r.def.toFixed(2),
                league: r.league,
                net: (r.att - r.def).toFixed(2)
            }))
        });

    } catch (error: any) {
        console.error('[run-ucl-engine] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to run UCL engine' }, { status: 500 });
    }
}
