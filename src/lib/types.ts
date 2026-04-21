export type Player = {
  id: string;
  name: string;
  position: string;
  injuryStatus: 'Healthy' | 'Questionable' | 'Out';
  stats?: {
    leadingScorer?: string;
    leadingRebounder?: string;
    leadingAssister?: string;
  }
};

export type Team = {
  id: string;
  name: string;
  logo: string; // URL to logo
  players: Player[];
  rank?: number;
  conference?: string;
  leadingScorer?: string;
  leadingRebounder?: string;
  leadingAssister?: string;
  startingPitcher?: {
    name: string;
    wins: string | number;
    losses: string | number;
    era: string | number;
  };
};

export type Odds = {
  moneyline: { home: number; away: number };
  spread: { points: number; home: number; away: number };
  total: { points: number; over: number; under: number };
};

export type SportsbookOdds = {
  sportsbook: string;
  odds: Odds;
};

export type SportName = 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'EPL' | 'MLS' | 'UCL' | 'Liga MX' | 'WNBA' | 'NCAAM';

export type Game = {
  id: string;
  oddsApiId?: string;
  sport: SportName;
  sportSlug?: string;
  startTime: string; // ISO 8601 string
  homeTeam: Team;
  awayTeam: Team;
  odds?: Odds; // This will be the "best" line for display
  allOdds?: SportsbookOdds[];
  liveScore?: { home: number; away: number };
  statusDetail?: string; // e.g., "Final", "Q3 10:00" from ESPN
  statusState?: 'pre' | 'in' | 'post';
  leagueContext?: string; // e.g., "English Premier League", "UEFA Champions League"
};

export type Sport = {
  id: string;
  name: SportName;
};

// Types from backend.json for Firestore

export interface ParlayLeg {
  gameId: string;
  matchup: string;
  commenceTime: string;
  pick: string; // The specific selection, e.g., "Los Angeles Lakers"
  betType: 'moneyline' | 'spread' | 'total' | 'player_prop';
  odds: number;
  status: 'pending' | 'won' | 'lost' | 'push'; // Individual leg status
  sport: SportName;
  // Player prop specific fields
  playerId?: string;
  playerName?: string;
  market?: string;
  line?: number;
}

export interface UserProfile {
  uid: string;
  isAnonymous: boolean;
  balance: number;
  createdAt: any; // Firestore ServerTimestamp
  lastCoinCollection?: string; // ISO 8601 string
  favoriteTeams?: string[];
}

export interface UserBet {
  id: string;
  gameId: string;
  userId: string;
  sport: SportName;
  betType: 'moneyline' | 'spread' | 'total' | 'parlay' | 'player_prop';
  pick: string; // e.g., "Golden State Warriors", "Over 220.5", or "4-Leg Parlay"
  matchup?: string; // e.g. "Team A @ Team B"
  stake: number;
  odds: number;
  potentialWinnings: number;
  status: 'pending' | 'won' | 'lost' | 'push';
  placedAt: string; // ISO 8601 string
  commenceTime?: string; // ISO 8601 string
  legs?: ParlayLeg[];
  // Player prop specific fields
  playerId?: string;
  playerName?: string;
  market?: string;
  line?: number;
  // Real money tracking
  sportsbook?: string;
};

export interface DailyGame {
  id: string;
  sportKey: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmakerOdds: string[];
}

export interface CompletedGame {
  id: string;
  sportKey: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  completed?: boolean;
}

export interface SystemStatus {
  last_updated_date: string;
}

export interface TeamRanking {
  teamName: string;
  rank: number;
  conference: string;
}

export interface TeamTrend {
  date: string;
  fullDate: string;
  opponent: {
    name: string;
    logo: string;
    at: '@' | 'vs';
  };
  result: 'W' | 'L' | 'Upcoming';
  score: string; // e.g., "112-105"
  ats: 'Cover' | 'No Cover' | 'Push' | 'N/A';
  ou: 'Over' | 'Under' | 'Push' | 'N/A';
  margin: number;
  restDays?: number;
}

export interface Injury {
  name: string;
  position: string;
  status: string; // e.g., "Out", "Day-to-Day"
  date: string;
}

// Prop Hub Page Types
export interface PlayerProp {
  id: string; // The Firestore doc ID
  gameId: string;
  playerId: string;
  playerName: string;
  teamName: string;
  matchup: string;
  commenceTime: string;
  market: string;
  line: number;
  overOdds: number;
  underOdds: number;
}
