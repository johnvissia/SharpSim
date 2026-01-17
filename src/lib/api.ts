'use client';

import { doc, Firestore } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { DailyGame, CompletedGame } from '@/lib/types';

const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
// Using a proxy to bypass CORS issues in the browser
const API_PROXY_URL = '/api/odds';

/**
 * Fetches daily game odds and completed game scores from The Odds API
 * and saves them to Firestore. This function is designed to run on the client-side.
 * @param firestore The Firestore instance from `useFirestore()`.
 * @param sportKey The key for the sport to fetch (e.g., 'basketball_nba'). Defaults to 'upcoming' for all sports.
 */
export async function fetchAndSaveDailyData(firestore: Firestore, sportKey: string = 'upcoming') {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    const message = 'API Key for The Odds API is missing. Please add your key to .env.local and restart the development server.';
    console.error(message);
    throw new Error(message);
  }

  // --- 1. Fetch Upcoming Game Odds ---
  try {
    // The API call is proxied through our Next.js backend to avoid CORS errors and hide the API key from the client if we wanted to.
    // For this implementation, we will assume a simple client-side fetch. A real production app should proxy this.
    const oddsApiUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${API_KEY}`;
    const oddsResponse = await fetch(oddsApiUrl);

    if (!oddsResponse.ok) {
      const errorText = await oddsResponse.text();
      console.error("The Odds API Response:", errorText);
      throw new Error(`Failed to fetch odds: ${oddsResponse.status}`);
    }

    const upcomingGames: any[] = await oddsResponse.json();

    if (upcomingGames.length === 0) {
        console.warn('No upcoming games found for the selected sport.');
    }

    for (const game of upcomingGames) {
      const gameData: DailyGame = {
        id: game.id,
        sportKey: game.sport_key,
        commenceTime: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        bookmakerOdds: game.bookmakers?.map((b: any) => JSON.stringify(b)) || [],
      };
      const gameRef = doc(firestore, 'daily_games', gameData.id);
      // Using non-blocking write as requested
      setDocumentNonBlocking(gameRef, gameData, { merge: true });
    }
    console.log(`Successfully queued writes for ${upcomingGames.length} upcoming games.`);
  } catch (error) {
    console.error('Error fetching or saving daily odds:', error);
    throw error; // Re-throw to be caught by the calling component
  }

  // --- 2. Fetch Completed Game Scores (from the last 3 days to be safe) ---
  try {
    const scoresApiUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?daysFrom=3&apiKey=${API_KEY}`;
    const scoresResponse = await fetch(scoresApiUrl);

    if (!scoresResponse.ok) {
      const errorText = await scoresResponse.text();
      console.error("The Odds API Response:", errorText);
      throw new Error(`Failed to fetch scores: ${scoresResponse.status}`);
    }

    const completedGames: any[] = await scoresResponse.json();
    
    const gamesWithScores = completedGames.filter(game => game.completed && game.scores);

    if (gamesWithScores.length === 0) {
        console.warn('No completed games with scores found from the last 3 days.');
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
      }
    }
    console.log(`Successfully queued writes for ${gamesWithScores.length} completed games.`);
  } catch (error) {
    console.error('Error fetching or saving completed scores:', error);
    throw error; // Re-throw to be caught by the calling component
  }
}
