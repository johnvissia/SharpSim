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

// Helper to normalize team names for matching
const normalizeTeamName = (name: string): string => {
    return name.toLowerCase().replace(/[\s.&()']/g, '');
};

interface Tank01Player {
    playerID: string;
    playerName: string;
    teamAbbr: string;
}

interface Tank01Market {
    gameID: string;
    player: Tank01Player;
    marketName: string;
    line: number;
    overPrice: number;
    underPrice: number;
}

interface Tank01Game {
    gameID: string;
    gameTime: string;
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
    
    // 2. Build a mapping from Tank01 team matchups to Odds API game IDs
    console.log("🔍 Building Tank01 -> Odds API game ID mapping...");
    const gameIdMapping = new Map<string, string>(); // Tank01 gameID -> Odds API ID
    
    // Fetch all daily_games (which have Odds API IDs)
    const dailyGamesSnapshot = await db.collection('daily_games').get();
    
    // Create a map of normalized matchups to Odds API IDs
    const matchupToOddsId = new Map<string, string>();
    dailyGamesSnapshot.docs.forEach(doc => {
        const dailyGame = doc.data();
        const normalizedHome = normalizeTeamName(dailyGame.homeTeam);
        const normalizedAway = normalizeTeamName(dailyGame.awayTeam);
        const matchupKey = `${normalizedAway}@${normalizedHome}`;
        matchupToOddsId.set(matchupKey, doc.id);
    });
    
    // Map each Tank01 game to an Odds API ID
    data.body.forEach(tank01Game => {
        const homeTeamName = nbaTeamAbbreviationToName[tank01Game.homeTeam.teamAbbr] || tank01Game.homeTeam.teamAbbr;
        const awayTeamName = nbaTeamAbbreviationToName[tank01Game.awayTeam.teamAbbr] || tank01Game.awayTeam.teamAbbr;
        
        const normalizedHome = normalizeTeamName(homeTeamName);
        const normalizedAway = normalizeTeamName(awayTeamName);
        const matchupKey = `${normalizedAway}@${normalizedHome}`;
        
        const oddsApiId = matchupToOddsId.get(matchupKey);
        
        if (oddsApiId) {
            gameIdMapping.set(tank01Game.gameID, oddsApiId);
            console.log(`✓ Mapped Tank01 ${tank01Game.gameID} -> Odds API ${oddsApiId} (${awayTeamName} @ ${homeTeamName})`);
        } else {
            console.warn(`⚠️  No Odds API game found for ${awayTeamName} @ ${homeTeamName}`);
        }
    });
    
    console.log(`📊 Successfully mapped ${gameIdMapping.size}/${data.body.length} games to Odds API IDs`);
    
    const allProps: any[] = [];
    let unmappedGamesCount = 0;
    
    // 3. Parse the response into our PlayerProp format
    data.body.forEach(game => {
        if (!game.markets) return;
        
        const oddsApiId = gameIdMapping.get(game.gameID);
        if (!oddsApiId) {
            console.warn(`⚠️  Skipping props for Tank01 game ${game.gameID} - no Odds API mapping`);
            unmappedGamesCount++;
            return; // Skip games that couldn't be mapped
        }
        
        const homeTeamName = nbaTeamAbbreviationToName[game.homeTeam.teamAbbr] || game.homeTeam.teamAbbr;
        const awayTeamName = nbaTeamAbbreviationToName[game.awayTeam.teamAbbr] || game.awayTeam.teamAbbr;
        const matchup = `${awayTeamName} @ ${homeTeamName}`;
        
        game.markets.forEach(market => {
            const appMarket = mapTank01MarketToApp(market.marketName);
            if (!appMarket) return;
            
            const teamName = nbaTeamAbbreviationToName[market.player.teamAbbr] || market.player.teamAbbr;

            const prop = {
                gameId: oddsApiId, // Use Odds API ID for grading compatibility
                tank01GameId: game.gameID, // Keep Tank01 ID for reference/debugging
                playerId: market.player.playerID,
                playerName: market.player.playerName,
                teamName: teamName,
                matchup: matchup,
                commenceTime: game.gameTime,
                market: appMarket,
                line: market.line,
                overOdds: market.overPrice,
                underOdds: market.underPrice,
            };
            allProps.push(prop);
        });
    });
    
    if (allProps.length === 0) {
        return NextResponse.json({ 
            message: "No props could be synced. Make sure game lines are synced first on the dashboard.",
            mapped: gameIdMapping.size,
            unmapped: unmappedGamesCount
        }, { status: 400 });
    }
    
    console.log(`✅ Parsed ${allProps.length} total player props from ${gameIdMapping.size} games.`);
    
    // 4. Clear existing player_props collection
    console.log("🗑️ Deleting all existing player props in Firestore...");
    const propsCollectionRef = db.collection('player_props');
    const querySnapshot = await propsCollectionRef.get();
    
    if (!querySnapshot.empty) {
        let batch = db.batch();
        let deleteCount = 0;
        const deleteBatches: Promise<any>[] = [];
        
        querySnapshot.docs.forEach((doc, index) => {
            batch.delete(doc.ref);
            deleteCount++;
            if ((index + 1) % 500 === 0) {
                deleteBatches.push(batch.commit());
                batch = db.batch();
            }
        });
        
        // Commit any remaining deletes
        if (deleteCount % 500 !== 0) {
            deleteBatches.push(batch.commit());
        }
        
        await Promise.all(deleteBatches);
        console.log(`🔥 Deleted ${deleteCount} old player props.`);
    }

    // 5. Write new props to Firestore
    console.log("💾 Writing new props to Firestore...");
    let batch: WriteBatch = db.batch();
    let writeCount = 0;
    const writeBatches: Promise<any>[] = [];

    allProps.forEach((prop, index) => {
        const docRef = propsCollectionRef.doc();
        batch.set(docRef, { ...prop, id: docRef.id }); 
        writeCount++;
        if ((index + 1) % 500 === 0) {
            writeBatches.push(batch.commit());
            batch = db.batch();
        }
    });
    
    // Commit any remaining writes
    if (writeCount % 500 !== 0) {
        writeBatches.push(batch.commit());
    }
    
    await Promise.all(writeBatches);
    console.log(`✨ Successfully wrote ${writeCount} new player props.`);
    
    return NextResponse.json({ 
        message: `✅ Synced ${writeCount} player props from ${gameIdMapping.size} games successfully!`,
        details: {
            propsWritten: writeCount,
            gamesMapped: gameIdMapping.size,
            gamesUnmapped: unmappedGamesCount
        }
    });

  } catch (error: any) {
    console.error("❌ Player prop sync failed:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}