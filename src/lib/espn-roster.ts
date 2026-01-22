'use server';

import type { Player } from './types';

interface EspnRosterAthlete {
    id: string;
    displayName: string;
    position: {
        abbreviation: string;
    };
}

interface EspnTeamRoster {
    athletes: EspnRosterAthlete[];
}

async function fetchRosterForTeam(teamId: string): Promise<Player[]> {
    if (!teamId) return [];
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
        const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
        if (!response.ok) {
            console.error(`Failed to fetch roster for team ${teamId}: ${response.statusText}`);
            return [];
        }
        const data: EspnTeamRoster = await response.json();
        
        return data.athletes.map(athlete => ({
            id: athlete.id,
            name: athlete.displayName,
            position: athlete.position.abbreviation,
            injuryStatus: 'Healthy', // This info is in another part of the payload, simplifying for now
        }));
    } catch (error) {
        console.error(`Error fetching roster for team ${teamId}:`, error);
        return [];
    }
}

export async function getTeamRosters(homeTeamId: string, awayTeamId: string): Promise<{ home: Player[], away: Player[] }> {
    const [homeRoster, awayRoster] = await Promise.all([
        fetchRosterForTeam(homeTeamId),
        fetchRosterForTeam(awayTeamId)
    ]);
    return {
        home: homeRoster,
        away: awayRoster,
    };
}
