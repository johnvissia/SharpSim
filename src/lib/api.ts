'use client';

import { doc, Firestore, writeBatch, collection, getDocs } from 'firebase/firestore';
import type { DailyGame, CompletedGame } from '@/lib/types';

const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;

/**
 * Fetches daily game odds and completed game scores from The Odds API
 * and saves them to Firestore. This function is designed to run on the client-side.
 * It uses Promise.allSettled to ensure that failures in one API call do not prevent others from succeeding.
 * @param firestore The Firestore instance from `useFirestore()`.
 * @param sportKey (Optional) If a specific sportKey is provided, it fetches only that sport. Otherwise, fetches all.
 */
export async function fetchAndSaveDailyData(firestore: Firestore, sportKey: string = 'upcoming') {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    const message = 'API Key for The Odds API is missing. Please add your key to .env file and restart the development server.';
    console.error(message);
    throw new Error(message);
  }

  // 1. The Master Sports Map
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

  // Determine which sports to fetch based on the input
  const sportsToFetch = sportKey === 'upcoming' 
    ? sportsMap 
    : sportsMap.filter(s => s.key === sportKey || s.label === sportKey);


  // --- 1. Fetch Upcoming Game Odds ---
  try {
    // 2. The Bulletproof Loop (creating promises)
    const oddsPromises = sportsToFetch.map(sport => {
        const oddsApiUrl = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds/?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${API_KEY}`;
        return fetch(oddsApiUrl).then(res => {
            if (!res.ok) {
                // Throw an error to be caught by allSettled
                return res.text().then(text => { throw new Error(`HTTP error ${res.status} for ${sport.label}: ${text}`) });
            }
            return res.json();
        });
    });

    // 3. The "Settled" Logic
    const oddsResults = await Promise.allSettled(oddsPromises);
    const allUpcomingGames = oddsResults.flatMap((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value; // Keep the games if fetch worked
        } else {
            console.warn(`Failed to fetch odds for ${sportsToFetch[index].label}:`, result.reason);
            return []; // If it failed, return empty array (don't crash!)
        }
    });

    console.log("Total games loaded from API:", allUpcomingGames.length);

    // 4. Filter out expired games
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (2 * 60 * 60 * 1000)); // 2 hours ago
    const activeGames = allUpcomingGames.filter(game => {
      const gameTime = new Date(game.commence_time);
      // Keep games that start in the future or started within the cutoff window
      return gameTime > cutoffTime;
    });

    console.log(`Found ${activeGames.length} active games after filtering.`);

    // 5. "Clobber" Save: Delete all old games and write the new active ones
    const batch = writeBatch(firestore);
    const dailyGamesCollectionRef = collection(firestore, 'daily_games');
    
    // Stage deletion of all existing documents
    const existingGamesSnapshot = await getDocs(dailyGamesCollectionRef);
    if (!existingGamesSnapshot.empty) {
        existingGamesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        console.log(`Staged deletion for ${existingGamesSnapshot.size} old games.`);
    }

    // Stage setting of new active games
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
        batch.set(gameRef, gameData); // No merge needed, we are overwriting
    });

    // Commit all deletions and additions in one atomic operation
    await batch.commit();
    console.log(`Successfully synced daily_games collection. Removed ${existingGamesSnapshot.size}, added ${activeGames.length}.`);

  } catch (error) {
    console.error('An unexpected error occurred during the odds fetching process:', error);
  }


  // --- 2. Fetch Completed Game Scores (also using allSettled) ---
  try {
    const scoresPromises = sportsToFetch.map(sport => {
      const scoresApiUrl = `https://api.the-odds-api.com/v4/sports/${sport.key}/scores/?daysFrom=3&apiKey=${API_KEY}`;
      return fetch(scoresApiUrl).then(res => {
          if (!res.ok) {
              return res.text().then(text => { throw new Error(`HTTP error ${res.status} for ${sport.label}: ${text}`) });
          }
          return res.json();
      });
    });

    const scoreResults = await Promise.allSettled(scoresPromises);
    const allCompletedGames = scoreResults.flatMap((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            console.warn(`Failed to fetch scores for ${sportsToFetch[index].label}:`, result.reason);
            return [];
        }
    });

    const gamesWithScores = allCompletedGames.filter(game => game.completed && game.scores);

    console.log("Total completed games with scores fetched:", gamesWithScores.length);
    
    if (gamesWithScores.length > 0) {
        const scoresBatch = writeBatch(firestore);
        gamesWithScores.forEach(game => {
            const homeScore = game.scores.find((s: any) => s.name === game.home_team)?.score;
            const awayScore = game.scores.find((s: any) => s.name === game.away_team)?.score;

            if (homeScore !== undefined && awayScore !== undefined) {
                const gameData: CompletedGame = {
                    id: game.id,
                    sportKey: game.sport_key,
                    commenceTime: game.commence_time,
                    homeTeam: game.home_team,
                    awayTeam: game.away_team,
                    homeScore: parseInt(homeScore, 10),
                    awayScore: parseInt(awayScore, 10),
                };
                const gameRef = doc(firestore, 'completed_games', gameData.id);
                scoresBatch.set(gameRef, gameData, { merge: true });
            }
        });
        await scoresBatch.commit();
        console.log(`Successfully committed a batch of ${gamesWithScores.length} completed games with scores.`);
    } else {
        console.log('No completed games with scores were fetched to save.');
    }
  } catch (error) {
    console.error('An unexpected error occurred during the scores fetching process:', error);
  }
}
