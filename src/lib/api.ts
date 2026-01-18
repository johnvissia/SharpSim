'use client';

import { doc, Firestore, writeBatch } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { DailyGame, CompletedGame } from '@/lib/types';
import { sportKeyMapping } from './sports';

const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;

// Helper function to introduce a delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Fetches daily game odds and completed game scores from The Odds API
 * and saves them to Firestore. This function is designed to run on the client-side.
 * @param firestore The Firestore instance from `useFirestore()`.
 * @param sportKey The key for the sport to fetch (e.g., 'basketball_nba'). If 'upcoming', it fetches all configured sports.
 */
export async function fetchAndSaveDailyData(firestore: Firestore, sportKey: string = 'upcoming') {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    const message = 'API Key for The Odds API is missing. Please add your key to .env file and restart the development server.';
    console.error(message);
    throw new Error(message);
  }
  
  // 1. The Master Sports Map
  const sportsRequests = [
    { key: 'basketball_nba', category: 'NBA' },
    { key: 'americanfootball_nfl', category: 'NFL' },
    { key: 'baseball_mlb', category: 'MLB' },
    { key: 'icehockey_nhl', category: 'NHL' },
    { key: 'soccer_epl', category: 'Soccer' },
    { key: 'basketball_wnba', category: 'WNBA' },
    { key: 'americanfootball_ncaaf', category: 'NCAAF' },
    { key: 'basketball_ncaab', category: 'NCAAM' },
    { key: 'basketball_ncaaw', category: 'NCAAW' }
  ];

  // Determine which sports to fetch based on the input
  const sportsToFetch = sportKey === 'upcoming' 
    ? sportsRequests 
    : sportsRequests.filter(s => s.key === sportKey);

  // --- 1. Fetch Upcoming Game Odds ---
  try {
    // 2. The Safe Fetch Loop
    const fetchPromises = sportsToFetch.map(sport => {
        const oddsApiUrl = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds/?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${API_KEY}`;
        return fetch(oddsApiUrl)
            .then(async (res) => {
                if (!res.ok) {
                    const errorText = await res.text();
                    console.warn(`Failed to fetch odds for ${sport.category} (${sport.key}): ${res.status}`, errorText);
                    return []; // Return empty array on failure so Promise.all doesn't reject
                }
                return res.json();
            })
            .catch(error => {
                console.warn(`Network error fetching odds for ${sport.category} (${sport.key}):`, error);
                return []; // Gracefully handle fetch error by returning an empty array
            });
    });

    const results = await Promise.all(fetchPromises);
    
    // 3. Data Processing
    const allUpcomingGames: any[] = results.flat();

    if (allUpcomingGames.length > 0) {
        const batch = writeBatch(firestore);
        for (const game of allUpcomingGames) {
          // The API response `sport_key` is used to tag the data.
          // The transformation to a display name happens later in the UI components.
          const gameData: DailyGame = {
            id: game.id,
            sportKey: game.sport_key,
            commenceTime: game.commence_time,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            bookmakerOdds: game.bookmakers?.map((b: any) => JSON.stringify(b)) || [],
          };
          const gameRef = doc(firestore, 'daily_games', gameData.id);
          batch.set(gameRef, gameData, { merge: true });
        }
        await batch.commit();
        console.log(`Successfully committed a batch of ${allUpcomingGames.length} upcoming games.`);
    } else {
        console.warn('No upcoming games found for the selected sports.');
    }
  } catch (error) {
    console.error('Error fetching or saving daily odds:', error);
    throw error; // Re-throw to be caught by the calling component
  }

  // --- 2. Fetch Completed Game Scores (from the last 3 days to be safe) ---
  const scoreSportKeysToFetch = sportKey === 'upcoming' 
    ? sportsRequests.map(s => s.key) 
    : sportsToFetch.map(s => s.key);
  
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
