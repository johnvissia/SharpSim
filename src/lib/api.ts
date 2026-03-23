'use client';

import { doc, Firestore, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import type { DailyGame, CompletedGame } from '@/lib/types';

interface CompletedPlayerStats {
  id: string;
  gameId: string;
  playerId: string;
  playerName: string;
  gameDate: string;
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    threePointersMade: number;
  };
  completed: boolean;
}

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

    // ============ SAVE TO FIRESTORE IN BATCHES ============
    if (allGames.length === 0 && successfullyFetchedSportKeys.length === 0) {
      console.log("No new games to save.");
      return;
    }

    const dailyGamesCollectionRef = collection(firestore, 'daily_games');

    // 1. Delete existing games for sports we fetched
    if (successfullyFetchedSportKeys.length > 0) {
      const q = query(dailyGamesCollectionRef, where('sportKey', 'in', successfullyFetchedSportKeys));
      const existingGamesSnapshot = await getDocs(q);

      if (!existingGamesSnapshot.empty) {
        console.log(`Deleting ${existingGamesSnapshot.size} existing games for: ${successfullyFetchedSportKeys.join(', ')}`);

        // Process deletes in batches of 500
        const docs = existingGamesSnapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(firestore);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
          console.log(`  Deleted batch of ${chunk.length} old games...`);
        }
      }
    }

    // 2. Save new games in batches of 500
    if (allGames.length > 0) {
      console.log(`Saving ${allGames.length} new games...`);
      for (let i = 0; i < allGames.length; i += 500) {
        const batch = writeBatch(firestore);
        const chunk = allGames.slice(i, i + 500);

        chunk.forEach(game => {
          const gameData: DailyGame = {
            id: game.id,
            sportKey: game.sport_key,
            commenceTime: game.commence_time,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            bookmakerOdds: game.bookmakers?.map((b: any) => JSON.stringify(b)) || [],
          };
          const gameRef = doc(dailyGamesCollectionRef, gameData.id);
          batch.set(gameRef, gameData);
        });

        await batch.commit();
        console.log(`  Saved batch of ${chunk.length} games...`);
      }
    }

    console.log(`SUCCESS: ${allGames.length} games synced to Firestore across ${successfullyFetchedSportKeys.length} sports.`);

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

/**
 * Fetches NBA player stats from ESPN API and saves them to Firestore.
 * This enables grading of player prop bets.
 */
export async function syncNBAPlayerStats(firestore: Firestore, daysBack: number = 3) {
  console.log(`[PLAYER STATS] Starting NBA player stats sync for last ${daysBack} days...`);

  const allPlayerStats: CompletedPlayerStats[] = [];

  try {
    const dates: string[] = [];
    for (let i = 0; i <= daysBack; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0].replace(/-/g, ''));
    }

    console.log(`[PLAYER STATS] Fetching stats for dates:`, dates);

    for (const dateStr of dates) {
      try {
        console.log(`[PLAYER STATS] Fetching games for ${dateStr}...`);

        const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
        const scoreboardRes = await fetch(scoreboardUrl);

        if (!scoreboardRes.ok) {
          console.error(`[PLAYER STATS] Failed to fetch scoreboard for ${dateStr}`);
          await delay(500);
          continue;
        }

        const scoreboardData = await scoreboardRes.json();
        const games = scoreboardData.events || [];

        console.log(`[PLAYER STATS] Found ${games.length} games on ${dateStr}`);

        for (const game of games) {
          if (game.status?.type?.state !== 'post') {
            continue;
          }

          const gameId = game.id;
          const gameDate = game.date;

          try {
            console.log(`[PLAYER STATS] Fetching box score for game ${gameId}...`);

            const boxScoreUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
            const boxScoreRes = await fetch(boxScoreUrl);

            if (!boxScoreRes.ok) {
              console.error(`[PLAYER STATS] Failed to fetch box score for game ${gameId}`);
              await delay(500);
              continue;
            }

            const boxScoreData = await boxScoreRes.json();
            const teamsData = boxScoreData.boxscore?.players || [];

            for (const team of teamsData) {
              const labels: string[] = team.statistics?.[0]?.labels || [];
              const athletes = team.statistics?.[0]?.athletes || [];

              if (labels.length === 0 || athletes.length === 0) continue;

              for (const player of athletes) {
                const stats: string[] = player.stats || [];
                const statsMap = new Map(labels.map((label, index) => [label.toLowerCase(), stats[index]]));

                const getStat = (key: string) => parseFloat(statsMap.get(key) || '0') || 0;

                // Handle DNP - Did Not Play
                const minutes = statsMap.get('min');
                if (!minutes || minutes === '0' || minutes === '0:00') {
                  continue; // Skip players who didn't play
                }

                const points = getStat('pts');
                const rebounds = getStat('reb');
                const assists = getStat('ast');
                const steals = getStat('stl');
                const blocks = getStat('blk');
                const turnovers = getStat('to');

                // 3PM-A is like "2-5", so we need to parse it
                const threePointStr = statsMap.get('3pm-a') || '0-0';
                const threePointersMade = parseFloat(threePointStr.split('-')[0]) || 0;

                const playerName = player.athlete?.displayName || 'Unknown';
                const playerId = player.athlete?.id || player.athlete?.displayName?.replace(/\s+/g, '_');

                if (!playerId) continue;

                const completedStat: CompletedPlayerStats = {
                  id: `${gameId}_${playerId}`,
                  gameId: gameId,
                  playerId: playerId,
                  playerName: playerName,
                  gameDate: gameDate,
                  stats: {
                    points,
                    rebounds,
                    assists,
                    steals,
                    blocks,
                    turnovers,
                    threePointersMade,
                  },
                  completed: true,
                };

                allPlayerStats.push(completedStat);
                console.log(`[PLAYER STATS] ✓ ${playerName}: ${points} PTS, ${rebounds} REB, ${assists} AST`);
              }
            }

            await delay(500);

          } catch (err) {
            console.error(`[PLAYER STATS] Error processing game ${gameId}:`, err);
            await delay(500);
          }
        }

        await delay(1000);

      } catch (err) {
        console.error(`[PLAYER STATS] Error fetching date ${dateStr}:`, err);
        await delay(1000);
      }
    }

    console.log(`[PLAYER STATS] Total player stats collected: ${allPlayerStats.length}`);

    if (allPlayerStats.length > 0) {
      let batch = writeBatch(firestore);
      const playerStatsRef = collection(firestore, 'completed_player_stats');

      let batchCount = 0;
      const maxBatchSize = 500;

      for (const stat of allPlayerStats) {
        const statRef = doc(playerStatsRef, stat.id);
        batch.set(statRef, stat, { merge: true });
        batchCount++;

        if (batchCount >= maxBatchSize) {
          await batch.commit();
          console.log(`[PLAYER STATS] Committed batch of ${batchCount} stats`);
          batch = writeBatch(firestore); // Re-initialize the batch
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log(`[PLAYER STATS] Committed final batch of ${batchCount} stats`);
      }

      console.log(`[PLAYER STATS] ✓ ${allPlayerStats.length} player stats saved to Firestore`);
    } else {
      console.log(`[PLAYER STATS] No player stats to save`);
    }

  } catch (error) {
    console.error('[PLAYER STATS] Unexpected error:', error);
    throw error;
  }

  console.log('[PLAYER STATS] ✓ NBA player stats sync complete!');
}
/**
 * Fetches player prop odds (Points) from The Odds API and saves them to Firestore.
 */
