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
    odds?: any[];
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
    const getEspnDateString = (daysOffset = 0) => {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        return date.toISOString().split('T')[0].replace(/-/g, '');
    };
    const todayStr = getEspnDateString(0);
    const yesterdayStr = getEspnDateString(-1);

    const sources = [
        { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'NBA' as SportName, slug: 'nba' },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', sport: 'NFL' as SportName, slug: 'nfl' },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', sport: 'NHL' as SportName, slug: 'nhl' },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard', sport: 'NCAAF' as SportName, slug: 'college-football' },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', sport: 'NCAAM' as SportName, slug: 'mens-college-basketball' },
    ];

    try {
        const promises: Promise<{ data: EspnScoreboard, slug: string, sport: SportName }>[] = [];
        sources.forEach(source => {
            promises.push(fetch(`${source.url}?dates=${todayStr}&limit=100`).then(r => r.json()).then(data => ({ data, slug: source.slug, sport: source.sport })));
            promises.push(fetch(`${source.url}?dates=${yesterdayStr}&limit=100`).then(r => r.json()).then(data => ({ data, slug: source.slug, sport: source.sport })));
        });

        const results = await Promise.all(promises);
        let allGames: Game[] = [];

        results.forEach(({ data, slug, sport }) => {
            if (!data.events) return;

            const sportGames = data.events.map(event => {
                const comp = event.competitions[0];
                if (!comp) return null;
                const home = comp.competitors.find(c => c.homeAway === 'home');
                const away = comp.competitors.find(c => c.homeAway === 'away');
                if (!home || !away) return null;

                const getLogo = (competitor: EspnCompetitor) => {
                    if (competitor.team.logo) return competitor.team.logo;
                    if (competitor.team.logos && competitor.team.logos.length > 0) {
                        const defaultLogo = competitor.team.logos.find(l => l.rel?.includes('default'));
                        if (defaultLogo) return defaultLogo.href;
                        return competitor.team.logos[0].href;
                    }
                    return '';
                };

                const homeTeam: Team = {
                    id: String(home.team.id),
                    name: home.team.displayName,
                    logo: getLogo(home),
                    players: [],
                };

                const awayTeam: Team = {
                    id: String(away.team.id),
                    name: away.team.displayName,
                    logo: getLogo(away),
                    players: [],
                };

                const game: Game = {
                    id: event.id,
                    sport: sport,
                    sportSlug: slug,
                    startTime: event.date,
                    homeTeam,
                    awayTeam,
                    liveScore: {
                        home: parseInt(home.score, 10) || 0,
                        away: parseInt(away.score, 10) || 0,
                    },
                    statusDetail: comp.status.type.detail,
                    statusState: comp.status.type.state,
                };
                return game;
            }).filter((g): g is Game => g !== null);

            allGames.push(...sportGames);
        });

        const uniqueGames = Array.from(new Map(allGames.map(g => [g.id, g])).values());
        console.log(`✅ Refreshed ${uniqueGames.length} games with correct slugs.`);
        return uniqueGames;

    } catch (error) {
        console.error("Failed to fetch ESPN schedule:", error);
        return [];
    }
}
