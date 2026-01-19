export type Player = {
  id: string;
  name: string;
  position: string;
  injuryStatus: 'Healthy' | 'Questionable' | 'Out';
};

export type Team = {
  id:string;
  name: string;
  logo: string; // URL to logo
  players: Player[];
  rank?: number;
  conference?: string;
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

export type SportName = 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'Soccer' | 'WNBA' | 'NCAAF' | 'NCAAM' | 'NCAAW';

export type Game = {
  id: string;
  sport: SportName;
  startTime: string; // ISO 8601 string
  homeTeam: Team;
  awayTeam: Team;
  odds?: Odds; // This will be the "best" line for display
  allOdds?: SportsbookOdds[];
  liveScore?: { home: number; away: number };
};

export type Sport = {
  id: string;
  name: SportName;
};

// Types from backend.json for Firestore
export interface UserProfile {
  uid: string;
  isAnonymous: boolean;
  balance: number;
  createdAt: any; // Firestore ServerTimestamp
  lastCoinCollection?: string; // ISO 8601 string
}

export interface UserBet {
  id: string;
  gameId: string;
  userId: string;
  sport: SportName;
  betType: 'moneyline' | 'spread' | 'total' | 'parlay';
  pick: string; // e.g., "Golden State Warriors" or "Over 220.5"
  matchup?: string; // e.g. "Team A @ Team B"
  stake: number;
  odds: number;
  potentialWinnings: number;
  status: 'pending' | 'won' | 'lost' | 'push';
  placedAt: string; // ISO 8601 string
  commenceTime?: string; // ISO 8601 string
};

export interface DailyGame {
  id: string;
  sportKey: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmakerOdds: string[];
  isMock?: boolean;
}

export interface CompletedGame {
  id: string;
  sportKey: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface SystemStatus {
  last_updated_date: string;
}

export interface TeamRanking {
  teamName: string;
  rank: number;
  conference: string;
}
