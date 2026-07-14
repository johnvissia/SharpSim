import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import * as admin from 'firebase-admin';

function getMarketDisplayName(marketKey: string, sport: string): string {
    if (sport === 'NBA') {
        if (marketKey === 'player_points') return 'Points';
        return marketKey;
    }
    
    // MLB Mapping
    const mapping: Record<string, string> = {
        'pitcher_strikeouts': 'Strikeouts',
        'batter_hits': 'Hits',
        'batter_home_runs': 'Home Runs',
        'batter_rbis': 'RBIs',
        'batter_runs_scored': 'Runs Scored',
        'batter_total_bases': 'Total Bases',
        'pitcher_walks': 'Pitcher Walks',
        'batter_stolen_bases': 'Stolen Bases',
        'pitcher_earned_runs': 'Earned Runs',
        'pitcher_hits_allowed': 'Hits Allowed',
    };
    
    return mapping[marketKey] || marketKey;
}

export async function POST(request: NextRequest) {
    try {
        // Auth check (if CRON_SECRET is configured)
        const authHeader = request.headers.get('Authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
        if (!API_KEY) throw new Error('Odds API Key missing');

        // Parse sport parameter (default to NBA)
        let sport = 'NBA';
        try {
            const body = await request.clone().json();
            if (body && body.sport) {
                sport = body.sport.toUpperCase();
            }
        } catch (e) {
            // No body or failed parsing, check query params
            const { searchParams } = new URL(request.url);
            const sportParam = searchParams.get('sport');
            if (sportParam) {
                sport = sportParam.toUpperCase();
            }
        }

        if (sport !== 'NBA' && sport !== 'MLB') {
            return NextResponse.json({ error: `Unsupported sport: ${sport}` }, { status: 400 });
        }

        console.log(`[PLAYER PROPS API] Starting sync for sport: ${sport}...`);

        // 1. Clean up stale props (e.g., commenceTime older than 6 hours ago)
        try {
            const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
            const stalePropsSnapshot = await db.collection('player_props')
                .where('commenceTime', '<', sixHoursAgo)
                .get();

            if (!stalePropsSnapshot.empty) {
                console.log(`[PLAYER PROPS API] Cleaning up ${stalePropsSnapshot.size} stale player props...`);
                let deleteBatch = db.batch();
                let deleteCount = 0;
                for (const doc of stalePropsSnapshot.docs) {
                    deleteBatch.delete(doc.ref);
                    deleteCount++;
                    if (deleteCount % 500 === 0) {
                        await deleteBatch.commit();
                        deleteBatch = db.batch();
                    }
                }
                if (deleteCount % 500 !== 0) {
                    await deleteBatch.commit();
                }
                console.log(`[PLAYER PROPS API] Successfully cleaned up ${deleteCount} stale props.`);
            }
        } catch (cleanupErr) {
            console.error("[PLAYER PROPS API] Failed to cleanup stale props:", cleanupErr);
        }

        // 2. Fetch active events for the sport
        const sportKey = sport === 'NBA' ? 'basketball_nba' : 'baseball_mlb';
        const markets = sport === 'NBA' ? 'player_points' : 'pitcher_strikeouts,batter_hits,batter_home_runs,batter_rbis,batter_runs_scored,batter_total_bases,pitcher_walks,batter_stolen_bases,pitcher_earned_runs,pitcher_hits_allowed';

        const eventsRes = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${API_KEY}`);
        if (!eventsRes.ok) throw new Error(`Odds API Events error: ${eventsRes.status}`);
        const events = await eventsRes.json();

        console.log(`[PLAYER PROPS API] Found ${events.length} active ${sport} events`);

        let count = 0;
        const batchSize = 500;
        let batch = db.batch();

        // 3. For each event, fetch player props
        for (const event of events) {
            const gameStart = new Date(event.commence_time).getTime();
            const now = new Date().getTime();
            const timeLimitMs = 15 * 60 * 1000;
            
            // Freeze the line 15 minutes before the game time
            if (now >= gameStart - timeLimitMs) {
                console.log(`[PLAYER PROPS API] Skipping event ${event.id} (frozen/in-progress)`);
                continue;
            }

            console.log(`[PLAYER PROPS API] Fetching props for ${event.away_team} @ ${event.home_team}...`);

            const propsRes = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/events/${event.id}/odds?apiKey=${API_KEY}&regions=us&markets=${markets}&oddsFormat=american&bookmakers=pinnacle,draftkings,fanduel`);

            if (!propsRes.ok) {
                console.error(`[PLAYER PROPS API] Failed to fetch props for ${event.id}: ${propsRes.status}`);
                continue;
            }

            const gameOdds = await propsRes.json();
            if (!gameOdds.bookmakers || gameOdds.bookmakers.length === 0) continue;

            const bookmaker = gameOdds.bookmakers.find((b: any) => b.key === 'pinnacle') ||
                gameOdds.bookmakers.find((b: any) => b.key === 'draftkings') ||
                gameOdds.bookmakers[0];

            if (!bookmaker.markets || bookmaker.markets.length === 0) continue;

            for (const market of bookmaker.markets) {
                const marketKey = market.key;
                if (!market.outcomes) continue;

                const marketDisplayName = getMarketDisplayName(marketKey, sport);
                const playerMap = new Map<string, any>();

                market.outcomes.forEach((outcome: any) => {
                    const playerName = outcome.description;
                    const playerKey = `${playerName}_${marketKey}`;

                    if (!playerMap.has(playerKey)) {
                        playerMap.set(playerKey, {
                            id: `${event.id}_${playerName.replace(/\s+/g, '_')}_${marketKey}`,
                            gameId: event.id,
                            playerName: playerName,
                            playerId: playerName.replace(/\s+/g, '_'),
                            matchup: `${event.away_team} @ ${event.home_team}`,
                            commenceTime: event.commence_time,
                            market: marketDisplayName,
                            marketKey: marketKey,
                            sport: sport,
                        });
                    }

                    const prop = playerMap.get(playerKey);
                    if (outcome.name === 'Over') {
                        prop.line = outcome.point;
                        prop.overOdds = outcome.price;
                    } else if (outcome.name === 'Under') {
                        prop.line = outcome.point;
                        prop.underOdds = outcome.price;
                    }
                });

                for (const prop of playerMap.values()) {
                    if (prop.line === undefined || prop.overOdds === undefined || prop.underOdds === undefined) continue;
                    const propRef = db.collection('player_props').doc(prop.id);
                    batch.set(propRef, prop, { merge: true });
                    count++;

                    if (count % batchSize === 0) {
                        await batch.commit();
                        batch = db.batch();
                    }
                }
            }

            // Small delay to respect rate limits
            await new Promise(r => setTimeout(r, 300));
        }

        await batch.commit();

        console.log(`[PLAYER PROPS API] Successfully synced ${count} ${sport} props.`);
        return NextResponse.json({ success: true, count, sport });
    } catch (error: any) {
        console.error("[PLAYER PROPS API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    // Standardize GET request to call the same logic
    return POST(request);
}
