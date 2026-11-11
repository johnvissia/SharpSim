import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { sportKeyMapping } from '@/lib/sports';
import { verifyApiAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes for syncing odds from 8 sports sequentially

export async function GET(request: NextRequest) {
    try {
        const authResult = await verifyApiAuth(request);
        if (!authResult.authorized) {
            return authResult.errorResponse!;
        }

        const API_KEY = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
        if (!API_KEY) throw new Error("Missing odds API key");

        console.log("=== API ROUTE FORCE SYNC VIA ADMIN SDK ===");
        let totalGames = 0;

        for (const sport of Object.values(sportKeyMapping)) {
            console.log(`Fetching odds for ${sport}...`);
            const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`);
            if (!res.ok) continue;

            const data = await res.json();
            if (!data || data.length === 0) continue;

            const batch = db.batch();
            let batchCount = 0;

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

                const docRef = db.collection('daily_games').doc(game.id);
                batch.set(docRef, gameData, { merge: true });
                batchCount++;
                totalGames++;

                if (batchCount >= 400) {
                    await batch.commit();
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }
            console.log(`Saved ${data.length} games for ${sport}`);
        }

        return NextResponse.json({ success: true, totalGames });
    } catch (err: any) {
        console.error("Force sync failed:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
