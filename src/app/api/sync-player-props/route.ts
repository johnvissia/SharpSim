import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
    try {
        // We import the client-side sync logic but wrap it for server-side use or rewrite if needed.
        // Actually, let's implement the server-side logic here to keep it robust.

        const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
        if (!API_KEY) throw new Error('Odds API Key missing');

        console.log("[PLAYER PROPS API] Starting sync...");

        // 1. Fetch active NBA events first
        const eventsRes = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey=${API_KEY}`);
        if (!eventsRes.ok) throw new Error(`Odds API Events error: ${eventsRes.status}`);
        const events = await eventsRes.json();

        console.log(`[PLAYER PROPS API] Found ${events.length} active NBA events`);

        let count = 0;
        const batchSize = 500;
        let batch = db.batch();

        // 2. For each event, fetch player props
        for (const event of events) {
            const gameStart = new Date(event.commence_time).getTime();
            const now = new Date().getTime();
            const timeLimitMs = 15 * 60 * 1000;
            
            // Freeze the line 15 minutes before the game time
            if (now >= gameStart - timeLimitMs) {
                console.log(`[PLAYER PROPS API] Skipping event ${event.id} (frozen 15 mins before start)`);
                continue;
            }

            console.log(`[PLAYER PROPS API] Fetching props for ${event.away_team} @ ${event.home_team}...`);

            const propsRes = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/events/${event.id}/odds?apiKey=${API_KEY}&regions=us&markets=player_points&oddsFormat=american&bookmakers=pinnacle,draftkings,fanduel`);

            if (!propsRes.ok) {
                console.error(`[PLAYER PROPS API] Failed to fetch props for ${event.id}: ${propsRes.status}`);
                continue;
            }

            const gameOdds = await propsRes.json();
            if (!gameOdds.bookmakers || gameOdds.bookmakers.length === 0) continue;

            const bookmaker = gameOdds.bookmakers.find((b: any) => b.key === 'pinnacle') ||
                gameOdds.bookmakers.find((b: any) => b.key === 'draftkings') ||
                gameOdds.bookmakers[0];

            const market = bookmaker.markets.find((m: any) => m.key === 'player_points');
            if (!market || !market.outcomes) continue;

            const playerMap = new Map<string, any>();

            market.outcomes.forEach((outcome: any) => {
                const playerName = outcome.description;
                if (!playerMap.has(playerName)) {
                    playerMap.set(playerName, {
                        id: `${event.id}_${playerName.replace(/\s+/g, '_')}`,
                        gameId: event.id,
                        playerName: playerName,
                        matchup: `${event.away_team} @ ${event.home_team}`,
                        commenceTime: event.commence_time,
                        market: 'Points',
                    });
                }

                const prop = playerMap.get(playerName);
                if (outcome.name === 'Over') {
                    prop.line = outcome.point;
                    prop.overOdds = outcome.price;
                } else if (outcome.name === 'Under') {
                    prop.line = outcome.point;
                    prop.underOdds = outcome.price;
                }
            });

            for (const prop of playerMap.values()) {
                if (!prop.line || !prop.overOdds || !prop.underOdds) continue;
                const propRef = db.collection('player_props').doc(prop.id);
                batch.set(propRef, prop, { merge: true });
                count++;

                if (count % batchSize === 0) {
                    await batch.commit();
                    batch = db.batch();
                }
            }

            // Small delay to respect rate limits if needed
            await new Promise(r => setTimeout(r, 200));
        }

        await batch.commit();

        return NextResponse.json({ success: true, count });
    } catch (error: any) {
        console.error("[PLAYER PROPS API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
