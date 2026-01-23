import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import type { nbaTeamAbbreviationToName } from '@/lib/nba-data';

export async function GET() {
  try {
    // Smart Date Logic: Use today's date.
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    console.log(`🚀 STARTING SYNC: Fetching props for ${dateString}...`);

    // Fetch from Tank01 using the correct endpoint and parameter.
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
        throw new Error(`Tank01 API Error ${response.status}: ${errorBody}`);
    }
    const data = await response.json();
    
    const games = data.body || []; 
    if (games.length === 0) {
        return NextResponse.json({ message: "No games with props found for today." }, { status: 200 });
    }

    console.log(`✅ FOUND: ${games.length} games. Unpacking player props...`);

    const batch = db.batch();
    let count = 0;

    for (const game of games) {
        if (!game.gameID || !game.team1?.abbreviation || !game.team2?.abbreviation) continue;

        const allPlayers = [
            ...(game.team1?.playerProps || []),
            ...(game.team2?.playerProps || []),
            ...(game.playerProps || [])
        ];

        for (const player of allPlayers) {
            const playerId = player.playerID || player.player_id;
            if (!player.propBets || !playerId) continue;

            for (const [market, marketData] of Object.entries(player.propBets as any)) {
                if (typeof marketData !== 'object' || marketData === null || !('line' in marketData)) {
                    continue;
                }
                
                const { line, over, under } = marketData as {line: number, over: number, under: number};

                const docId = `${game.gameID}_${playerId}_${market}`;
                const docRef = db.collection("player_props").doc(docId);
                
                batch.set(docRef, {
                    gameId: game.gameID,
                    playerId: String(playerId),
                    playerName: player.playerName || "Unknown",
                    teamName: player.teamName || (nbaTeamAbbreviationToName as any)[player.team] || player.team,
                    matchup: `${game.team2.abbreviation} @ ${game.team1.abbreviation}`,
                    commenceTime: new Date(game.gameTime).toISOString(),
                    market: market,
                    line: line,
                    overOdds: over || 0,
                    underOdds: under || 0,
                });
                count++;
            }
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`💾 SAVED: Successfully saved ${count} props.`);
        return NextResponse.json({ message: `Synced ${count} props` }, { status: 200 });
    } else {
        return NextResponse.json({ message: "No valid props extracted from API response." }, { status: 200 });
    }

  } catch (error) {
    console.error("❌ ERROR in sync-player-props:", error);
    if (error instanceof Error) {
        return NextResponse.json({ error: "Failed to sync player props", details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to sync player props", details: "An unknown error occurred" }, { status: 500 });
  }
}
