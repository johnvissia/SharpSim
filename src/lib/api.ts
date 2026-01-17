'use client';

import { doc, Firestore } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { DailyGame, CompletedGame } from '@/lib/types';
import { sportKeyMapping } from './sports';

const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;

// Helper function to introduce a delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// List of sports to fetch for the daily 'upcoming' sync.
const UPCOMING_SPORT_KEYS = [
  'basketball_nba',
  'basketball_ncaab',
  'icehockey_nhl',
  'soccer_epl',
];


/**
 * Fetches daily game odds and completed game scores from The Odds API
 * and saves them to Firestore. This function is designed to run on the client-side.
 * @param firestore The Firestore instance from `useFirestore()`.
 * @param sportKey The key for the sport to fetch (e.g., 'basketball_nba'). If 'upcoming', it fetches a predefined list of popular sports.
 */
export async function fetchAndSaveDailyData(firestore: Firestore, sportKey: string = 'upcoming') {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    const message = 'API Key for The Odds API is missing. Please add your key to .env file and restart the development server.';
    console.error(message);
    throw new Error(message);
  }

  // --- 1. Fetch Upcoming Game Odds ---
  let allUpcomingGames: any[] = [];
  const keysToFetch = sportKey === 'upcoming' ? UPCOMING_SPORT_KEYS : [sportKey];

  try {
    const fetchPromises = keysToFetch.map(key => {
        const oddsApiUrl = `https://api.the-odds-api.com/v4/sports/${key}/odds/?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${API_KEY}`;
        return fetch(oddsApiUrl).then(async (res) => {
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`Failed to fetch odds for ${key}: ${res.status}`, errorText);
                return []; // Return empty array on failure, so Promise.all doesn't reject
            }
            return res.json();
        });
    });

    const results = await Promise.all(fetchPromises);
    allUpcomingGames = results.flat(); // Combine arrays of games from all fetched sports

    if (allUpcomingGames.length === 0) {
        console.warn('No upcoming games found for the selected sports.');
    }

    for (const game of allUpcomingGames) {
      const gameData: DailyGame = {
        id: game.id,
        sportKey: game.sport_key,
        commenceTime: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        bookmakerOdds: game.bookmakers?.map((b: any) => JSON.stringify(b)) || [],
      };
      const gameRef = doc(firestore, 'daily_games', gameData.id);
      // Using non-blocking write
      setDocumentNonBlocking(gameRef, gameData, { merge: true });
    }
    console.log(`Successfully queued writes for ${allUpcomingGames.length} upcoming games.`);
  } catch (error) {
    console.error('Error fetching or saving daily odds:', error);
    throw error; // Re-throw to be caught by the calling component
  }

  // --- 2. Fetch Completed Game Scores (from the last 3 days to be safe) ---
  // The 'scores' endpoint requires a specific sport_key. If 'upcoming' is passed, we loop through all supported sports.
  const scoreSportKeysToFetch = sportKey === 'upcoming' ? Object.values(sportKeyMapping) : [sportKey];
  
  let totalScoresFetched = 0;

  for (const key of scoreSportKeysToFetch) {
      try {
        const scoresApiUrl = `https://api.the-odds-api.com/v4/sports/${key}/scores/?daysFrom=3&apiKey=${API_KEY}`;
        const scoresResponse = await fetch(scoresApiUrl);

        if (!scoresResponse.ok) {
          const errorText = await scoresResponse.text();
          // We won't throw here, just log it, so one failed sport doesn't stop others.
          console.error(`Failed to fetch scores for ${key}: ${scoresResponse.status}`, errorText);
          continue; // Move to the next sport key
        }

        const completedGames: any[] = await scoresResponse.json();
        
        const gamesWithScores = completedGames.filter(game => game.completed && game.scores);

        if (gamesWithScores.length === 0 && sportKey !== 'upcoming') {
            console.warn(`No completed games with scores found for ${key} from the last 3 days.`);
        }

        for (const game of gamesWithScores) {
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
            setDocumentNonBlocking(gameRef, gameData, { merge: true });
            totalScoresFetched++;
          }
        }
      } catch (error) {
        // Catch network errors or other issues during fetch for a single sport
        console.error(`Error processing scores for ${key}:`, error);
        // Continue to the next sport
      }
      
      // Introduce a delay to avoid hitting rate limits when fetching all sports.
      // This is crucial when looping.
      if (scoreSportKeysToFetch.length > 1) {
        await delay(1100); // Wait for ~1.1 second before the next request. Free plan allows roughly 1 req/sec.
      }
  }
  
  console.log(`Successfully queued writes for ${totalScoresFetched} completed games in total.`);
}
