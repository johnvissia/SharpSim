'use client';

import { useMemo, useState } from 'react';
import { GameCard } from './game-card';
import type { Game, DailyGame, Team, SportsbookOdds, Odds, SportName } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { sportKeyMapping } from '@/lib/sports';

// Create a reverse mapping to get SportName from sport_key
const sportNameMapping: { [key: string]: SportName | undefined } = Object.entries(sportKeyMapping).reduce((acc, [name, key]) => {
    acc[key] = name as SportName;
    return acc;
}, {} as { [key: string]: SportName });

/**
 * Transforms raw DailyGame data from Firestore into the Game format required by UI components.
 * @param dailyGames - An array of DailyGame objects from Firestore.
 * @returns An array of Game objects ready for display.
 */
const transformDailyGamesToGames = (dailyGames: DailyGame[] | null): Game[] => {
    if (!dailyGames) return [];
    
    return dailyGames.map((dg): Game | null => {
        const sportName = sportNameMapping[dg.sportKey];
        if (!sportName) {
            console.warn(`No sport name mapping for key: ${dg.sportKey}`);
            return null; // Skip games with unmapped sports
        }

        const allOdds: SportsbookOdds[] = (dg.bookmakerOdds || []).map((jsonString: string): SportsbookOdds | null => {
            try {
                const bookmaker = JSON.parse(jsonString);

                // Find markets
                const h2hMarket = bookmaker.markets.find((m: any) => m.key === 'h2h');
                const spreadsMarket = bookmaker.markets.find((m: any) => m.key === 'spreads');
                const totalsMarket = bookmaker.markets.find((m: any) => m.key === 'totals');

                if (!h2hMarket) return null;

                // Find outcomes
                const homeMoneylineOutcome = h2hMarket.outcomes.find((o: any) => o.name === dg.homeTeam);
                const awayMoneylineOutcome = h2hMarket.outcomes.find((o: any) => o.name === dg.awayTeam);
                if (!homeMoneylineOutcome || !awayMoneylineOutcome) return null;

                const moneyline = { home: homeMoneylineOutcome.price, away: awayMoneylineOutcome.price };

                let spread: Odds['spread'] = { points: 0, home: 0, away: 0 };
                if (spreadsMarket) {
                    const homeSpreadOutcome = spreadsMarket.outcomes.find((o: any) => o.name === dg.homeTeam);
                    const awaySpreadOutcome = spreadsMarket.outcomes.find((o: any) => o.name === dg.awayTeam);
                    if (homeSpreadOutcome && awaySpreadOutcome) {
                        spread = { points: homeSpreadOutcome.point, home: homeSpreadOutcome.price, away: awaySpreadOutcome.price };
                    }
                }

                let total: Odds['total'] = { points: 0, over: 0, under: 0 };
                if (totalsMarket && totalsMarket.outcomes.length >= 2) {
                    total = {
                        points: totalsMarket.outcomes[0].point,
                        over: totalsMarket.outcomes.find((o: any) => o.name === 'Over')?.price || 0,
                        under: totalsMarket.outcomes.find((o: any) => o.name === 'Under')?.price || 0,
                    };
                }
                
                return {
                    sportsbook: bookmaker.title,
                    odds: { moneyline, spread, total },
                };

            } catch (e) {
                console.error("Failed to parse bookmaker odds:", e);
                return null;
            }
        }).filter((o): o is SportsbookOdds => o !== null);

        if (allOdds.length === 0) {
            return null; // Don't render games without any valid odds
        }

        const bestOdds = allOdds[0].odds; // Use first bookmaker's odds as the "best" for now

        const homeTeam: Team = {
            id: dg.homeTeam,
            name: dg.homeTeam,
            logo: '',
            record: '', // Data not available in daily_games collection
            players: [], // Data not available in daily_games collection
        };

        const awayTeam: Team = {
            id: dg.awayTeam,
            name: dg.awayTeam,
            logo: '',
            record: '', // Data not available in daily_games collection
            players: [], // Data not available in daily_games collection
        };

        return {
            id: dg.id,
            sport: sportName,
            startTime: dg.commenceTime,
            homeTeam,
            awayTeam,
            allOdds,
            odds: bestOdds,
        };
    }).filter((g): g is Game => g !== null);
};

type GameFeedProps = {
  selectedSport: string;
};

export function GameFeed({ selectedSport }: GameFeedProps) {
  const firestore = useFirestore();
  
  // Set up the real-time listener for the daily_games collection
  const dailyGamesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'daily_games'), orderBy('commenceTime'));
  }, [firestore]);
  
  const { data: dailyGames, isLoading } = useCollection<DailyGame>(dailyGamesQuery);

  // Mock user favorites, to be replaced with real data later
  const [favoriteSports, setFavoriteSports] = useState<string[]>(['NFL', 'NBA']);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(['Golden State Warriors', 'Kansas City Chiefs']);

  // Transform the raw data from Firestore into the format the UI needs
  const games = useMemo(() => transformDailyGamesToGames(dailyGames), [dailyGames]);

  // Filter and sort games based on user selection and favorites
  const filteredAndSortedGames = useMemo(() => {
    const filteredGames = games.filter(game => 
      selectedSport === 'All' || game.sport === selectedSport
    );

    return [...filteredGames].sort((a, b) => {
        const aIsFavSport = favoriteSports.includes(a.sport);
        const bIsFavSport = favoriteSports.includes(b.sport);
        const aIsFavTeam = favoriteTeams.includes(a.homeTeam.name) || favoriteTeams.includes(a.awayTeam.name);
        const bIsFavTeam = favoriteTeams.includes(b.homeTeam.name) || favoriteTeams.includes(b.awayTeam.name);

        if (aIsFavSport && !bIsFavSport) return -1;
        if (!aIsFavSport && bIsFavSport) return 1;
        if (aIsFavTeam && !bIsFavTeam) return -1;
        if (!aIsFavTeam && bIsFavTeam) return 1;

        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [games, selectedSport, favoriteSports, favoriteTeams]);

  // Show loading skeletons only on the initial load when there's no data yet.
  if (isLoading && !dailyGames) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredAndSortedGames.length > 0 ? (
        filteredAndSortedGames.map((game) => (
            <GameCard key={game.id} game={game} />
        ))
      ) : (
        <p className="text-muted-foreground md:col-span-2 lg:col-span-3 xl:col-span-4">
            Loading today's lines...
        </p>
      )}
    </div>
  );
}
