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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const games: DailyGame[] = [
        // Game 1: Los Angeles Lakers vs. Boston Celtics (NBA)
        {
            id: 'mock_nba_lakers_celtics',
            sportKey: 'basketball_nba',
            commenceTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
            homeTeam: 'Boston Celtics',
            awayTeam: 'Los Angeles Lakers',
            bookmakerOdds: [
                createMockBookmakerOdds('Boston Celtics', 'Los Angeles Lakers', -180, 155, -4.5, 228.5)
            ],
            isMock: true,
        },
        // Game 2: Detroit Lions vs. San Francisco 49ers (NFL)
        {
            id: 'mock_nfl_lions_49ers',
            sportKey: 'americanfootball_nfl',
            commenceTime: tomorrow.toISOString(),
            homeTeam: 'San Francisco 49ers',
            awayTeam: 'Detroit Lions',
            bookmakerOdds: [
                createMockBookmakerOdds('San Francisco 49ers', 'Detroit Lions', -210, 175, -5.5, 48.5)
            ],
            isMock: true,
        },
        // Game 3: Michigan Wolverines vs. Ohio State Buckeyes (NCAAM)
        {
            id: 'mock_ncaam_michigan_ohiostate',
            sportKey: 'basketball_ncaab',
            commenceTime: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
            homeTeam: 'Ohio State Buckeyes',
            awayTeam: 'Michigan Wolverines',
            bookmakerOdds: [
                createMockBookmakerOdds('Ohio State Buckeyes', 'Michigan Wolverines', -140, 120, -2.5, 145.5)
            ],
            isMock: true,
        },
    ];

    console.log("Forcing Mock Games into State:", games);
    return games;
}
