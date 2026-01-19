'use server';

import type { Game, SportName, Team } from './types';

// Minimal types for ESPN Scoreboard API response
interface EspnCompetitor {
    id: string;
    uid: string;
    type: string;
    order: number;
    homeAway: 'home' | 'away';
    winner: boolean;
    team: {
        id: string;
        uid: string;
        location: string;
        name: string;
        abbreviation: string;
        displayName: string;
        shortDisplayName: string;
        color: string;
        alternateColor: string;
        logo: string;
    };
    score: string;
    linescores: { value: number }[];
    record: { name: string; abbreviation: string; summary: string }[];
}

interface EspnCompetition {
    id: string;
    uid: string;
    date: string;
    competitors: EspnCompetitor[];
    status: {
        clock: number;
        displayClock: string;
        period: number;
        type: {
            id: string;
            name: string;
            state: 'pre' | 'in' | 'post';
            completed: boolean;
            description: string;
            detail: string;
            shortDetail: string;
        };
    };
}

interface EspnEvent {
    id: string;
    uid: string;
    date: string;
    name: string;
    shortName: string;
    season: { year: number; type: number; slug: string };
    competitions: EspnCompetition[];
    status: EspnCompetition['status'];
}

interface EspnScoreboard {
    leagues: {
        id: string;
        uid: string;
        name: string;
        abbreviation: string;
        slug: string;
    }[];
    events: EspnEvent[];
}

const mapEspnEventToGame = (event: EspnEvent, sport: SportName): Game | null => {
    const competition = event.competitions[0];
    if (!competition) return null;

    const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
    const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

    if (!homeCompetitor || !awayCompetitor) return null;

    const homeTeam: Team = {
        id: homeCompetitor.team.id,
        name: homeCompetitor.team.displayName,
        logo: homeCompetitor.team.logo,
        players: [], // Not available from scoreboard
        rank: undefined, // Not directly available
        conference: undefined, // Not available
    };

    const awayTeam: Team = {
        id: awayCompetitor.team.id,
        name: awayCompetitor.team.displayName,
        logo: awayCompetitor.team.logo,
        players: [],
        rank: undefined,
        conference: undefined,
    };

    return {
        id: event.id,
        sport: sport,
        startTime: event.date,
        homeTeam,
        awayTeam,
        liveScore: {
            home: parseInt(homeCompetitor.score, 10) || 0,
            away: parseInt(awayCompetitor.score, 10) || 0,
        },
        statusDetail: competition.status.type.shortDetail,
        // Odds data will be merged in later
    };
};

export async function fetchEspnSchedule(): Promise<Game[]> {
    const endpoints = [
        { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'NBA' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', sport: 'NFL' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', sport: 'NCAAM' as SportName },
    ];

    try {
        const responses = await Promise.all(
            endpoints.map(endpoint => fetch(endpoint.url).then(res => res.json() as Promise<EspnScoreboard>))
        );

        const allGames: Game[] = [];

        responses.forEach((scoreboard, index) => {
            const { sport } = endpoints[index];
            if (scoreboard.events) {
                const games = scoreboard.events
                    .map(event => mapEspnEventToGame(event, sport))
                    .filter((g): g is Game => g !== null);
                allGames.push(...games);
            }
        });

        return allGames;
    } catch (error) {
        console.error("Failed to fetch ESPN schedule:", error);
        return []; // Return empty array on failure
    }
}
