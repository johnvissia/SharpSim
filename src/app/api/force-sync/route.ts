import { NextRequest, NextResponse } from 'next/server';
import { resilientSetDoc } from '@/lib/firestore-rest';
import { sportKeyMapping } from '@/lib/sports';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes for syncing odds from 8 sports sequentially

export async function GET(request: NextRequest) {
    try {
        // Auth check (if CRON_SECRET is configured)
        const authHeader = request.headers.get('Authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
        if (!API_KEY) throw new Error("Missing odds API key");

        console.log("=== API ROUTE FORCE SYNC ===");
        let totalGames = 0;

        for (const sport of Object.values(sportKeyMapping)) {
            console.log(`Fetching odds for ${sport}...`);
            const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`);
            if (!res.ok) continue;

            const data = await res.json();
            if (!data || data.length === 0) continue;

            for (const game of data) {
                const gameStart = new Date(game.commence_time).getTime();
                const now = new Date().getTime();
                const timeLimitMs = 15 * 60 * 1000;
                
                // Freeze the Vegas line 15 minutes before the game time
                if (now >= gameStart - timeLimitMs) {
                    continue; // Skip this game to keep the line frozen
                }

                const gameData = {
                    id: game.id,
                    sportKey: game.sport_key,
                    commenceTime: game.commence_time,
                    homeTeam: game.home_team,
                    awayTeam: game.away_team,
                    bookmakerOdds: game.bookmakers?.map((b: any) => JSON.stringify(b)) || [],
                };
                await resilientSetDoc('daily_games', game.id, gameData);
                totalGames++;
            }
            console.log(`Saved ${data.length} games for ${sport}`);
        }

        return NextResponse.json({ success: true, totalGames });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ success: false, error: err.message });
    }
}
