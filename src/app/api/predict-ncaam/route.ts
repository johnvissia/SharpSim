import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { ncaamShortNameMap } from '@/lib/ncaam-teams';
import { normalizeTeamName } from '@/lib/team-names';

export const dynamic = 'force-dynamic';

// Model Constants
const HCA_NET = 3.0;
const BASE_STD_DEV = 12.0;
const REPLACEMENT_BPM = -2.0;

async function fetchTeamInjuries(teamId: string) {
    if (!teamId) return [];
    try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.athletes?.filter((a: any) => a.injuries && a.injuries.length > 0) || [];
    } catch (e) {
        return [];
    }
}

function normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - prob : prob;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const homeNameRaw = searchParams.get('home') || '';
    const awayNameRaw = searchParams.get('away') || '';
    const marketSpread = parseFloat(searchParams.get('marketSpread') || '0');

    const homeName = normalizeTeamName(homeNameRaw);
    const awayName = normalizeTeamName(awayNameRaw);

    try {
        // 1. Resolve Team Stats with fuzzy matching
        const findStats = async (name: string) => {
            // Precise Match
            let snap = await db.collection('ncaam_team_stats').where('teamName', '==', name).get();
            if (!snap.empty) return snap.docs[0].data();

            // Try with "State" vs "St"
            const altName = name.includes('St.') ? name.replace('St.', 'State') : name.replace('State', 'St.');
            snap = await db.collection('ncaam_team_stats').where('teamName', '==', altName).get();
            if (!snap.empty) return snap.docs[0].data();

            // Try Prefix Match
            snap = await db.collection('ncaam_team_stats')
                .where('teamName', '>=', name.substring(0, 5))
                .limit(20)
                .get();

            return snap.docs.find(d => {
                const dName = d.data().teamName;
                return dName.includes(name) || name.includes(dName);
            })?.data();
        };

        const homeStats = await findStats(homeName);
        const awayStats = await findStats(awayName);

        if (!homeStats || !awayStats) {
            return NextResponse.json({ error: `Stats not found for ${!homeStats ? homeName : awayName}` }, { status: 404 });
        }

        const homeId = ncaamShortNameMap[homeName] || ncaamShortNameMap[homeStats.teamName] || '';
        const awayId = ncaamShortNameMap[awayName] || ncaamShortNameMap[awayStats.teamName] || '';

        const homeBaseline = homeStats.powerRatings.blendedRating || 0;
        const awayBaseline = awayStats.powerRatings.blendedRating || 0;

        // 2. Adjustments: Injury
        const homeInjuries = await fetchTeamInjuries(homeId);
        const awayInjuries = await fetchTeamInjuries(awayId);

        const calculateInjAdjustment = (injuries: any[]) => {
            let adj = 0;
            const impactful = [];
            for (const inj of injuries) {
                const status = inj.injuries[0].status;
                if (status.includes('Out') || status.includes('Suspended')) {
                    const bpm = 2.0;
                    const mpg = 30;
                    const impact = (bpm - REPLACEMENT_BPM) * (mpg / 40);
                    adj += impact;
                    impactful.push({ name: inj.fullName, status, impact: (-impact).toFixed(1) });
                }
            }
            return { adj, impactful };
        };

        const homeInj = calculateInjAdjustment(homeInjuries);
        const awayInj = calculateInjAdjustment(awayInjuries);

        // 3. Predicted Pace
        const hp = homeStats.powerRatings.avgPace || 70;
        const ap = awayStats.powerRatings.avgPace || 70;
        const predictedPace = (hp * 0.5) + (ap * 0.5);

        // 4. Projection
        // gapNet = Home - Away + HCA? 
        // Example: Home(5), Away(2), HCA(3) -> 5 - 2 + 3 = 6. Home by 6.
        // projectedSpread (Home favor) = -6.
        const homeAdj = homeBaseline - homeInj.adj;
        const awayAdj = awayBaseline - awayInj.adj;
        const gapNet = homeAdj - awayAdj + HCA_NET;
        const projectedSpread = -((gapNet / 100) * predictedPace);

        // 5. Z-Score & Signal
        const zScore = (marketSpread - projectedSpread) / BASE_STD_DEV;
        const absZ = Math.abs(zScore);

        let betSignal = "No Play";
        if (absZ >= 1.0) betSignal = "ELITE VALUE";
        else if (absZ >= 0.75) betSignal = "STRONG VALUE";
        else if (absZ >= 0.55) betSignal = "PLAYABLE";

        const recommendedSide = zScore > 0 ? homeNameRaw : awayNameRaw;

        return NextResponse.json({
            matchup: `${awayNameRaw} @ ${homeNameRaw}`,
            prediction: {
                projectedSpread: parseFloat(projectedSpread.toFixed(1)),
                marketSpread: marketSpread,
                zScore: parseFloat(zScore.toFixed(2)),
                betSignal,
                recommendedSide: recommendedSide,
                confidence: Math.min(absZ * 25, 99).toFixed(0) + '%'
            },
            components: {
                home: {
                    baseRating: parseFloat(homeBaseline.toFixed(1)),
                    injuryPenalty: parseFloat((-homeInj.adj).toFixed(1)),
                    finalTPR: parseFloat(homeAdj.toFixed(1))
                },
                away: {
                    baseRating: parseFloat(awayBaseline.toFixed(1)),
                    injuryPenalty: parseFloat((-awayInj.adj).toFixed(1)),
                    finalTPR: parseFloat(awayAdj.toFixed(1))
                },
                hca: { total: HCA_NET, breakdown: { homeFacility: HCA_NET } }
            },
            injuries: {
                home: homeInj.impactful,
                away: awayInj.impactful
            }
        });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}


