
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

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


export async function GET() {
  try {
    // 1. Get Today's Date (YYYYMMDD)
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    console.log(`🚀 STARTING SYNC: Fetching props for ${dateString} using BettingOdds endpoint...`);

    // 2. Fetch from Tank01 (Using the "Odds" endpoint with playerProps=true)
    const url = `https://${process.env.RAPIDAPI_HOST}/getNBABettingOdds?gameDate=${dateString}&playerProps=true`;
    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
        'x-rapidapi-host': process.env.RAPIDAPI_HOST!
      }
    };

    const response = await fetch(url, options);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Tank01 API Error ${response.status}:`, errorBody);
        throw new Error(`Tank01 API request failed with status ${response.status}`);
    }
    const data = await response.json();
    
    // 3. Validation
    const games = data.body || []; 
    if (games.length === 0) {
        console.log("⚠️ No games found in API response for today.");
        return NextResponse.json({ message: "No games found in API response for today." }, { status: 200 });
    }

    console.log(`✅ FOUND: ${games.length} games. Unpacking player props...`);

    // 4. Unpack and Save to Firebase
    const batch = db.batch();
    const playerPropsCollection = db.collection("player_props");
    let count = 0;

    // Loop through every Game
    for (const game of games) {
        const allPlayers = [
            ...(game.team1?.playerProps || []),
            ...(game.team2?.playerProps || []),
            ...(game.playerProps || []) // Fallback
        ];

        for (const player of allPlayers) {
            if (!player.propBets || !player.playerID) continue;

            // "Unpack" the bundle: Create 1 card for Points, 1 for Rebounds, etc.
            for (const [market, line] of Object.entries(player.propBets)) {
                if (line === null || line === undefined) continue;
                
                const overOdds = player.odds?.[market]?.over;
                const underOdds = player.odds?.[market]?.under;

                if (overOdds === undefined || underOdds === undefined) continue;

                // Construct a unique ID: GameID_PlayerID_Market
                const docId = `${game.gameID}_${player.playerID}_${market}`;
                const docRef = playerPropsCollection.doc(docId);
                
                batch.set(docRef, {
                    gameId: game.gameID,
                    playerId: player.playerID,
                    playerName: player.playerName || "Unknown Player",
                    teamName: player.team,
                    matchup: `${game.team1.name} @ ${game.team2.name}`,
                    commenceTime: game.gameDate, // Using gameDate from the game object
                    market: market, // e.g., "pts", "reb", "threes"
                    line: line,     // e.g., "12.5"
                    overOdds: overOdds,
                    underOdds: underOdds,
                    status: "Pending",
                    fetchedAt: new Date()
                });
                count++;
            }
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`💾 SAVED: Successfully saved ${count} prop bets to database.`);
        return NextResponse.json({ message: `Synced ${count} props` }, { status: 200 });
    } else {
        console.log("⚠️ Data found, but no player props extracted. Structure might vary.");
        return NextResponse.json({ message: "No props extracted from games." }, { status: 200 });
    }

  } catch (error) {
    console.error("❌ ERROR:", error);
    return NextResponse.json({ error: "Failed to sync", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
