'use client';

import { doc, Firestore, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import type { DailyGame, CompletedGame } from '@/lib/types';

// Helper function to introduce a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches daily game odds and completed game scores from The Odds API and saves them to Firestore.
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

  console.log("Starting Sequential Fetch...");

  const sportsMap = [
    { key: 'americanfootball_nfl', label: 'NFL' },
    { key: 'americanfootball_ncaaf', label: 'NCAAF' },
    { key: 'basketball_nba', label: 'NBA' },
    { key: 'basketball_ncaab', label: 'NCAAM' },
    { key: 'icehockey_nhl', label: 'NHL' },
  ];

  // 1. Fetch Upcoming Game Odds Sequentially
  const allGames = [];
  const successfullyFetchedSportKeys: string[] = [];

  try {
    for (const sport of sportsMap) {
      console.log(`Fetching odds for ${sport.label}...`);
      try {
        const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP error ${res.status} for ${sport.label}: ${text}`);
        }
        const data = await res.json();
        allGames.push(...data);
        successfullyFetchedSportKeys.push(sport.key); // Add to successful list
      } catch (err) {
        console.error(`Error fetching ${sport.label}:`, err);
        // Continue to the next sport even if one fails
      }
      await delay(1500); // Add a 1.5 second delay between requests
    }
    
    console.log("Total Raw Upcoming Games Fetched:", allGames.length);

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (2 * 60 * 60 * 1000));
    
    const activeGames = allGames.filter(game => {
      const gameTime = new Date(game.commence_time);
      return gameTime > cutoffTime;
    });

    console.log("Active Upcoming Games After Filtering:", activeGames.length);

    const dailyGamesBatch = writeBatch(firestore);
    const dailyGamesCollectionRef = collection(firestore, 'daily_games');
    
    // --- Safer Update Logic ---
    // Only delete games for sports that we successfully fetched new data for.
    if (successfullyFetchedSportKeys.length > 0) {
        const q = query(dailyGamesCollectionRef, where('sportKey', 'in', successfullyFetchedSportKeys));
        const existingGamesSnapshot = await getDocs(q);
        if (!existingGamesSnapshot.empty) {
            console.log(`Deleting ${existingGamesSnapshot.size} existing games for successfully fetched sports.`);
            existingGamesSnapshot.forEach(doc => {
                dailyGamesBatch.delete(doc.ref);
            });
        }
    }
    
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
      dailyGamesBatch.set(gameRef, gameData);
    });

    if (activeGames.length > 0 || (successfullyFetchedSportKeys.length > 0 && activeGames.length === 0)) {
        await dailyGamesBatch.commit();
        console.log(`${activeGames.length} active games saved to Firestore.`);
    } else {
        console.log("No new games to save and no old games to delete.");
    }

  } catch (error) {
    console.error('An unexpected error occurred during the Firestore daily games saving process:', error);
    throw error; // Re-throw to be caught by the UI
  }

  // 2. Fetch Completed Game Scores Sequentially
  const allCompletedGames = [];
  try {
    console.log("Fetching completed game scores...");
    for (const sport of sportsMap) {
      console.log(`Fetching scores for ${sport.label}...`);
       try {
        const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport.key}/scores/?apiKey=${API_KEY}&daysFrom=1`);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP error ${res.status} for ${sport.label} scores: ${text}`);
        }
        const data = await res.json();
        allCompletedGames.push(...data);
      } catch (err) {
        console.error(`Error fetching scores for ${sport.label}:`, err);
         // Continue to the next sport
      }
      await delay(1500); // Add a 1.5 second delay
    }

    console.log("Total Raw Completed Games Fetched:", allCompletedGames.length);

    const finishedGames = allCompletedGames.filter((game: any) => game.completed === true && game.scores);
    console.log("Finished Games with Scores:", finishedGames.length);

    if (finishedGames.length > 0) {
      const scoresBatch = writeBatch(firestore);
      const completedGamesRef = collection(firestore, 'completed_games');

      finishedGames.forEach((game: any) => {
        const homeScoreStr = game.scores.find((s: any) => s.name === game.home_team)?.score;
        const awayScoreStr = game.scores.find((s: any) => s.name === game.away_team)?.score;

        if (homeScoreStr !== undefined && awayScoreStr !== undefined && homeScoreStr !== null && awayScoreStr !== null) {
          const completedGameData: CompletedGame = {
            id: game.id,
            sportKey: game.sport_key,
            commenceTime: game.commence_time,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            homeScore: parseInt(homeScoreStr, 10),
            awayScore: parseInt(awayScoreStr, 10),
          };
          const gameRef = doc(completedGamesRef, completedGameData.id);
          scoresBatch.set(gameRef, completedGameData, { merge: true });
        }
      });

      await scoresBatch.commit();
      console.log(`${finishedGames.length} completed games with scores saved/updated in Firestore.`);
    }
  } catch (error) {
    console.error('An unexpected error occurred during the Firestore scores saving process:', error);
    // Do not re-throw; allow odds fetching to succeed even if scores fail
  }
}
