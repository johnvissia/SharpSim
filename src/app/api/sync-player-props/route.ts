import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { mapTank01MarketToApp } from '@/lib/nba-data';
import type { PlayerProp } from '@/lib/types';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    try {
        // Use application default credentials in a GCP environment.
        admin.initializeApp();
    } catch (e) {
        console.error('Firebase admin initialization error', e);
    }
}
const db = admin.firestore();

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log("🟢 SYNC STARTED: Syncing NBA Player Props...");

    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiHost = process.env.RAPIDAPI_HOST;

    if (!rapidApiKey || !rapidApiHost) {
        const errorMsg = "API credentials (RAPIDAPI_KEY, RAPIDAPI_HOST) are not configured on the server.";
        console.error(`🔴 ERROR: ${errorMsg}`);
        return NextResponse.json({ message: errorMsg }, { status: 500 });
    }
    
    try {
        const now = new Date();
        const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
        console.log(`🟢 API CALL: Fetching props for ${dateString}...`);
        
        const url = `https://${rapidApiHost}/getNBABettingOdds?gameDate=${dateString}&playerProps=true`;
        
        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-key': rapidApiKey,
                'x-rapidapi-host': rapidApiHost
            }
        };

        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tank01 API Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        const games = data.body || []; 
        if (games.length === 0) {
            console.log("⚠️ API returned 0 games. No props to sync.");
            return NextResponse.json({ message: "No props found for today." }, { status: 200 });
        }

        console.log(`✅ FOUND: ${games.length} games with potential props. Processing...`);

        const batch = db.batch();
        let propsCount = 0;

        for (const game of games) {
            const gameId = game.gameID;
            const awayTeamName = game.team2?.teamCity ? `${game.team2.teamCity} ${game.team2.teamName}` : game.team2.teamName;
            const homeTeamName = game.team1?.teamCity ? `${game.team1.teamCity} ${game.team1.teamName}` : game.team1.teamName;
            const matchup = `${awayTeamName} @ ${homeTeamName}`;
            const commenceTime = new Date(game.gameDate).toISOString();

            if (!gameId) continue;
            
            const allPlayers = [
                ...(game.team1?.playerProps || []),
                ...(game.team2?.playerProps || []),
            ];

            for (const player of allPlayers) {
                if (!player.propBets || !player.playerID) continue;

                for (const [apiMarket, propData] of Object.entries(player.propBets as any)) {
                    const market = mapTank01MarketToApp(apiMarket);
                    if (!market || !propData.line || !propData.over || !propData.under) continue;
                    
                    const propId = `${gameId}_${player.playerID}_${market}`;
                    const docRef = db.collection("player_props").doc(propId);

                    const newProp: Omit<PlayerProp, 'id'> = {
                        gameId: gameId,
                        playerId: player.playerID,
                        playerName: player.playerName || "Unknown Player",
                        teamName: player.teamAbv || "Unknown Team",
                        matchup: matchup,
                        commenceTime: commenceTime,
                        market: market,
                        line: propData.line,
                        overOdds: propData.over,
                        underOdds: propData.under,
                    };

                    batch.set(docRef, newProp, { merge: true });
                    propsCount++;
                }
            }
        }

        if (propsCount > 0) {
            await batch.commit();
            console.log(`💾 SUCCESS: Saved ${propsCount} player props to Firestore.`);
            return NextResponse.json({ message: `Synced ${propsCount} props successfully.` }, { status: 200 });
        } else {
            console.log("🤷 No valid player props were extracted from the API response.");
            return NextResponse.json({ message: "No player props were found to sync." }, { status: 200 });
        }

    } catch (error: any) {
        console.error("🔴 CRASH in /api/sync-player-props:", error);
        return NextResponse.json({ 
            error: "Failed to sync player props.", 
            details: error.message 
        }, { status: 500 });
    }
}