export async function syncPlayerProps(firestore: Firestore) {
  const API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
  if (!API_KEY) throw new Error('Odds API Key missing');

  console.log("[PROPS] Starting Player Props sync...");

  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${API_KEY}&regions=us&markets=player_points&oddsFormat=american&bookmakers=pinnacle,draftkings,fanduel`);
    if (!res.ok) throw new Error(`Odds API error: ${res.status}`);

    const data = await res.json();
    console.log(`[PROPS] Fetched ${data.length} games with potential props`);

    const propsCollectionRef = collection(firestore, 'player_props');
    let batch = writeBatch(firestore);
    let count = 0;

    for (const game of data) {
      if (!game.bookmakers || game.bookmakers.length === 0) continue;

      // Extract props from bookmakers (prefer Pinnacle/DraftKings)
      const bookmaker = game.bookmakers.find((b: any) => b.key === 'pinnacle') || game.bookmakers[0];
      const market = bookmaker.markets.find((m: any) => m.key === 'player_points');

      if (!market || !market.outcomes) continue;

      // Group outcomes by player name to create O/U pairs
      const playerMap = new Map<string, any>();

      market.outcomes.forEach((outcome: any) => {
        const playerName = outcome.description;
        if (!playerMap.has(playerName)) {
          playerMap.set(playerName, {
            id: `${game.id}_${playerName.replace(/\s+/g, '_')}`,
            gameId: game.id,
            playerName: playerName,
            teamName: outcome.name === 'Over' ? 'TBD' : 'TBD', // We'll infer from context if possible
            matchup: `${game.away_team} @ ${game.home_team}`,
            commenceTime: game.commence_time,
            market: 'Points',
          });
        }

        const prop = playerMap.get(playerName);
        if (outcome.name === 'Over') {
          prop.line = outcome.point;
          prop.overOdds = outcome.price;
        } else if (outcome.name === 'Under') {
          prop.line = outcome.point;
          prop.underOdds = outcome.price;
        }
      });

      // Add to batch
      for (const prop of playerMap.values()) {
        if (!prop.line || !prop.overOdds || !prop.underOdds) continue;
        const propRef = doc(propsCollectionRef, prop.id);
        batch.set(propRef, prop, { merge: true });
        count++;

        if (count % 500 === 0) {
          await batch.commit();
          batch = writeBatch(firestore);
        }
      }
    }

    await batch.commit();
    console.log(`[PROPS] Successfully synced ${count} player props`);

  } catch (err) {
    console.error('[PROPS] Sync Failed:', err);
    throw err;
  }
}
