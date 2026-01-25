'use client';

import { doc, Firestore, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import type { DailyGame, CompletedGame } from '@/lib/types';

// Helper function to introduce a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches daily game odds and completed game scores from The Odds API and saves them to Firestore.
 * CRITICAL FIX: Uses consistent game IDs and properly handles the completed_games collection.
 * @param firestore The Firestore instance.
 */
export async function syncGameLinesAndScores(firestore: Firestore) {
  const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;

  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    const message = 'API Key for The Odds API is missing. Please add your key to .env file and restart the development server.';
    console.error(message);
    throw new Error(message);
  }

  console.log("Starting Sequential Fetch for Game Lines...");

  const sportsMap = [
    { key: 'americanfootball_nfl', label: 'NFL' },
    { key: 'americanfootball_ncaaf', label: 'NCAAF' },
    { key: 'basketball_nba', label: 'NBA' },
    { key: 'basketball_ncaab', label: 'NCAAM' },
    { key: 'icehockey_nhl', label: 'NHL' },
  ];

  const allGames = [];
  const successfullyFetchedSportKeys: string[] = [];

  // ============ FETCH UPCOMING GAMES WITH ODDS ============
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
        successfullyFetchedSportKeys.push(sport.key);
      } catch (err) {
        console.error(`Error fetching ${sport.label}:`, err);
      }
      await delay(1500);
    }
    
    console.log("Total Raw Upcoming Games Fetched:", allGames.length);

    const dailyGamesBatch = writeBatch(firestore);
    const dailyGamesCollectionRef = collection(firestore, 'daily_games');
    
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
    
    allGames.forEach(game => {
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

    if (allGames.length > 0 || (successfullyFetchedSportKeys.length > 0 && allGames.length === 0)) {
        await dailyGamesBatch.commit();
        console.log(`${allGames.length} games saved to Firestore.`);
    } else {
        console.log("No new games to save and no old games to delete.");
    }

  } catch (error) {
    console.error('An unexpected error occurred during the Firestore daily games saving process:', error);
    throw error;
  }

  // ============ FETCH COMPLETED GAME SCORES ============
  const allCompletedGames: CompletedGame[] = [];
  const gameIdsWithScores = new Set<string>();
  
  try {
    console.log("Fetching completed game scores...");
    for (const sport of sportsMap) {
      console.log(`Fetching scores for ${sport.label}...`);
      try {
        // Fetch scores from the last 3 days to catch all recently completed games
        const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport.key}/scores/?apiKey=${API_KEY}&daysFrom=3`);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP error ${res.status} for ${sport.label} scores: ${text}`);
        }
        const data = await res.json();
        
        console.log(`  Found ${data.length} games with potential scores for ${sport.label}`);
        
        // Process ALL games that have scores (completed or not)
        data.forEach((game: any) => {
            // Only process if scores exist
            if (!game.scores || game.scores.length === 0) {
                return;
            }

            const homeScoreStr = game.scores.find((s: any) => s.name === game.home_team)?.score;
            const awayScoreStr = game.scores.find((s: any) => s.name === game.away_team)?.score;
    
            // Only add if both scores are valid
            if (homeScoreStr !== undefined && awayScoreStr !== null && 
                awayScoreStr !== undefined && homeScoreStr !== null) {
              
              const homeScore = parseInt(homeScoreStr, 10);
              const awayScore = parseInt(awayScoreStr, 10);
              
              // Only add valid numeric scores
              if (!isNaN(homeScore) && !isNaN(awayScore)) {
                allCompletedGames.push({
                  id: game.id,
                  sportKey: game.sport_key,
                  commenceTime: game.commence_time,
                  homeTeam: game.home_team,
                  awayTeam: game.away_team,
                  homeScore: homeScore,
                  awayScore: awayScore,
                  completed: game.completed === true, // Explicitly check for true
                });
                gameIdsWithScores.add(game.id);
                
                console.log(`  ✓ Added: ${game.away_team} @ ${game.home_team} (${awayScore}-${homeScore}) [completed: ${game.completed}]`);
              }
            }
        });

      } catch (err) {
        console.error(`Error fetching scores for ${sport.label}:`, err);
      }
      await delay(1500);
    }

    console.log(`\nTotal Completed Games Found: ${allCompletedGames.length}`);
    console.log(`Games marked as completed: ${allCompletedGames.filter(g => g.completed).length}`);
    console.log(`Games with scores but not completed: ${allCompletedGames.filter(g => !g.completed).length}`);

    if (allCompletedGames.length > 0) {
      const scoresBatch = writeBatch(firestore);
      const completedGamesRef = collection(firestore, 'completed_games');

      // Save all games with scores
      allCompletedGames.forEach((game) => {
          const gameRef = doc(completedGamesRef, game.id);
          scoresBatch.set(gameRef, game, { merge: true });
      });

      await scoresBatch.commit();
      console.log(`✓ ${allCompletedGames.length} games with scores saved/updated in Firestore completed_games collection.`);
      
      // Log some example game IDs for debugging
      const exampleIds = Array.from(gameIdsWithScores).slice(0, 5);
      console.log(`\nExample game IDs in completed_games:`, exampleIds);
    } else {
      console.log("No completed games found with valid scores.");
    }
  } catch (error) {
    console.error('An unexpected error occurred during the Firestore scores saving process:', error);
  }
  
  console.log("\n✓ Game sync complete!");
}