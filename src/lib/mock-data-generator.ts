import type { DailyGame } from './types';

// Helper to create a realistic bookmaker odds object as a string
const createMockBookmakerOdds = (homeTeam: string, awayTeam: string, homeOdds: number, awayOdds: number, spread: number, total: number) => {
    const bookmaker = {
        key: 'fanduel',
        title: 'FanDuel',
        last_update: new Date().toISOString(),
        markets: [
            {
                key: 'h2h',
                last_update: new Date().toISOString(),
                outcomes: [
                    { name: awayTeam, price: awayOdds },
                    { name: homeTeam, price: homeOdds },
                ],
            },
            {
                key: 'spreads',
                last_update: new Date().toISOString(),
                outcomes: [
                    { name: awayTeam, price: -110, point: -spread },
                    { name: homeTeam, price: -110, point: spread },
                ],
            },
            {
                key: 'totals',
                last_update: new Date().toISOString(),
                outcomes: [
                    { name: 'Over', price: -110, point: total },
                    { name: 'Under', price: -110, point: total },
                ],
            },
        ],
    };
    return JSON.stringify(bookmaker);
};

export function generateMockGames(): DailyGame[] {
    const now = new Date();
    const games: DailyGame[] = [
        // NBA Mock Game
        {
            id: 'mock_nba_1',
            sportKey: 'basketball_nba',
            commenceTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
            homeTeam: 'Golden State Warriors',
            awayTeam: 'Los Angeles Lakers',
            bookmakerOdds: [
                createMockBookmakerOdds('Golden State Warriors', 'Los Angeles Lakers', -150, 130, -3.5, 225.5)
            ],
            isMock: true,
        },
        // NFL Mock Game
        {
            id: 'mock_nfl_1',
            sportKey: 'americanfootball_nfl',
            commenceTime: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(), // Tomorrow
            homeTeam: 'Kansas City Chiefs',
            awayTeam: 'Philadelphia Eagles',
            bookmakerOdds: [
                createMockBookmakerOdds('Kansas City Chiefs', 'Philadelphia Eagles', -175, 155, -3.5, 52.5)
            ],
            isMock: true,
        },
        // NHL Mock Game
        {
            id: 'mock_nhl_1',
            sportKey: 'icehockey_nhl',
            commenceTime: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
            homeTeam: 'Florida Panthers',
            awayTeam: 'Carolina Hurricanes',
            bookmakerOdds: [
                 createMockBookmakerOdds('Florida Panthers', 'Carolina Hurricanes', -125, 105, -1.5, 6.5)
            ],
            isMock: true,
        },
        // NCAAM Mock Game
        {
            id: 'mock_ncaam_1',
            sportKey: 'basketball_ncaab',
            commenceTime: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
            homeTeam: 'Duke Blue Devils',
            awayTeam: 'North Carolina Tar Heels',
            bookmakerOdds: [
                createMockBookmakerOdds('Duke Blue Devils', 'North Carolina Tar Heels', -135, 115, -2.5, 151.5)
            ],
            isMock: true,
        },
        // Soccer Mock Game
        {
            id: 'mock_soccer_1',
            sportKey: 'soccer_epl',
            commenceTime: new Date(now.getTime() + 28 * 60 * 60 * 1000).toISOString(), // Tomorrow
            homeTeam: 'Manchester United',
            awayTeam: 'Liverpool',
            bookmakerOdds: [
                 createMockBookmakerOdds('Manchester United', 'Liverpool', 180, 150, 0.5, 2.5)
            ],
            isMock: true,
        }
    ];
    return games;
}
