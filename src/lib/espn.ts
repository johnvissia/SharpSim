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
        logo?: string;
        logos?: { href: string; rel?: string[] }[];
    };
    score: string;
    linescores: { value: number }[];
    record: { name: string; abbreviation: string; summary: string }[];
    leaders?: {
        name: string; // e.g., 'points', 'rebounds', 'assists'
        displayName: string;
        shortDisplayName: string;
        abbreviation: string;
        leaders: {
            displayValue: string; // "25.4 PPG"
            value: number;
            athlete: {
                id: string;
                fullName: string;
                displayName: string;
                shortName: string;
            };
        }[];
    }[];
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
    notes?: { type: string; headline: string }[];
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
    // Helper: Get formatted date string (YYYYMMDD) in US/Eastern
    const getDateStr = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);

        // Force US/Eastern to ensure we fetch games matching the current US sports day
        const nyDate = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(d);

        const month = nyDate.find(p => p.type === 'month')?.value;
        const day = nyDate.find(p => p.type === 'day')?.value;
        const year = nyDate.find(p => p.type === 'year')?.value;

        return `${year}${month}${day}`;
    };

    const sources = [
        { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', slug: 'nba', sport: 'NBA' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', slug: 'nfl', sport: 'NFL' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', slug: 'nhl', sport: 'NHL' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', slug: 'mlb', sport: 'MLB' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', slug: 'mens-college-basketball', sport: 'NCAAM' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', slug: 'epl', sport: 'EPL' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard', slug: 'mls', sport: 'MLS' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', slug: 'ucl', sport: 'UCL' as SportName },
        { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/mex.1/scoreboard', slug: 'liga-mx', sport: 'Liga MX' as SportName },
    ];

    try {
        const promises: Promise<{ data: any, slug: string, sport: SportName }>[] = [];
        sources.forEach(src => {
            // Fetch past 4 days, today, and tomorrow to ensure we catch old games for grading
            for (let i = -4; i <= 1; i++) {
                promises.push(fetch(`${src.url}?dates=${getDateStr(i)}&limit=100`, { cache: 'no-store' }).then(r => r.json()).then(d => ({ data: d, slug: src.slug, sport: src.sport })));
            }
        });

        const results = await Promise.all(promises);
        let cleanGames: Game[] = [];

        results.forEach(({ data, slug, sport }) => {
            if (!data.events) return;

            const mapped = data.events.map((event: EspnEvent): Game | null => {
                const comp = event.competitions[0];
                if (!comp) return null;
                const home = comp.competitors.find(c => c.homeAway === 'home');
                const away = comp.competitors.find(c => c.homeAway === 'away');
                if (!home || !away) return null;

                const getSafeId = (competitor: EspnCompetitor) => {
                    const id1 = competitor.id;
                    const id2 = competitor.team?.id;
                    return (id1 && !isNaN(parseInt(id1))) ? id1 : id2;
                };

                const getLogo = (competitor: EspnCompetitor) => {
                    if (competitor.team.logo) return competitor.team.logo;
                    if (competitor.team.logos && competitor.team.logos.length > 0) {
                        const defaultLogo = competitor.team.logos.find(l => l.rel?.includes('default'));
                        if (defaultLogo) return defaultLogo.href;
                        return competitor.team.logos[0].href;
                    }
                    return '';
                };

                const getLeader = (competitor: EspnCompetitor, stat: 'points' | 'rebounds' | 'assists') => {
                    const leaderData = competitor.leaders?.find(l => l.name.toLowerCase() === stat);
                    const leader = leaderData?.leaders[0];
                    if (!leader) return undefined;

                    // displayValue is like "25 PTS" or "10 REB"
                    return `${leader.athlete.displayName} - ${leader.displayValue}`;
                }

                const getPitcher = (competitor: EspnCompetitor) => {
                    const probable = (competitor as any).probables?.[0]; // Types are tricky here as we didn't fully mock probables
                    if (!probable || !probable.athlete) return undefined;

                    const name = probable.athlete.shortName || probable.athlete.displayName;
                    const stats = probable.statistics || [];
                    const wins = stats.find((s: any) => s.name === 'wins')?.displayValue || '0';
                    const losses = stats.find((s: any) => s.name === 'losses')?.displayValue || '0';
                    const era = stats.find((s: any) => s.name === 'ERA')?.displayValue || '0.00';

                    return { name, wins, losses, era };
                };

                const homeTeam: Team = {
                    id: String(getSafeId(home)),
                    name: home.team.displayName,
                    logo: getLogo(home),
                    players: [],
                    leadingScorer: getLeader(home, 'points'),
                    leadingRebounder: getLeader(home, 'rebounds'),
                    leadingAssister: getLeader(home, 'assists'),
                    startingPitcher: sport === 'MLB' ? getPitcher(home) : undefined,
                };

                const awayTeam: Team = {
                    id: String(getSafeId(away)),
                    name: away.team.displayName,
                    logo: getLogo(away),
                    players: [],
                    leadingScorer: getLeader(away, 'points'),
                    leadingRebounder: getLeader(away, 'rebounds'),
                    leadingAssister: getLeader(away, 'assists'),
                    startingPitcher: sport === 'MLB' ? getPitcher(away) : undefined,
                };

                const leagueName = data.leagues?.[0]?.name || '';
                const compNotes = comp.notes?.[0]?.headline || '';
                const leagueContext = [leagueName, compNotes].filter(Boolean).join(' • ');

                return {
                    id: event.id,
                    sport: sport,
                    sportSlug: slug,
                    startTime: event.date,
                    homeTeam,
                    awayTeam,
                    leagueContext: leagueContext,
                    liveScore: {
                        home: parseInt(home.score, 10),
                        away: parseInt(away.score, 10),
                    },
                    statusDetail: comp.status.type.detail,
                    statusState: comp.status.type.state,
                };
            }).filter((g: Game | null): g is Game => g !== null);

            cleanGames = [...cleanGames, ...mapped];
        });

        const unique = Array.from(new Map(cleanGames.map((g: Game) => [g.id, g])).values());
        console.log(`✅ Refreshed ${unique.length} games. Sample ID: ${unique[0]?.homeTeam.id}`);

        return unique;

    } catch (err) {
        console.error("Fetch Error:", err);
        return [];
    }
}

export async function fetchAllTeamLogos(): Promise<Record<string, string>> {
    const sports = [
        'basketball/nba', 'football/nfl', 'hockey/nhl', 'football/college-football', 
        'basketball/mens-college-basketball', 'baseball/mlb',
        'soccer/eng.1', 'soccer/usa.1', 'soccer/uefa.champions', 'soccer/mex.1'
    ];
    const newLogoMap: Record<string, string> = {};
    const promises = sports.map(async (sport) => {
        try {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/teams?limit=1000`, { cache: 'force-cache' });
            if (!res.ok) return;
            const data = await res.json();
            const teams = data?.sports?.[0]?.leagues?.[0]?.teams;
            teams?.forEach((t: any) => {
                const teamData = t.team;
                if (teamData.displayName && teamData.logos && teamData.logos.length > 0) {
                    newLogoMap[teamData.displayName] = teamData.logos[0].href;
                }
            });
        } catch (e) {
            console.error(`Failed to fetch teams for ${sport}`, e);
        }
    });
    await Promise.all(promises);
    return newLogoMap;
}
