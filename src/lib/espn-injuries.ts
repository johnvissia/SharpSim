'use server';

import type { Injury } from './types';

interface EspnRosterAthlete {
    id: string;
    displayName: string;
    position: {
        abbreviation: string;
    };
    injuries?: {
        status: string;
        date: string;
    }[];
}

interface EspnTeamRoster {
    athletes: EspnRosterAthlete[];
}

async function fetchInjuriesForTeam(teamId: string): Promise<Injury[]> {
    if (!teamId) return [];
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
        const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
        if (!response.ok) {
            console.error(`Failed to fetch roster for team ${teamId}: ${response.statusText}`);
            return [];
        }
        const data: EspnTeamRoster = await response.json();
        
        const injuredPlayers = data.athletes.filter(athlete => athlete.injuries && athlete.injuries.length > 0);
        
        return injuredPlayers.map(athlete => ({
            name: athlete.displayName,
            position: athlete.position.abbreviation,
            status: athlete.injuries![0].status,
            date: athlete.injuries![0].date,
        }));
    } catch (error) {
        console.error(`Error fetching injuries for team ${teamId}:`, error);
        return [];
    }
}

export async function getNotableInjuries(homeTeamId: string, awayTeamId: string): Promise<{ home: Injury[], away: Injury[] }> {
    const [homeInjuries, awayInjuries] = await Promise.all([
        fetchInjuriesForTeam(homeTeamId),
        fetchInjuriesForTeam(awayTeamId)
    ]);
    return {
        home: homeInjuries,
        away: awayInjuries,
    };
}
