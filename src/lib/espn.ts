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
  // Helper: Get formatted date string (YYYYMMDD)
  const getDateStr = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0].replace(/-/g, '');
  };

  const sources = [
    { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', slug: 'nba', sport: 'NBA' as SportName },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', slug: 'nfl', sport: 'NFL' as SportName },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', slug: 'nhl', sport: 'NHL' as SportName },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard', slug: 'college-football', sport: 'NCAAF' as SportName },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', slug: 'mens-college-basketball', sport: 'NCAAM' as SportName },
  ];

  try {
    const promises: Promise<{ data: any, slug: string, sport: SportName }>[] = [];
    sources.forEach(src => {
      promises.push(fetch(`${src.url}?dates=${getDateStr(0)}&limit=100`).then(r => r.json()).then(d => ({ data: d, slug: src.slug, sport: src.sport })));
      promises.push(fetch(`${src.url}?dates=${getDateStr(-1)}&limit=100`).then(r => r.json()).then(d => ({ data: d, slug: src.slug, sport: src.sport })));
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
            return leaderData?.leaders[0]?.displayValue;
        }

        const homeTeam: Team = {
            id: String(getSafeId(home)),
            name: home.team.displayName,
            logo: getLogo(home),
            players: [],
            leadingScorer: getLeader(home, 'points'),
            leadingRebounder: getLeader(home, 'rebounds'),
            leadingAssister: getLeader(home, 'assists'),
        };

        const awayTeam: Team = {
            id: String(getSafeId(away)),
            name: away.team.displayName,
            logo: getLogo(away),
            players: [],
            leadingScorer: getLeader(away, 'points'),
            leadingRebounder: getLeader(away, 'rebounds'),
            leadingAssister: getLeader(away, 'assists'),
        };

        return {
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
      }).filter((g): g is Game => g !== null);

      cleanGames = [...cleanGames, ...mapped];
    });

    const unique = Array.from(new Map(cleanGames.map(g => [g.id, g])).values());
    console.log(`✅ Refreshed ${unique.length} games. Sample ID: ${unique[0]?.homeTeam.id}`);

    return unique;

  } catch (err) {
    console.error("Fetch Error:", err);
    return [];
  }
}
