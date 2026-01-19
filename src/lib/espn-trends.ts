'use server';

import type { TeamTrend } from './types';

// Minimal types for ESPN Schedule API response
interface EspnScheduleCompetitor {
    id: string;
    uid: string;
    type: string;
    order: number;
    homeAway: 'home' | 'away';
    winner: boolean;
    team: {
        id: string;
        abbreviation: string;
        displayName: string;
        logo: string;
    };
    score: {
        value: number;
    };
}

interface EspnScheduleOdd {
    provider: { name: string, id: string };
    details: string; // e.g., "LAL -7.5"
    overUnder: number;
}

interface EspnScheduleCompetition {
    id: string;
    date: string;
    competitors: EspnScheduleCompetitor[];
    status: {
        type: {
            completed: boolean;
        }
    };
    odds?: EspnScheduleOdd[];
}

interface EspnScheduleEvent {
    id: string;
    date: string;
    name: string;
    competitions: EspnScheduleCompetition[];
}

interface EspnTeamSchedule {
    team: { displayName: string };
    season: { type: number, year: number };
    events: EspnScheduleEvent[];
}

// Main fetch function
export async function fetchTeamTrends(teamId: string): Promise<TeamTrend[]> {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`;

    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
    if (!response.ok) {
        throw new Error('Failed to fetch team schedule from ESPN.');
    }

    const scheduleData: EspnTeamSchedule = await response.json();

    const completedGames = scheduleData.events
        .filter(event => event.competitions[0]?.status?.type.completed)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    return completedGames.map(event => {
        const competition = event.competitions[0];
        const myTeam = competition.competitors.find(c => c.id === teamId)!;
        const opponent = competition.competitors.find(c => c.id !== teamId)!;

        const myScore = myTeam.score.value;
        const opponentScore = opponent.score.value;

        // ATS and O/U Logic
        let atsResult: TeamTrend['ats'] = 'N/A';
        let ouResult: TeamTrend['ou'] = 'N/A';
        const odds = competition.odds?.find(o => o.provider.name.toLowerCase() === 'consensus');

        if (odds) {
            // O/U
            const totalScore = myScore + opponentScore;
            if (odds.overUnder) {
                if (totalScore > odds.overUnder) ouResult = 'Over';
                else if (totalScore < odds.overUnder) ouResult = 'Under';
                else ouResult = 'Push';
            }


            // ATS
            if (odds.details) {
                if (odds.details.toUpperCase() === 'EVEN') {
                    atsResult = 'Push';
                } else {
                    const parts = odds.details.split(' ');
                    if (parts.length >= 2) {
                        const favoriteAbbrev = parts[0];
                        const spread = parseFloat(parts[1]);

                        if (!isNaN(spread)) {
                             const myTeamSpread = myTeam.team.abbreviation === favoriteAbbrev ? spread : -spread;
                            const margin = myScore - opponentScore;

                            if (margin + myTeamSpread > 0) atsResult = 'Cover';
                            else if (margin + myTeamSpread < 0) atsResult = 'No Cover';
                            else atsResult = 'Push';
                        }
                    }
                }
            }
        }

        return {
            date: new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            opponent: {
                name: opponent.team.displayName,
                logo: opponent.team.logo,
                at: myTeam.homeAway === 'home' ? 'vs' : '@',
            },
            result: myTeam.winner ? 'W' : 'L',
            score: `${myScore}-${opponentScore}`,
            ats: atsResult,
            ou: ouResult,
        };
    });
}
