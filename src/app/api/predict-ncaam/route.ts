// src/app/api/predict-ncaam/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ncaamShortNameMap } from '@/lib/ncaam-teams';

export const dynamic = 'force-dynamic';

if (!getApps().length) {
    try {
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
            initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }),
            });
        }
    } catch (e) {
        console.error('Failed to initialize firebase', e);
    }
}

const db = getFirestore();

// Model Constants
const HCA_NET = 3.0;
const BASE_STD_DEV = 12.0;
const REPLACEMENT_BPM = -2.0;

async function getTeamStats(abbreviation: string) {
    const doc = await db.collection('ncaam_team_stats').doc(abbreviation).get();
    return doc.exists ? doc.data() : null;
}

async function fetchTeamInjuries(teamId: string) {
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
    const homeName = searchParams.get('home') || '';
    const awayName = searchParams.get('away') || '';
    const marketSpread = parseFloat(searchParams.get('marketSpread') || '0');

    try {
        // 1. Resolve Team IDs and Stats
        const homeId = ncaamShortNameMap[homeName] || ncaamShortNameMap[homeName.replace(' St', ' State')] || '';
        const awayId = ncaamShortNameMap[awayName] || ncaamShortNameMap[awayName.replace(' St', ' State')] || '';

        // Fetch team docs from Firestore (using abbreviation which is often id-based or name-based)
        // Actually, my sync route uses abbreviation as the doc ID.
        // I need a way to map Name -> Abbreviation.
        // For now, let's assume abbreviation is available or try a query.

        const getStatsByPossibleNames = async (name: string) => {
            const q = query(db.collection('ncaam_team_stats'), where('teamName', '==', name));
            const snap = await q.get();
            if (!snap.empty) return snap.docs[0].data();
            // Try short name
            const q2 = query(db.collection('ncaam_team_stats'), where('abbreviation', '==', name));
            const snap2 = await q2.get();
            if (!snap2.empty) return snap2.docs[0].data();
            return null;
        };

        // Use query for flexibility
        const homeStats = await db.collection('ncaam_team_stats')
            .where('teamName', '>=', homeName.substring(0, 5))
            .limit(10)
            .get()
            .then(s => s.docs.find(d => d.data().teamName.includes(homeName))?.data());

        const awayStats = await db.collection('ncaam_team_stats')
            .where('teamName', '>=', awayName.substring(0, 5))
            .limit(10)
            .get()
            .then(s => s.docs.find(d => d.data().teamName.includes(awayName))?.data());

        if (!homeStats || !awayStats) {
            return NextResponse.json({ error: `Stats not found for ${!homeStats ? homeName : awayName}` }, { status: 404 });
        }

        const homeTPR = homeStats.powerRatings.blendedRating || 0;
        const awayTPR = awayStats.powerRatings.blendedRating || 0;

        // 2. Adjustments: Injury
        const homeInjuries = await fetchTeamInjuries(homeId);
        const awayInjuries = await fetchTeamInjuries(awayId);

        const calculateInjAdjustment = (injuries: any[]) => {
            let adj = 0;
            const impactful = [];
            for (const inj of injuries) {
                // Heuristic: default BPM 2.0, MPG 30 for anyone "Out" or similar
                const status = inj.injuries[0].status;
                if (status.includes('Out') || status.includes('Suspended')) {
                    const bpm = 2.0; // Default key player impact
                    const mpg = 30;
                    const impact = (bpm - REPLACEMENT_BPM) * (mpg / 40);
                    adj += impact;
                    impactful.push({ name: inj.fullName, status, impact: -impact });
                }
            }
            return { adj, impactful };
        };

        const homeInj = calculateInjAdjustment(homeInjuries);
        const awayInj = calculateInjAdjustment(awayInjuries);

        // 3. Adjustments: Rest
        const getRestAdj = (stats: any, isHome: boolean) => {
            const lastGame = stats.games?.[stats.games.length - 1];
            if (!lastGame) return 0;
            const daysRest = lastGame.daysRest || 99;
            if (daysRest === 0) return isHome ? -1.5 : -2.5;
            return 0;
        };

        const homeRestAdj = getRestAdj(homeStats, true);
        const awayRestAdj = getRestAdj(awayStats, false);

        // 4. Adjustments: Rebounding
        const homeRebEdge = (homeStats.powerRatings.avgORB || 0) - (awayStats.powerRatings.avgDRB || 0);
        const awayRebEdge = (awayStats.powerRatings.avgORB || 0) - (homeStats.powerRatings.avgDRB || 0);

        const getRebAdj = (edge: number) => {
            if (edge >= 12) return 2.5;
            if (edge >= 8) return 1.5;
            return 0;
        };

        const homeRebAdj = getRebAdj(homeRebEdge);
        const awayRebAdj = getRebAdj(awayRebEdge);

        // Final TPRs
        const finalHomeTPR = homeTPR - homeInj.adj + homeRestAdj + homeRebAdj;
        const finalAwayTPR = awayTPR - awayInj.adj + awayRestAdj + awayRebAdj;

        // 5. Predicted Pace
        const hp = homeStats.powerRatings.avgPace || 70;
        const ap = awayStats.powerRatings.avgPace || 70;
        const slowPace = Math.min(hp, ap);
        const fastPace = Math.max(hp, ap);
        const predictedPace = (slowPace * 0.55) + (fastPace * 0.45);

        // 6. Projection
        const gapNet = finalHomeTPR - finalAwayTPR + HCA_NET;
        const projectedSpread = (gapNet / 100) * predictedPace;

        // 7. Probability
        const z = (projectedSpread - marketSpread) / BASE_STD_DEV;
        const winProb = normalCDF(z);

        // 8. Edge and Value
        const marketProb = marketSpread > 0 ? (100 / (100 + marketSpread)) : (-marketSpread / (-marketSpread + 100));
        // ^ This is a rough estimate for the market prob of the spread covering. 
        // Usually it's ~50% if the vig is -110.
        const edge = Math.abs(winProb - 0.5); // Simplified for spread edge
        const totalEdgeValue = marketSpread - (-projectedSpread); // Points edge

        let valueTier = 'None';
        if (Math.abs(totalEdgeValue) > 4.0) valueTier = 'High';
        else if (Math.abs(totalEdgeValue) > 2.0) valueTier = 'Medium';
        else if (Math.abs(totalEdgeValue) > 0.5) valueTier = 'Low';

        return NextResponse.json({
            homeTeam: homeName,
            awayTeam: awayName,
            homeBaseline: homeTPR,
            awayBaseline: awayTPR,
            homeFinalTPR: finalHomeTPR,
            awayFinalTPR: finalAwayTPR,
            homeTotalPenalty: finalHomeTPR - homeTPR,
            awayTotalPenalty: finalAwayTPR - awayTPR,
            projectedSpread: -projectedSpread, // Flip for display consistency (Home -3.5)
            marketSpread,
            edge: Math.abs(totalEdgeValue),
            winProb,
            valueTier,
            homeInjuries: homeInj.impactful,
            awayInjuries: awayInj.impactful,
            adjustments: {
                rest: homeRestAdj - awayRestAdj,
                rebounding: homeRebAdj - awayRebAdj
            },
            recommendation: valueTier !== 'None' ? `${valueTier} Value on ${totalEdgeValue > 0 ? homeName : awayName}` : 'Fair Value'
        });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// Support for query
import { query, where } from 'firebase-admin/firestore';
