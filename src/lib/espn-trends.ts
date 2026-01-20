'use server';

import type { TeamTrend } from './types';
import { differenceInCalendarDays } from 'date-fns';

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
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const trends: TeamTrend[] = completedGames.map((event, index, allCompleted) => {
        const competition = event.competitions[0];
        const myTeam = competition.competitors.find(c => c.id === teamId)!;
        const opponent = competition.competitors.find(c => c.id !== teamId)!;

        const myScore = myTeam.score.value;
        const opponentScore = opponent.score.value;
        const margin = myScore - opponentScore;

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
            if (odds.details && odds.details.toUpperCase() !== 'EVEN') {
                const parts = odds.details.split(' ');
                if (parts.length >= 2) {
                    const favoriteAbbrev = parts[0];
                    const spread = parseFloat(parts[1]);

                    if (!isNaN(spread)) {
                        const myTeamLine = myTeam.team.abbreviation === favoriteAbbrev ? spread : -spread;
                        const coverMargin = margin + myTeamLine;
                        
                        if (coverMargin > 0) atsResult = 'Cover';
                        else if (coverMargin < 0) atsResult = 'No Cover';
                        else atsResult = 'Push';
                    }
                }
            } else if (odds.details && odds.details.toUpperCase() === 'EVEN') {
                 if (margin > 0) atsResult = 'Cover';
                 else if (margin < 0) atsResult = 'No Cover';
                 else atsResult = 'Push';
            }
        }
        
        // Rest days calculation
        let restDays: number | undefined = undefined;
        const previousGame = allCompleted[index + 1];
        if (previousGame) {
            const currentGameDate = new Date(event.date);
            const previousGameDate = new Date(previousGame.date);
            restDays = differenceInCalendarDays(currentGameDate, previousGameDate);
        }


        return {
            date: new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            fullDate: event.date,
            opponent: {
                name: opponent.team.displayName,
                logo: opponent.team.logo,
                at: myTeam.homeAway === 'home' ? 'vs' : '@',
            },
            result: myTeam.winner ? 'W' : 'L',
            score: `${myScore}-${opponentScore}`,
            ats: atsResult,
            ou: ouResult,
            margin,
            restDays,
        };
    }).slice(0, 10);

    return trends;
}
