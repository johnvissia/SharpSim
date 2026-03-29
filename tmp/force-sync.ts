import { initializeApp, cert } from 'firebase-admin/app';
require('dotenv').config({ path: '.env.local' });
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
try { initializeApp({ credential: cert(serviceAccount) }); } catch (e) {}
const db = getFirestore();

export const sportKeyMapping: { [key: string]: string } = {
    'NBA': 'basketball_nba',
    'NFL': 'americanfootball_nfl',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'Soccer': 'soccer_epl',
    'WNBA': 'basketball_wnba',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAM': 'basketball_ncaab',
};

async function forceSync() {
  const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
  console.log("Starting script with Key:", API_KEY?.substring(0,5));
  let totalSaved = 0;
  
  for (const sport of Object.values(sportKeyMapping)) {
    console.log(`Fetching odds for ${sport}...`);
    try {
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`);
      if (!res.ok) {
        console.error("Failed:", await res.text());
        continue;
      }
      const data = await res.json();
      console.log(`Fetched ${data.length} games for ${sport}.`);
      
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
          const gameRef = db.collection('daily_games').doc(gameData.id);
          batch.set(gameRef, gameData);
          totalSaved++;
      });
      await batch.commit();
      console.log("Committed", data.length, "games to db!");
    } catch (e) {
      console.log("Error:", e);
    }
  }
  console.log("Done syncing! Total games:", totalSaved);
}

forceSync();
