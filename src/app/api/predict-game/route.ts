import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// Initialize Firebase Admin
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

const HCA_NET = 2.3;
const REPLACEMENT_BPM_STAR = 0;
const REPLACEMENT_BPM_STARTER = -2.0;
const REPLACEMENT_BPM_BENCH = -4.0;
const INJURY_DAMPING = 0.75;

// Map team names to ESPN IDs for injury fetching
const espnTeamIds: Record<string, string> = {
    'Atlanta Hawks': '1', 'Boston Celtics': '2', 'Brooklyn Nets': '17', 'Charlotte Hornets': '30',
    'Chicago Bulls': '4', 'Cleveland Cavaliers': '5', 'Dallas Mavericks': '6', 'Denver Nuggets': '7',
    'Detroit Pistons': '8', 'Golden State Warriors': '9', 'Houston Rockets': '10', 'Indiana Pacers': '11',
    'LA Clippers': '12', 'Los Angeles Clippers': '12', 'Los Angeles Lakers': '13', 'Memphis Grizzlies': '29',
    'Miami Heat': '14', 'Milwaukee Bucks': '15', 'Minnesota Timberwolves': '16', 'New Orleans Pelicans': '3',
    'New York Knicks': '18', 'Oklahoma City Thunder': '25', 'Orlando Magic': '19', 'Philadelphia 76ers': '20',
    'Phoenix Suns': '21', 'Portland Trail Blazers': '22', 'Sacramento Kings': '23', 'San Antonio Spurs': '24',
    'Toronto Raptors': '28', 'Utah Jazz': '26', 'Washington Wizards': '27',
    // Short names just in case
    'Hawks': '1', 'Celtics': '2', 'Nets': '17', 'Hornets': '30', 'Bulls': '4', 'Cavaliers': '5',
    'Mavericks': '6', 'Nuggets': '7', 'Pistons': '8', 'Warriors': '9', 'Rockets': '10', 'Pacers': '11',
    'Clippers': '12', 'Lakers': '13', 'Grizzlies': '29', 'Heat': '14', 'Bucks': '15', 'Timberwolves': '16',
    'Pelicans': '3', 'Knicks': '18', 'Thunder': '25', 'Magic': '19', '76ers': '20', 'Suns': '21',
    'Trail Blazers': '22', 'Blazers': '22', 'Kings': '23', 'Spurs': '24', 'Raptors': '28', 'Jazz': '26', 'Wizards': '27'
};

async function getTeamStats(abbrevOrName: string) {
    const snapshot = await db.collection('nba_team_stats').where('teamName', '==', abbrevOrName).limit(1).get();
    if (!snapshot.empty) return snapshot.docs[0].data();

    const doc = await db.collection('nba_team_stats').doc(abbrevOrName).get();
    if (doc.exists) return doc.data();

    // Try finding by ID if possible or fuzzy match? 
    // For now require exact match or sync will fail
    return null;
}

