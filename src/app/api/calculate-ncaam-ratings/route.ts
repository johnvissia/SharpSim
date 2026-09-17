// src/app/api/calculate-ncaam-ratings/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

const WEIGHT_SEASON = 0.70;
const WEIGHT_RECENCY = 0.30;
const SRS_CONVERGENCE_THRESHOLD = 0.01;
const MAX_ITERATIONS = 100;

interface BoxScore {
    FGA: number;
    FTA: number;
    TOV: number;
    ORB: number;
    FG: number;
    DRB: number;
    oppDRB: number;
    oppFGA: number;
    oppFTA: number;
    oppTOV: number;
    oppORB: number;
    oppFG: number;
    teamDRB: number;
}

function calculatePossessions(box: BoxScore): number {
    const teamOrbFactor = box.ORB / (box.ORB + box.oppDRB) || 0;
    const teamPoss = box.FGA + 0.4 * box.FTA - 1.07 * teamOrbFactor * (box.FGA - box.FG) + box.TOV;

    const oppOrbFactor = box.oppORB / (box.oppORB + box.teamDRB) || 0;
    const oppPoss = box.oppFGA + 0.4 * box.oppFTA - 1.07 * oppOrbFactor * (box.oppFGA - box.oppFG) + box.oppTOV;

    return 0.5 * (teamPoss + oppPoss);
}

function calculateNetRating(margin: number, possessions: number): number {
    if (possessions === 0) return 0;
    return 100 * (margin / possessions);
}

export async function POST() {
    try {
        const snapshot = await db.collection('ncaam_team_stats').get();
        if (snapshot.empty) throw new Error('No team data found');

        const teams = snapshot.docs.map(doc => doc.data() as any);
        const teamMap = new Map();

        // Initial ratings and data prep
        const teamsWithRatings = teams.map((team: any) => {
            const netRatings = team.games.map((g: any) => {
                if (!g.boxScore) return g.adjustedMargin; // Fallback to raw margin if no box score
                const possessions = calculatePossessions(g.boxScore);
                return calculateNetRating(g.margin, possessions);
            });

            const avgNetRating = netRatings.length > 0 ? netRatings.reduce((a: any, b: any) => a + b, 0) / netRatings.length : 0;

            const paceList = team.games.map((g: any) => g.boxScore ? calculatePossessions(g.boxScore) : 70); // 70 as default pace
            const avgPace = paceList.length > 0 ? paceList.reduce((a: any, b: any) => a + b, 0) / paceList.length : 70;

            // Rebounding stats for Adj_reb
            const orbList = team.games.map((g: any) => g.boxScore ? (g.boxScore.ORB / (g.boxScore.ORB + g.boxScore.oppDRB) || 0) : 0);
            const drbList = team.games.map((g: any) => g.boxScore ? (g.boxScore.DRB / (g.boxScore.DRB + g.boxScore.oppORB) || 0) : 0);
            const avgORB = orbList.length > 0 ? orbList.reduce((a: any, b: any) => a + b, 0) / orbList.length : 0;
            const avgDRB = drbList.length > 0 ? drbList.reduce((a: any, b: any) => a + b, 0) / drbList.length : 0;

            const teamData = {
                ...team,
                netRatings,
                avgNetRating,
                avgPace,
                avgORB: avgORB * 100, // as percentage
                avgDRB: avgDRB * 100, // as percentage
                srsRating: avgNetRating,
            };
            teamMap.set(team.abbreviation, teamData);
            return teamData;
        });

        // Recursive SRS
        let iteration = 0;
        let maxChange = Infinity;
        while (maxChange > SRS_CONVERGENCE_THRESHOLD && iteration < MAX_ITERATIONS) {
            iteration++;
            maxChange = 0;

            const newRatings = teamsWithRatings.map(team => {
                let totalOppRating = 0;
                let oppCount = 0;

                (team.games || []).forEach((g: any) => {
                    const opp = teamMap.get(g.opponent);
                    if (opp) {
                        totalOppRating += opp.srsRating;
                        oppCount++;
                    }
                });

                const avgOppRating = oppCount > 0 ? totalOppRating / oppCount : 0;
                const newSRS = team.avgNetRating + avgOppRating;
                const change = Math.abs(newSRS - team.srsRating);
                if (change > maxChange) maxChange = change;
                return { abbreviation: team.abbreviation, newSRS };
            });

            newRatings.forEach(update => {
                const team = teamMap.get(update.abbreviation);
                team.srsRating = update.newSRS;
            });

            // Center ratings around 0
            const ratings = teamsWithRatings.map(t => t.srsRating);
            const meanSRS = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
            teamsWithRatings.forEach(t => t.srsRating -= meanSRS);
        }

        // Blended and Save
        const batch = db.batch();
        teamsWithRatings.forEach(team => {
            // Recency (Last 10 linear decay)
            const last10 = team.netRatings.slice(-10);
            let weightedRecent = 0;
            let totalW = 0;
            last10.forEach((nr: number, i: number) => {
                const w = (i + 1) / last10.length;
                weightedRecent += nr * w;
                totalW += w;
            });
            const recencyRating = totalW > 0 ? weightedRecent / totalW : team.srsRating;

            const blendedRating = (team.srsRating * WEIGHT_SEASON) + (recencyRating * WEIGHT_RECENCY);

            team.recencyRating = recencyRating;
            team.blendedRating = blendedRating;

            const ref = db.collection('ncaam_team_stats').doc(team.abbreviation);
            batch.update(ref, {
                'powerRatings': {
                    srsRating: team.srsRating,
                    recencyRating,
                    blendedRating,
                    avgPace: team.avgPace,
                    avgORB: team.avgORB,
                    avgDRB: team.avgDRB,
                    calculatedAt: new Date().toISOString()
                }
            });
        });

        await batch.commit();

        const sortedTeams = [...teamsWithRatings].sort((a, b) => b.blendedRating - a.blendedRating);
        const topTeams = sortedTeams.slice(0, 10).map(t => ({
            team: t.teamName,
            abbreviation: t.abbreviation,
            logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/scoreboard/${t.abbreviation}.png`,
            rating: t.blendedRating.toFixed(2),
            srs: t.srsRating.toFixed(2),
            recency: t.recencyRating?.toFixed(2) || '0.00',
            pace: t.avgPace.toFixed(1),
            orb: t.avgORB.toFixed(1),
            drb: t.avgDRB.toFixed(1)
        }));

        return NextResponse.json({
            success: true,
            iterations: iteration,
            topTeams
        });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
