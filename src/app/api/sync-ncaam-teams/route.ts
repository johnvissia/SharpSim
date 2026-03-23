// src/app/api/sync-ncaam-teams/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { ncaamPower4Ids } from '@/lib/ncaam-teams';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

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

interface GameResult {
    gameNumber: number;
    date: string;
    isHome: boolean;
    isNeutral: boolean;
    opponent: string;
    result: 'W' | 'L';
    teamScore: number;
    opponentScore: number;
    margin: number;
    adjustedMargin: number;
    boxScore?: BoxScore;
    daysRest: number;
}

const HCA_NET = 3.0;
const BLOWOUT_CAP = 25;

function calculateAdjustedMargin(margin: number): number {
    const absMargin = Math.abs(margin);
    const capped = absMargin * (BLOWOUT_CAP / (BLOWOUT_CAP + absMargin));
    return margin > 0 ? capped : -capped;
}

function parseStat(stat: string): { made: number; attempted: number } {
    if (!stat || !stat.includes('-')) return { made: 0, attempted: 0 };
    const [made, attempted] = stat.split('-').map(Number);
    return { made, attempted };
}

async function fetchGameBoxScore(gameId: string, teamId: string): Promise<BoxScore | null> {
    try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${gameId}`, {
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const data = await res.json();

        const teamBox = data.boxscore?.teams?.find((t: any) => t.team.id === teamId);
        const oppBox = data.boxscore?.teams?.find((t: any) => t.team.id !== teamId);

        if (!teamBox || !oppBox) return null;

        const getStat = (box: any, label: string) => {
            const s = box.statistics?.find((st: any) => st.label === label || st.name === label);
            return s?.displayValue || "0";
        };

        const teamFG = parseStat(getStat(teamBox, 'fieldGoalsMade-fieldGoalsAttempted'));
        const teamFT = parseStat(getStat(teamBox, 'freeThrowsMade-freeThrowsAttempted'));
        const oppFG = parseStat(getStat(oppBox, 'fieldGoalsMade-fieldGoalsAttempted'));
        const oppFT = parseStat(getStat(oppBox, 'freeThrowsMade-freeThrowsAttempted'));

        return {
            FG: teamFG.made,
            FGA: teamFG.attempted,
            FTA: teamFT.attempted,
            ORB: parseInt(getStat(teamBox, 'offensiveRebounds')),
            DRB: parseInt(getStat(teamBox, 'defensiveRebounds')),
            TOV: parseInt(getStat(teamBox, 'turnovers')),
            oppFG: oppFG.made,
            oppFGA: oppFG.attempted,
            oppFTA: oppFT.attempted,
            oppORB: parseInt(getStat(oppBox, 'offensiveRebounds')),
            oppDRB: parseInt(getStat(oppBox, 'defensiveRebounds')),
            oppTOV: parseInt(getStat(oppBox, 'turnovers')),
            teamDRB: parseInt(getStat(teamBox, 'defensiveRebounds'))
        };
    } catch (e) {
        console.warn(`Failed to fetch box score for game ${gameId}`, e);
        return null;
    }
}

async function scrapeTeamNCAAM(teamName: string, teamId: string) {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/schedule`, {
        cache: 'no-store'
    });
    if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);

    const data = await res.json();
    const events = data.events || [];
    const abbreviation = data.team?.abbreviation || 'N/A';

    const rawGames = [];
    let prevDate: string | null = null;

    for (const event of events) {
        const comp = event.competitions?.[0];
        if (!comp) continue;

        const status = event.status?.type?.name || comp.status?.type?.name;
        if (status !== 'STATUS_FINAL') continue;

        const teamComp = comp.competitors.find((c: any) => c.id === teamId);
        const oppComp = comp.competitors.find((c: any) => c.id !== teamId);
        if (!teamComp || !oppComp) continue;

        const date = event.date;
        const isHome = teamComp.homeAway === 'home';
        const isNeutral = comp.neutralSite === true;
        const teamScore = parseInt(teamComp.score?.value || '0');
        const opponentScore = parseInt(oppComp.score?.value || '0');
        const margin = teamScore - opponentScore;

        let adjustedMargin = calculateAdjustedMargin(margin);
        if (!isNeutral) {
            adjustedMargin = isHome ? adjustedMargin - HCA_NET : adjustedMargin + HCA_NET;
        }

        let daysRest = 99;
        if (prevDate) {
            const d1 = new Date(date);
            const d2 = new Date(prevDate);
            daysRest = Math.max(0, Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)) - 1);
        }

        rawGames.push({
            id: event.id,
            gameNumber: rawGames.length + 1,
            date,
            isHome,
            isNeutral,
            opponent: oppComp.team.abbreviation,
            result: margin > 0 ? ('W' as const) : ('L' as const),
            teamScore,
            opponentScore,
            margin,
            adjustedMargin,
            daysRest
        });

        prevDate = date;
    }

    // Fetch box scores in parallel for this team (cap at 10 at a time to be safe)
    const BATCH_SIZE = 5;
    const games: GameResult[] = [];

    for (let i = 0; i < rawGames.length; i += BATCH_SIZE) {
        const batch = rawGames.slice(i, i + BATCH_SIZE);
        const boxResults = await Promise.all(batch.map(g => fetchGameBoxScore(g.id, teamId)));

        batch.forEach((g, idx) => {
            games.push({
                ...g,
                boxScore: boxResults[idx] || undefined
            });
        });
        // Tiny pause between batches
        await new Promise(r => setTimeout(r, 50));
    }

    const totalGames = games.length;
    const wins = games.filter(g => g.result === 'W').length;
    const losses = totalGames - wins;
    const avgAdjustedMargin = totalGames > 0 ? games.reduce((sum, g) => sum + g.adjustedMargin, 0) / totalGames : 0;

    let rollingMOV = 0;
    const recent = games.slice(-10);
    if (recent.length > 0) {
        let weightedSum = 0;
        let totalWeight = 0;
        recent.forEach((g, i) => {
            const w = i + 1;
            weightedSum += g.adjustedMargin * w;
            totalWeight += w;
        });
        rollingMOV = weightedSum / totalWeight;
    }

    return {
        teamName,
        abbreviation,
        summary: {
            totalGames,
            wins,
            losses,
            avgAdjustedMargin,
            rollingMOV
        },
        games,
        scrapedAt: new Date().toISOString()
    };
}

export async function POST(request: NextRequest) {
    try {
        const { teamId, all, batch } = await request.json().catch(() => ({}));

        let teamsToProcess: [string, string][] = [];

        const allTeams = Object.entries(ncaamPower4Ids);

        if (all || batch) {
            if (batch) {
                const start = (batch - 1) * 10;
                teamsToProcess = allTeams.slice(start, start + 10);
            } else {
                // If all is true but no batch, just take first 10 to prevent timeout
                teamsToProcess = allTeams.slice(0, 10);
            }
        } else if (teamId) {
            teamsToProcess = allTeams.filter(([_, id]) => id === teamId);
        }

        if (teamsToProcess.length === 0) {
            return NextResponse.json({ error: 'No teams to process' }, { status: 400 });
        }

        const synced = [];
        for (const [name, id] of teamsToProcess) {
            console.log(`Syncing ${name}...`);
            const data = await scrapeTeamNCAAM(name, id);
            const ref = db.collection('ncaam_team_stats').doc(data.abbreviation);
            await ref.set(data);
            synced.push(data.abbreviation);
            await new Promise(r => setTimeout(r, 200));
        }

        return NextResponse.json({
            success: true,
            synced,
            batch,
            totalTeams: allTeams.length,
            successCount: synced.length
        });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