// Fetch injuries specifically for a team from ESPN
async function fetchTeamInjuries(teamName: string) {
    const teamId = espnTeamIds[teamName];
    if (!teamId) {
        console.warn(`No ESPN ID for ${teamName}, skipping injury check.`);
        return [];
    }

    try {
        // Use team endpoint which often has injury report
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`);
        if (!res.ok) return [];
        const data = await res.json();
        const athletes = data.athletes || [];

        const injuries = [];
        for (const player of athletes) {
            if (player.injuries && player.injuries.length > 0) {
                const status = player.injuries[0].status; // e.g. "Out", "Questionable"
                // Map to simplified status
                let simpleStatus = 'ACTIVE';
                if (status.includes('Out') || status.includes('IR')) simpleStatus = 'OUT';
                else if (status.includes('Questionable') || status.includes('Doubtful')) simpleStatus = 'GTD';

                if (simpleStatus !== 'ACTIVE') {
                    // Estimate BPM/Importance based on roster slot or simple lookup?
                    // In a real app we need a player database.
                    // Heuristic: "STAR" if salary > X or specific notable names?
                    // For this demo, let's assume everyone is 'Starter' unless we identify them.
                    // Or just use the 'tier' passed from the User prompt if possible? No.

                    // Quick & Dirty Logic for "Star" detection (Top 50 names hardcoded or just 'Starter')
                    // Let's default to Starter (-2.0)


                    // Keep relevant details for Salary logic
                    injuries.push({
                        name: player.displayName,
                        status: simpleStatus,
                        rawDate: player.injuries[0].date, // Capture date for 'BakedIn' check
                        playerObj: player // Pass full object to access contracts
                    });
                }
            }
        }
        return injuries;
    } catch (e) {
        console.warn(`Failed to fetch injuries from ESPN for ${teamName}`, e);
        return [];
    }
}

// Helper to determine impact based on salary
function getPlayerImpactAndTier(player: any): { impact: number; tier: string } {
    const salaryObj = player.contracts?.find((c: any) => c.season?.year === 2026 || c.season?.current);
    const salary = salaryObj?.salary || 0; // Default 0 if unknown

    // Tier thresholds (approximate for 2025-26 caps)
    if (salary > 25000000) return { impact: 4.2, tier: 'Star' };
    if (salary > 16000000) return { impact: 2.5, tier: 'High Starter' };
    if (salary > 8000000) return { impact: 1.5, tier: 'Starter' };
    if (salary > 3000000) return { impact: 0.8, tier: 'Rotation' };

    return { impact: 0.3, tier: 'Bench' }; // Minimum impact
}

// Helper: Check if injury is long-term (baked into SRS)
function isInjuryBakedIn(injuryDateStr: string): boolean {
    if (!injuryDateStr) return false;
    const injDate = new Date(injuryDateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - injDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // If injured > 30 days ago, assume market/SRS has adjusted
    return diffDays > 30;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const homeName = searchParams.get('home');
    const awayName = searchParams.get('away');
    const marketSpread = parseFloat(searchParams.get('marketSpread') || '0');

    if (!homeName || !awayName) {
        return NextResponse.json({ error: 'Missing home or away team name' }, { status: 400 });
    }

    try {
        const homeStats = await getTeamStats(homeName);
        const awayStats = await getTeamStats(awayName);

        if (!homeStats || !awayStats) {
            // Fallback: If stats missing, use 0 baseline but allow injury check to proceed
        }

        const homeBaseline = homeStats?.powerRatings?.blendedRating || homeStats?.summary?.avgAdjustedMargin || 0;
        const awayBaseline = awayStats?.powerRatings?.blendedRating || awayStats?.summary?.avgAdjustedMargin || 0;

        // Fetch LIVE injuries
        const homeInjuriesList = await fetchTeamInjuries(homeName);
        const awayInjuriesList = await fetchTeamInjuries(awayName);

        const calculateInjuryPenalty = (injuries: any[]) => {
            const impactfulInjuries: any[] = [];
            let totalPenalty = 0;

            if (!injuries) return { impactfulInjuries, totalPenalty };

            injuries.forEach((inj: any) => {
                // Determine Status
                const status = inj.status.toUpperCase();
                // Filter active or probable
                if (status === 'ACTIVE' || status === 'PROBABLE') return;

                // Check for "Season" ending or long term
                if (isInjuryBakedIn(inj.rawDate)) {
                    // Skip penalty if baked in
                    return;
                }

                // Determine Impact via Salary
                const { impact, tier } = getPlayerImpactAndTier(inj.playerObj);

                // Weight by status certainty
                let weight = 1.0;
                if (status === 'GTD' || status === 'QUESTIONABLE') weight = 0.5;
                if (status === 'DOUBTFUL') weight = 0.75;

                const finalImpact = impact * weight;

                if (finalImpact > 0.4) {
                    impactfulInjuries.push({
                        name: inj.name,
                        status: inj.status,
                        impact: -finalImpact,
                        tier: tier,
                        bakedIn: false
                    });
                    totalPenalty -= finalImpact;
                }
            });
            return { impactfulInjuries, totalPenalty };
        };

        const homeInj = calculateInjuryPenalty(homeInjuriesList);
        const awayInj = calculateInjuryPenalty(awayInjuriesList);

        const homeFinalTPR = homeBaseline + homeInj.totalPenalty;
        const awayFinalTPR = awayBaseline + awayInj.totalPenalty;

        // Projected Spread: (Home - Away + HCA) * -1
        // Example: Home (-13) - Away (-1) + 2.3 = -9.7 (Home is 9.7 worse?) No
        // TPR is "Points above average".
        // Baseline: Home +1.07. Away -0.08.
        // HCA: +2.3 for Home.
        // Gap = (1.07) - (-0.08) + 2.3 = 3.45 (Home favored by 3.45)
        // Line should be Home -3.45.

        const rawGap = homeFinalTPR - awayFinalTPR + HCA_NET;
        const projectedSpread = -rawGap;

        // Correct Edge Calculation
        // Market: Home -3.0 (Input: -3.0)
        // Model: Home -10.0 (Input: -10.0)
        // Edge: Model - Market?
        // If Model says -10 (Favored by 10) and Market says -3 (Favored by 3).
        // You want to bet Home. Edge is 7 points.
        // Formula: Market - Model (since negative is good)
        // -3 - (-10) = +7. Correct.
        // Wait, normally Edge = |Model - Market| implies magnitude. 
        // Direction matters.
        // Let's calculate simple difference.

        const edge = marketSpread - projectedSpread;
        // Ex: Market -3, Project -10 -> Edge +7 (Positive means value on Home covering)
        // Ex: Market -3, Project +2 (Dog) -> Edge -5 (Negative means avoid Home/Bet Away)

        // Recommendation Logic
        let rec = "";
        const absEdge = Math.abs(edge);

        if (absEdge > 2.0) {
            const side = edge > 0 ? homeName : awayName;
            rec = `High Value. The model projects a ${absEdge.toFixed(1)} pt edge on ${side}. `;
            if (homeInj.totalPenalty < -2 || awayInj.totalPenalty < -2) {
                rec += "Market may be under-reacting to key injuries.";
            } else {
                rec += "Baseline metrics show a significant disparity.";
            }
        } else {
            rec = "Fair Value. Market lines align within standard variance.";
        }

        return NextResponse.json({
            homeTeam: homeName,
            awayTeam: awayName,
            homeBaseline,
            awayBaseline,
            homeInjuries: homeInj.impactfulInjuries,
            awayInjuries: awayInj.impactfulInjuries,
            homeTotalPenalty: homeInj.totalPenalty,
            awayTotalPenalty: awayInj.totalPenalty,
            homeFinalTPR,
            awayFinalTPR,
            projectedSpread,
            marketSpread,
            edge: absEdge, // Return magnitude for UI
            recommendation: rec,
            hca: HCA_NET
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
