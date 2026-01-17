// Map sport names from mock data to API keys for The Odds API
export const sportKeyMapping: { [key: string]: string } = {
    'NBA': 'basketball_nba',
    'NFL': 'americanfootball_nfl',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'Soccer': 'soccer_epl', // Example, can be other leagues
    'WNBA': 'basketball_wnba',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAM': 'basketball_ncaab',
    // No direct mapping for NCAAW in Odds API free tier
};
