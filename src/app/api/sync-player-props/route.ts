import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';
import { nbaTeamAbbreviationToName, mapTank01MarketToApp } from '@/lib/nba-data';

export const dynamic = 'force-dynamic';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch(e) {
      console.error("Firebase admin initialization error", e);
  }
}
const db = getFirestore();


// Types for parsing Tank01 API response
interface Tank01Player {
    playerID: string;
    playerName: string;
    teamAbbr: string;
}

interface Tank01Market {
    gameID: string;
    player: Tank01Player;
    marketName: string; // e.g. "player_points_over_under"
    line: number;
    overPrice: number;
    underPrice: number;
}

interface Tank01Game {
    gameID: string;
    gameTime: string; // ISO Date String
    homeTeam: { teamAbbr: string };
    awayTeam: { teamAbbr: string };
    markets?: Tank01Market[];
}

interface Tank01Response {
    body: Tank01Game[];
}


export async function GET() {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST;

  if (!rapidApiKey || !rapidApiHost) {
    return NextResponse.json({ message: "API credentials are not configured on the server." }, { status: 500 });
  }

  try {
    console.log("🚀 Starting Player Prop Sync from Tank01...");
    
    // 1. Fetch upcoming NBA game props from Tank01
    // API expects YYYYMMDD format. The mock data uses 20260123, so we'll use that for consistency.
    const dateString = "20260123";
    
    const url = `https://${rapidApiHost}/getNBABettingOdds?gameDate=${dateString}&playerProps=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-rapidapi-key': rapidApiKey, 'x-rapidapi-host': rapidApiHost }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tank01 API Error: ${response.status} - ${errorText}`);
    }

    const data: Tank01Response = await response.json();

    if (!data.body || !Array.isArray(data.body)) {
        throw new Error("Invalid data structure from Tank01 API. 'body' array not found.");
    }
    
    const allProps: any[] = [];
    
    // 2. Parse the response into our PlayerProp format
    data.body.forEach(game => {
        if (!game.markets) return;
        
        const homeTeamName = nbaTeamAbbreviationToName[game.homeTeam.teamAbbr] || game.homeTeam.teamAbbr;
        const awayTeamName = nbaTeamAbbreviationToName[game.awayTeam.teamAbbr] || game.awayTeam.teamAbbr;
        const matchup = `${awayTeamName} @ ${homeTeamName}`;
        
        game.markets.forEach(market => {
            const appMarket = mapTank01MarketToApp(market.marketName);
            if (!appMarket) return; // Skip unknown markets
            
            const teamName = nbaTeamAbbreviationToName[market.player.teamAbbr] || market.player.teamAbbr;

            const prop = {
                gameId: game.gameID,
                playerId: market.player.playerID,
                playerName: market.player.playerName,
                teamName: teamName,
                matchup: matchup,
                commenceTime: game.gameTime, // This is an ISO string from the API
                market: appMarket,
                line: market.line,
                overOdds: market.overPrice,
                underOdds: market.underPrice,
            };
            allProps.push(prop);
        });
    });
    
    console.log(`✅ Parsed ${allProps.length} total player props from the API.`);
    
    // 3. Clear existing player_props collection in Firestore
    console.log("🗑️ Deleting all existing player props in Firestore...");
    const propsCollectionRef = db.collection('player_props');
    const querySnapshot = await propsCollectionRef.get();
    
    if (!querySnapshot.empty) {
        let batch = db.batch();
        let deleteCount = 0;
        querySnapshot.docs.forEach((doc, index) => {
            batch.delete(doc.ref);
            deleteCount++;
            if ((index + 1) % 500 === 0) { // Commit every 500 deletes
                batch.commit();
                batch = db.batch();
            }
        });
        await batch.commit(); // Commit the final batch
        console.log(`🔥 Deleted ${deleteCount} old player props.`);
    } else {
        console.log("No old player props to delete.");
    }

    // 4. Write new props to Firestore
    if (allProps.length > 0) {
        console.log("💾 Writing new props to Firestore...");
        let batch: WriteBatch = db.batch();
        let writeCount = 0;

        allProps.forEach((prop, index) => {
            const docRef = propsCollectionRef.doc(); // Auto-generate ID
            // Add the auto-generated doc ID to the object itself
            batch.set(docRef, { ...prop, id: docRef.id }); 
            writeCount++;
            if ((index + 1) % 500 === 0) { // Commit every 500 writes
                batch.commit();
                batch = db.batch();
            }
        });
        await batch.commit(); // Commit any remaining items
        console.log(`✨ Successfully wrote ${writeCount} new player props.`);
        return NextResponse.json({ 
            message: `Synced ${writeCount} player props successfully. Old props cleared.`
        });
    }

    return NextResponse.json({ message: "Sync complete. No new player props found to add." });

  } catch (error: any) {
    console.error("❌ Player prop sync failed:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
