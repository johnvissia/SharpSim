import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { sportKeyMapping } from '@/lib/sports';

export async function GET() {
    try {
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

            const batch = db.batch();
            data.forEach((game: any) => {
                const gameData = {
                    id: game.id,
                    sportKey: game.sport_key,
                    commenceTime: game.commence_time,
                    homeTeam: game.home_team,
                    awayTeam: game.away_team,
                    bookmakerOdds: game.bookmakers?.map((b: any) => JSON.stringify(b)) || [],
                };
                const gameRef = db.collection('daily_games').doc(game.id);
                batch.set(gameRef, gameData);
                totalGames++;
            });
            await batch.commit();
            console.log(`Saved ${data.length} games for ${sport}`);
        }

        return NextResponse.json({ success: true, totalGames });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ success: false, error: err.message });
    }
}
