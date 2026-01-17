import type { Game, Sport, Team, Player, SportsbookOdds, Odds, SportName } from './types';

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

// Soccer teams
const manUtdPlayers = [createPlayer('p11', 'Bruno Fernandes', 'MF'), createPlayer('p12', 'Marcus Rashford', 'FW')];
const liverpoolPlayers = [createPlayer('p13', 'Mohamed Salah', 'FW'), createPlayer('p14', 'Virgil van Dijk', 'DF')];
const manUtd = createTeam('t5', 'Manchester United', '2-1-0', manUtdPlayers);
const liverpool = createTeam('t6', 'Liverpool', '2-0-1', liverpoolPlayers);

// WNBA Teams
const acesPlayers = [createPlayer('p15', 'A\'ja Wilson', 'F'), createPlayer('p16', 'Kelsey Plum', 'G')];
const libertyPlayers = [createPlayer('p17', 'Breanna Stewart', 'F'), createPlayer('p18', 'Sabrina Ionescu', 'G')];
const aces = createTeam('t7', 'Las Vegas Aces', '10-2', acesPlayers);
const liberty = createTeam('t8', 'New York Liberty', '9-3', libertyPlayers);

// NCAAF Teams
const alabamaPlayers = [createPlayer('p19', 'Jalen Milroe', 'QB')];
const georgiaPlayers = [createPlayer('p20', 'Carson Beck', 'QB')];
const alabama = createTeam('t9', 'Alabama Crimson Tide', '3-0', alabamaPlayers);
const georgia = createTeam('t10', 'Georgia Bulldogs', '3-0', georgiaPlayers);


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
  {
    id: 'g3',
    sport: 'Soccer',
    startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    awayTeam: liverpool,
    homeTeam: manUtd,
    allOdds: generateOdds({
      moneyline: { away: 150, home: 180 },
      spread: { points: 0.5, home: -110, away: -110 },
      total: { points: 2.5, over: -120, under: 100 },
    }),
    get odds() { return getBestOdds(this.allOdds) }
  },
  {
    id: 'g4',
    sport: 'WNBA',
    startTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    awayTeam: liberty,
    homeTeam: aces,
    allOdds: generateOdds({
      moneyline: { away: 130, home: -150 },
      spread: { points: -3.0, home: -110, away: -110 },
      total: { points: 170.5, over: -110, under: -110 },
    }),
    get odds() { return getBestOdds(this.allOdds) }
  },
    {
    id: 'g5',
    sport: 'NCAAF',
    startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    awayTeam: alabama,
    homeTeam: georgia,
    allOdds: generateOdds({
      moneyline: { away: 110, home: -130 },
      spread: { points: -2.5, home: -110, away: -110 },
      total: { points: 55.5, over: -110, under: -110 },
    }),
    get odds() { return getBestOdds(this.allOdds) }
  },
];


const mockSports: Sport[] = [
    { id: 's1', name: 'NBA' },
    { id: 's2', name: 'NFL' },
    { id: 's3', name: 'MLB' },
    { id: 's4', name: 'NHL' },
    { id: 's5', name: 'Soccer' },
    { id: 's6', name: 'WNBA' },
    { id: 's7', name: 'NCAAF' },
    { id: 's8', name: 'NCAAM' },
    { id: 's9', name: 'NCAAW' },
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
