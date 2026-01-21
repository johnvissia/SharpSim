'use server';

import type { Game, SportName, Team } from './types';

// Minimal types for ESPN Scoreboard API response
interface EspnLeaderAthlete {
    id: string;
    fullName: string;
    shortName: string;
}
interface EspnPointsLeader {
    displayValue: string;
    athlete: EspnLeaderAthlete;
}
interface EspnLeaderCategory {
    name: 'points' | 'rebounds' | 'assists';
    displayName: string;
    leaders: EspnPointsLeader[];
}
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
        logo?: string;
        logos?: { href: string; rel?: string[] }[];
    };
    score: string;
    linescores: { value: number }[];
    record: { name: string; abbreviation: string; summary: string }[];
    leaders?: EspnLeaderCategory[];
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

export async function fetchEspnSchedule(): Promise<Game[]> {
    const endpoints = [
        { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'NBA' as SportName, slug: 'nba' },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', sport: 'NFL' as SportName, slug: 'nfl' },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', sport: 'NHL' as SportName, slug: 'nhl' },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard', sport: 'NCAAF' as SportName, slug: 'college-football' },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', sport: 'NCAAM' as SportName, slug: 'mens-college-basketball' },
    ];

    try {
        const responses = await Promise.all(
            endpoints.map(endpoint => fetch(endpoint.url, { next: { revalidate: 30 } }).then(res => res.json() as Promise<EspnScoreboard>))
        );

        const allGames: Game[] = [];

        responses.forEach((scoreboard, index) => {
            const endpointInfo = endpoints[index];
            if (scoreboard.events) {
                const games = scoreboard.events
                    .map(event => {
                        const competition = event.competitions[0];
                        if (!competition) return null;

                        const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
                        const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

                        if (!homeCompetitor || !awayCompetitor) return null;

                        const getLeadingScorer = (competitor: EspnCompetitor) => {
                            if (!competitor.leaders) return undefined;
                            const pointsLeaderData = competitor.leaders.find(l => l.name === 'points');
                            if (pointsLeaderData && pointsLeaderData.leaders && pointsLeaderData.leaders.length > 0) {
                                const leader = pointsLeaderData.leaders[0];
                                if (leader.athlete) {
                                    return {
                                        name: leader.athlete.shortName || leader.athlete.fullName,
                                        value: leader.displayValue,
                                    };
                                }
                            }
                            return undefined;
                        };

                        const getLogo = (competitor: EspnCompetitor) => {
                            if (competitor.team.logo) return competitor.team.logo;
                            if (competitor.team.logos && competitor.team.logos.length > 0) {
                                const defaultLogo = competitor.team.logos.find(l => l.rel?.includes('default'));
                                if (defaultLogo) return defaultLogo.href;
                                return competitor.team.logos[0].href;
                            }
                            return '';
                        }
                        
                        let finalSlug = endpointInfo.slug;
                        if (!finalSlug && scoreboard.leagues?.[0]?.slug) {
                            finalSlug = scoreboard.leagues[0].slug;
                        }

                        const homeTeam: Team = {
                            id: homeCompetitor.team.id,
                            name: homeCompetitor.team.displayName,
                            logo: getLogo(homeCompetitor),
                            players: [],
                            rank: undefined,
                            conference: undefined,
                            leadingScorer: getLeadingScorer(homeCompetitor),
                        };

                        const awayTeam: Team = {
                            id: awayCompetitor.team.id,
                            name: awayCompetitor.team.displayName,
                            logo: getLogo(awayCompetitor),
                            players: [],
                            rank: undefined,
                            conference: undefined,
                            leadingScorer: getLeadingScorer(awayCompetitor),
                        };

                        const game: Game = {
                            id: event.id,
                            sport: endpointInfo.sport,
                            sportSlug: finalSlug,
                            startTime: event.date,
                            homeTeam,
                            awayTeam,
                            liveScore: {
                                home: parseInt(homeCompetitor.score, 10) || 0,
                                away: parseInt(awayCompetitor.score, 10) || 0,
                            },
                            statusDetail: competition.status.type.detail,
                            statusState: competition.status.type.state,
                        };
                        return game;

                    })
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
