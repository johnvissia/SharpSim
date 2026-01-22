'use client';

import { doc, Firestore, writeBatch, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import type { DailyGame, CompletedGame, PlayerProp, PlayerGameStats } from '@/lib/types';
import { nbaTeamAbbreviationToName, mapTank01MarketToApp } from '@/lib/nba-teams';

// Helper function to introduce a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const areDatesOnSameDay = (date1: Date, date2: Date) =>
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();


async function fetchAndAttachPlayerStats(firestore: Firestore) {
    console.log("Starting to fetch and attach player box scores...");
    const rapidApiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
    const rapidApiHost = process.env.NEXT_PUBLIC_RAPIDAPI_HOST;

    if (!rapidApiKey || !rapidApiHost) {
        console.warn("RapidAPI key or host is not configured. Skipping player stats fetch.");
        return;
    }

    const today = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const completedGamesRef = collection(firestore, 'completed_games');
    const q = query(
        completedGamesRef,
        where('sportKey', '==', 'basketball_nba'),
        where('completed', '==', true),
        where('commenceTime', '>=', todayStart.toISOString())
    );
    
    const completedGamesSnapshot = await getDocs(q);
    const oddsApiGames = completedGamesSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as CompletedGame) }));

    if (oddsApiGames.length === 0) {
        console.log("No completed NBA games found in Firestore for today to attach stats to.");
        return;
    }

    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const gameDate = `${year}${month}${day}`;

    const url = `https://tank01-fantasy-stats.p.rapidapi.com/getNBAGames?gameDate=${gameDate}&includePlayerStats=true&itemFormat=json`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': rapidApiHost,
        },
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            console.error(`Failed to fetch box scores from Tank01: ${response.statusText}`);
            return;
        }
        const data = await response.json();
        const tank01Games = data.body?.games;

        if (!tank01Games || tank01Games.length === 0) {
            console.log("No box scores available from Tank01 for today.");
            return;
        }

        const batch = writeBatch(firestore);
        let updatesCount = 0;

        for (const tankGame of tank01Games) {
            if (tankGame.gameStatus !== 'Final') continue;

            const homeTeamFullName = nbaTeamAbbreviationToName[tankGame.HomeTeam];
            const awayTeamFullName = nbaTeamAbbreviationToName[tankGame.AwayTeam];

            const matchingOddsGame = oddsApiGames.find(g => {
                const gameDay = new Date(g.commenceTime);
                return areDatesOnSameDay(gameDay, today) && g.homeTeam === homeTeamFullName && g.awayTeam === awayTeamFullName;
            });
            
            if (matchingOddsGame) {
                const playerStats: PlayerGameStats[] = [];
                const allPlayers = [...(tankGame.playerStats.Away ?? []), ...(tankGame.playerStats.Home ?? [])];

                allPlayers.forEach((player: any) => {
                    if (player.played === "Y") {
                        playerStats.push({
                            playerId: player.PlayerID.toString(),
                            playerName: player.PlayerName,
                            stats: {
                                points: player.points,
                                rebounds: player.rebounds,
                                assists: player.assists,
                                steals: player.steals,
                                blocks: player.blocks,
                                turnovers: player.turnovers,
                                threePointersMade: player.threePointersMade,
                            }
                        });
                    }
                });

                if (playerStats.length > 0) {
                    const gameDocRef = doc(firestore, 'completed_games', matchingOddsGame.id);
                    batch.update(gameDocRef, { playerStats: playerStats });
                    updatesCount++;
                }
            }
        }

        if (updatesCount > 0) {
            await batch.commit();
            console.log(`Successfully attached player stats to ${updatesCount} completed games.`);
        } else {
            console.log("No matching completed games found to attach player stats to.");
        }
    } catch (error) {
        console.error("An error occurred during the player stats fetching process:", error);
    }
}


/**
 * Fetches NBA player props from the Tank01 API and saves them to the corresponding game documents in Firestore.
 * @param firestore The Firestore instance.
 */
