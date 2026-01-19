'use client';

import { doc, Firestore, writeBatch, collection, getDocs } from 'firebase/firestore';
import type { DailyGame } from '@/lib/types';

/**
 * Fetches daily game odds from The Odds API and saves them to Firestore.
 * @param firestore The Firestore instance from `useFirestore()`.
 */
export async function fetchAndSaveDailyData(firestore: Firestore) {
  console.log("DEBUG - CURRENT KEY:", process.env.NEXT_PUBLIC_ODDS_API_KEY);
  const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;

  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    const message = 'API Key for The Odds API is missing. Please add your key to .env file and restart the development server.';
    console.error(message);
    throw new Error(message);
  }

  console.log("Starting Fetch...");

  const sportsMap = [
    { key: 'americanfootball_nfl', label: 'NFL' },
    { key: 'americanfootball_ncaaf', label: 'NCAAF' },
    { key: 'baseball_mlb', label: 'MLB' },
    { key: 'basketball_nba', label: 'NBA' },
    { key: 'basketball_wnba', label: 'WNBA' },
    { key: 'basketball_ncaab', label: 'NCAAM' },
    { key: 'basketball_ncaaw', label: 'NCAAW' },
    { key: 'icehockey_nhl', label: 'NHL' },
    { key: 'soccer_epl', label: 'Soccer' }
  ];

  // 1. Fetch All
  const requests = sportsMap.map(sport =>
    fetch(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`)
      .then(res => {
        if (!res.ok) {
          return res.text().then(text => { throw new Error(`HTTP error ${res.status} for ${sport.label}: ${text}`) });
        }
        return res.json();
      })
      .catch(err => {
        console.error(`Error fetching ${sport.label}:`, err);
        return []; // Return empty array on fail
      })
  );

  const results = await Promise.allSettled(requests);
  const allGames = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));

  console.log("Total Raw Games Fetched:", allGames.length); // DEBUG LOG 1

  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (2 * 60 * 60 * 1000));
  
  const activeGames = allGames.filter(game => {
    const gameTime = new Date(game.commence_time);
    return gameTime > cutoffTime;
  });

  console.log("Games After Filtering:", activeGames.length);

  try {
    const batch = writeBatch(firestore);
    const dailyGamesCollectionRef = collection(firestore, 'daily_games');
    
    // Delete existing games to ensure a clean slate
    const existingGamesSnapshot = await getDocs(dailyGamesCollectionRef);
    if (!existingGamesSnapshot.empty) {
        existingGamesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
    
    // Add the new, filtered games
    activeGames.forEach(game => {
      const gameData: DailyGame = {
        id: game.id,
        sportKey: game.sport_key,
        commenceTime: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        bookmakerOdds: game.bookmakers?.map((b: any) => JSON.stringify(b)) || [],
      };
      const gameRef = doc(firestore, 'daily_games', gameData.id);
      batch.set(gameRef, gameData);
    });

    await batch.commit();
    console.log(`${activeGames.length} active games saved to Firestore.`);

  } catch (error) {
    console.error('An unexpected error occurred during the Firestore saving process:', error);
    throw error;
  }
}