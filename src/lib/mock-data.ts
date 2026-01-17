import type { Game, Sport, Team, Player, SportsbookOdds } from './types';

const sportsbooks = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Fanatics'] as const;

const createPlayer = (id: string, name: string, position: string, injuryStatus: 'Healthy' | 'Questionable' | 'Out' = 'Healthy'): Player => ({
  id, name, position, injuryStatus
});

const createTeam = (id: string, name: string, record: string, players: Player[]): Team => ({
  id, name, logo: `/logos/${name.toLowerCase().replace(/ /g, '-')}.svg`, record, players
});

// NBA Teams
const warriorsPlayers = [
  createPlayer('p1', 'Stephen Curry', 'PG'),
  createPlayer('p2', 'Klay Thompson', 'SG'),
  createPlayer('p3', 'Draymond Green', 'PF', 'Questionable'),
];
const lakersPlayers = [
  createPlayer('p4', 'LeBron James', 'SF'),
  createPlayer('p5', 'Anthony Davis', 'C'),
  createPlayer('p6', 'Jarred Vanderbilt', 'PF', 'Out'),
];

const warriors = createTeam('t1', 'Golden State Warriors', '46-36', warriorsPlayers);
const lakers = createTeam('t2', 'Los Angeles Lakers', '47-35', lakersPlayers);

// NFL Teams
const chiefsPlayers = [
  createPlayer('p7', 'Patrick Mahomes', 'QB'),
  createPlayer('p8', 'Travis Kelce', 'TE'),
];
const eaglesPlayers = [
  createPlayer('p9', 'Jalen Hurts', 'QB'),
  createPlayer('p10', 'A.J. Brown', 'WR', 'Questionable'),
];
const chiefs = createTeam('t3', 'Kansas City Chiefs', '11-6', chiefsPlayers);
const eagles = createTeam('t4', 'Philadelphia Eagles', '11-6', eaglesPlayers);

const generateOdds = (base: Odds): SportsbookOdds[] => {
  return sportsbooks.map(book => ({
    sportsbook: book,
    odds: {
      moneyline: {
        home: base.moneyline.home + Math.floor(Math.random() * 21) - 10,
        away: base.moneyline.away + Math.floor(Math.random() * 21) - 10,
      },
      spread: {
        points: base.spread.points,
        home: base.spread.home,
        away: base.spread.away,
      },
      total: {
        points: base.total.points,
        over: base.total.over,
        under: base.total.under,
      }
    }
  }));
};

const getBestOdds = (allOdds: SportsbookOdds[]): Odds => {
  // Simplified: just return the first one for now.
  // A real implementation would compare and find the best line for each bet type.
  return allOdds[0].odds;
};


const mockGames: Game[] = [
  {
    id: 'g1',
    sport: 'NBA',
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    awayTeam: lakers,
    homeTeam: warriors,
    allOdds: generateOdds({
      moneyline: { away: 120, home: -140 },
      spread: { points: -2.5, home: -110, away: -110 },
      total: { points: 235.5, over: -110, under: -110 },
    }),
    get odds() { return getBestOdds(this.allOdds) }
  },
  {
    id: 'g2',
    sport: 'NFL',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    awayTeam: eagles,
    homeTeam: chiefs,
    allOdds: generateOdds({
      moneyline: { away: 150, home: -170 },
      spread: { points: -3.5, home: -110, away: -110 },
      total: { points: 51.5, over: -110, under: -110 },
    }),
    get odds() { return getBestOdds(this.allOdds) }
  },
];


const mockSports: Sport[] = [
    { id: 's1', name: 'NBA' },
    { id: 's2', name: 'NFL' },
    { id: 's3', name: 'MLB' },
    { id: 's4', name: 'NHL' },
]

// Simulate API calls
export const getGames = async (): Promise<Game[]> => {
  return new Promise(resolve => setTimeout(() => resolve(mockGames), 500));
};

export const getSports = async (): Promise<Sport[]> => {
    return new Promise(resolve => setTimeout(() => resolve(mockSports), 500));
}

export const getGameById = async (id: string): Promise<Game | undefined> => {
    return new Promise(resolve => setTimeout(() => resolve(mockGames.find(g => g.id === id)), 500));
}