async function fetchAndSavePlayerProps(firestore: Firestore) {
  const rapidApiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
  const rapidApiHost = process.env.NEXT_PUBLIC_RAPIDAPI_HOST;

  if (!rapidApiKey || !rapidApiHost) {
    console.warn("RapidAPI key or host is not configured. Skipping player props fetch.");
    return;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const gameDate = `${year}${month}${day}`;

  const url = `https://tank01-fantasy-stats.p.rapidapi.com/getNBABettingOdds?gameDate=${gameDate}&itemFormat=json`;
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': rapidApiHost,
    },
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch player props from Tank01 API:", errorText);
      throw new Error(`Tank01 API Error: ${response.statusText}`);
    }
    const propsData = await response.json();
    const apiGames = propsData.body?.game;

    if (!apiGames || apiGames.length === 0) {
      console.log("No player props available from Tank01 for today.");
      return;
    }
    
    // Get our existing NBA games for today
    const dailyGamesRef = collection(firestore, 'daily_games');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const q = query(
      dailyGamesRef,
      where('sportKey', '==', 'basketball_nba'),
      where('commenceTime', '>=', todayStart.toISOString()),
      where('commenceTime', '<=', todayEnd.toISOString())
    );
    const dailyGamesSnapshot = await getDocs(q);
    const ourGames = dailyGamesSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as DailyGame) }));

    if (ourGames.length === 0) {
        console.log("No NBA games in Firestore for today to match props against.");
        return;
    }

    const batch = writeBatch(firestore);

    apiGames.forEach((apiGame: any) => {
        const homeFullName = nbaTeamAbbreviationToName[apiGame.HomeTeam];
        const awayFullName = nbaTeamAbbreviationToName[apiGame.AwayTeam];

        const matchingGame = ourGames.find(g => g.homeTeam === homeFullName && g.awayTeam === awayFullName);

        if (matchingGame && apiGame.PlayerProps) {
            const playerProps: PlayerProp[] = apiGame.PlayerProps.map((prop: any): PlayerProp | null => {
                const market = mapTank01MarketToApp(prop.PropType);
                if (!market) return null; // Skip unknown prop types

                return {
                    propId: `${matchingGame.id}-${prop.PlayerID}-${market}`, // A unique ID for the market
                    playerId: prop.PlayerID.toString(),
                    playerName: prop.PlayerName,
                    market: market,
                    line: prop.StatValue,
                    overOdds: prop.OverPrice,
                    underOdds: prop.UnderPrice,
                    sportsbook: prop.BookName,
                };
            }).filter((p: PlayerProp | null): p is PlayerProp => p !== null);

            if (playerProps.length > 0) {
                const gameDocRef = doc(firestore, 'daily_games', matchingGame.id);
                batch.update(gameDocRef, { playerProps: playerProps });
            }
        }
    });

    await batch.commit();
    console.log(`Updated player props for ${apiGames.length} matched games.`);

  } catch (error) {
    console.error("An error occurred during the player prop fetching process:", error);
  }
}

/**
 * Fetches daily game odds and completed game scores from The Odds API and saves them to Firestore.
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

  // Fetch Completed Game Scores Sequentially
  const allCompletedGames: CompletedGame[] = [];
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
        const gamesWithScores = data.filter((game: any) => game.scores);
        
        gamesWithScores.forEach((game: any) => {
            const homeScoreStr = game.scores.find((s: any) => s.name === game.home_team)?.score;
            const awayScoreStr = game.scores.find((s: any) => s.name === game.away_team)?.score;
    
            if (homeScoreStr !== undefined && awayScoreStr !== undefined && homeScoreStr !== null && awayScoreStr !== null) {
              allCompletedGames.push({
                id: game.id,
                sportKey: game.sport_key,
                commenceTime: game.commence_time,
                homeTeam: game.home_team,
                awayTeam: game.away_team,
                homeScore: parseInt(homeScoreStr, 10),
                awayScore: parseInt(awayScoreStr, 10),
                completed: game.completed,
              });
            }
        });

      } catch (err) {
        console.error(`Error fetching scores for ${sport.label}:`, err);
      }
      await delay(1500);
    }

    console.log("Total Raw Completed Games Fetched:", allCompletedGames.length);

    if (allCompletedGames.length > 0) {
      const scoresBatch = writeBatch(firestore);
      const completedGamesRef = collection(firestore, 'completed_games');

      allCompletedGames.forEach((game) => {
          const gameRef = doc(completedGamesRef, game.id);
          scoresBatch.set(gameRef, game, { merge: true });
      });

      await scoresBatch.commit();
      console.log(`${allCompletedGames.length} games with scores saved/updated in Firestore.`);
    }
  } catch (error) {
    console.error('An unexpected error occurred during the Firestore scores saving process:', error);
  }
}

/**
 * Fetches player prop odds and stats from the Tank01 API and saves them to Firestore.
 * @param firestore The Firestore instance.
 */
export async function syncPlayerPropsAndStats(firestore: Firestore) {
  console.log("Starting Player Props and Stats sync...");
  try {
    await fetchAndSavePlayerProps(firestore);
    await fetchAndAttachPlayerStats(firestore);
    console.log("Player props and stats sync complete.");
  } catch (error) {
    console.error('An error occurred during the player props and stats sync:', error);
    throw error;
  }
}
