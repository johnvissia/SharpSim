import { SportName } from "./types";

export const sportKeyMapping: { [key: string]: string } = {
    'NBA': 'basketball_nba',
    'NFL': 'americanfootball_nfl',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'EPL': 'soccer_epl',
    'MLS': 'soccer_usa_mls',
    'UCL': 'soccer_uefa_champs_league',
    'Liga MX': 'soccer_mexico_ligamx',
    'WNBA': 'basketball_wnba',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAM': 'basketball_ncaab',
};

// Create a reverse mapping to get SportName from sport_key
export const sportNameMapping: { [key: string]: SportName | undefined } = Object.entries(sportKeyMapping).reduce((acc, [name, key]) => {
    acc[key] = name as SportName;
    return acc;
}, {} as { [key: string]: SportName });
