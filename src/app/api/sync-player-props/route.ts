import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

// 1. CONFIG
const firebaseConfig = {
  projectId: "studio-5044041186-4b498",
  appId: "1:365081318189:web:7ee8c5b2464492ffb5f9a4",
  apiKey: "AIzaSyCsZFIQYt7yAUpRKM1-KZB0dg36_0WBSQE",
  authDomain: "studio-5044041186-4b498.firebaseapp.com",
  messagingSenderId: "365081318189"
};

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log("🟢 SYNC STARTED...");

    // 2. INITIALIZE
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // 3. FETCH
    const now = new Date();
// const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
const dateString = "20250122"; // <--- FORCE THIS DATE
    const url = `https://${process.env.RAPIDAPI_HOST}/getNBABettingOdds?gameDate=${dateString}&playerProps=true`;
    
    console.log(`fetching: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
        'x-rapidapi-host': process.env.RAPIDAPI_HOST!
      }
    });

    const data = await response.json();
    
    // --- 🔍 THE FIX: ROBUST DATA CHECK ---
    let games = data.body;
    
    // If 'games' is not a list (Array), make it an empty list so it doesn't crash
    if (!Array.isArray(games)) {
        console.log("⚠️ API returned unexpected format (not an array):", JSON.stringify(data));
        games = [];
    }
    // -------------------------------------

    if (games.length === 0) {
        return NextResponse.json({ message: "API connected, but no games found today." }, { status: 200 });
    }

    // 4. SAVE
    const batch = writeBatch(db);
    let count = 0;

    const processPlayer = (player: any, gameID: string) => {
        if (!player.propBets || !player.playerID) return;
        
        for (const [market, line] of Object.entries(player.propBets)) {
            const docId = `${gameID}_${player.playerID}_${market}`;
            const docRef = doc(db, "player_props", docId);
            const lineData = line as any;

            batch.set(docRef, {
                gameID: gameID,
                playerID: player.playerID,
                playerName: player.playerName || "Unknown",
                market: market,
                line: lineData,
                gameDate: dateString,
                fetchedAt: new Date().toISOString()
            });
            count++;
        }
    };

    for (const game of games) {
        const gameID = game.gameID || dateString;
        const allPlayers = [
            ...(game.team1?.playerProps || []),
            ...(game.team2?.playerProps || []),
            ...(game.playerProps || [])
        ];
        allPlayers.forEach(p => processPlayer(p, gameID));
    }

    if (count > 0) {
        await batch.commit();
        return NextResponse.json({ message: `SUCCESS: Synced ${count} props` }, { status: 200 });
    } else {
        return NextResponse.json({ message: "Games found, but no player props inside them." }, { status: 200 });
    }

  } catch (error: any) {
    console.error("🔴 CRASH:", error);
    return NextResponse.json({ error: "Failed to sync", details: error.message }, { status: 500 });
  }
}