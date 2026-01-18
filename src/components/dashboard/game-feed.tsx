'use client';

import { useMemo, useState } from 'react';
import { GameCard } from './game-card';
import type { Game, DailyGame, Team, SportsbookOdds, Odds, SportName, TeamRanking } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { sportNameMapping } from '@/lib/sports';
import { getTeamLogoUrl } from '@/lib/team-logos';

/**
 * Transforms raw DailyGame data from Firestore into the Game format required by UI components.
 * @param dailyGames - An array of DailyGame objects from Firestore.
 * @param rankingsMap - A map of team names to their rank and conference.
 * @returns An array of Game objects ready for display.
 */
const transformDailyGamesToGames = (
    dailyGames: DailyGame[] | null,
    rankingsMap: Map<string, { rank: number; conference: string }>
): Game[] => {
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

                // Odds are not mandatory. If h2h market is missing, we still want to show the game.
                if (!h2hMarket) return null;

                // Find outcomes by comparing trimmed names for robustness
                const homeMoneylineOutcome = h2hMarket.outcomes.find((o: any) => o.name.trim() === dg.homeTeam.trim());
                const awayMoneylineOutcome = h2hMarket.outcomes.find((o: any) => o.name.trim() === dg.awayTeam.trim());
                if (!homeMoneylineOutcome || !awayMoneylineOutcome) return null;

                const moneyline = { home: homeMoneylineOutcome.price, away: awayMoneylineOutcome.price };

                let spread: Odds['spread'] = { points: 0, home: 0, away: 0 };
                if (spreadsMarket) {
                    const homeSpreadOutcome = spreadsMarket.outcomes.find((o: any) => o.name.trim() === dg.homeTeam.trim());
                    const awaySpreadOutcome = spreadsMarket.outcomes.find((o: any) => o.name.trim() === dg.awayTeam.trim());
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

        const homeRankingInfo = rankingsMap.get(dg.homeTeam);
        const homeTeam: Team = {
            id: dg.homeTeam,
            name: dg.homeTeam,
            logo: getTeamLogoUrl(dg.homeTeam, sportName),
            record: '', // Data not available in daily_games collection
            players: [], // Data not available in daily_games collection
            rank: homeRankingInfo?.rank,
            conference: homeRankingInfo?.conference,
        };
        
        const awayRankingInfo = rankingsMap.get(dg.awayTeam);
        const awayTeam: Team = {
            id: dg.awayTeam,
            name: dg.awayTeam,
            logo: getTeamLogoUrl(dg.awayTeam, sportName),
            record: '', // Data not available in daily_games collection
            players: [], // Data not available in daily_games collection
            rank: awayRankingInfo?.rank,
            conference: awayRankingInfo?.conference,
        };

        const game: Game = {
            id: dg.id,
            sport: sportName,
            startTime: dg.commenceTime,
            homeTeam,
            awayTeam,
        };

        if (allOdds.length > 0) {
            game.allOdds = allOdds;
            game.odds = allOdds[0].odds; // Use first bookmaker's odds as the "best" for now
        }

        return game;

    }).filter((g): g is Game => g !== null);
};

type GameFeedProps = {
  selectedSport: string;
  selectedConference: string;
  sortBy: string;
};

export function GameFeed({ selectedSport, selectedConference, sortBy }: GameFeedProps) {
  const firestore = useFirestore();
  
  const dailyGamesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'daily_games'), orderBy('commenceTime'));
  }, [firestore]);
  
  const { data: dailyGames, isLoading: isLoadingGames } = useCollection<DailyGame>(dailyGamesQuery);

  const rankingsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'rankings');
  }, [firestore]);

  const { data: rankings, isLoading: isLoadingRankings } = useCollection<TeamRanking>(rankingsQuery);

  const rankingsMap = useMemo(() => {
    if (!rankings) return new Map<string, { rank: number; conference: string }>();
    return new Map(rankings.map(r => [r.teamName, { rank: r.rank, conference: r.conference }]));
  }, [rankings]);


  const [favoriteSports, setFavoriteSports] = useState<string[]>(['NFL', 'NBA']);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(['Golden State Warriors', 'Kansas City Chiefs']);

  const games = useMemo(() => transformDailyGamesToGames(dailyGames, rankingsMap), [dailyGames, rankingsMap]);

  const filteredAndSortedGames = useMemo(() => {
    const ncaaSports = ['NCAAF', 'NCAAM', 'NCAAW'];

    const filtered = games.filter(game => {
        // Filter by selected sport first
        const sportMatch = selectedSport === 'All' || game.sport === selectedSport;
        if (!sportMatch) return false;

        const isNCAAGame = ncaaSports.includes(game.sport as any);

        // Special filtering for NCAA games
        if (isNCAAGame) {
            // IF "All Sports" is selected, ONLY show ranked NCAA teams to reduce clutter.
            if (selectedSport === 'All') {
                const hasRankedTeam = game.homeTeam.rank || game.awayTeam.rank;
                if (!hasRankedTeam) {
                    return false;
                }
            }

            // Apply conference filter if a specific conference is selected.
            if (selectedConference !== 'All') {
                const conferenceMatch = game.homeTeam.conference === selectedConference || game.awayTeam.conference === selectedConference;
                if (!conferenceMatch) {
                    return false;
                }
            }
        }
        
        // If it passes all filters, include it.
        return true;
    });

    // Now, sort the `filtered` array
    return [...filtered].sort((a, b) => {
        // Favorite sorting comes first
        const aIsFavSport = favoriteSports.includes(a.sport);
        const bIsFavSport = favoriteSports.includes(b.sport);
        if (aIsFavSport && !bIsFavSport) return -1;
        if (!aIsFavSport && bIsFavSport) return 1;
        
        const aIsFavTeam = favoriteTeams.includes(a.homeTeam.name) || favoriteTeams.includes(a.awayTeam.name);
        const bIsFavTeam = favoriteTeams.includes(b.homeTeam.name) || favoriteTeams.includes(b.awayTeam.name);
        if (aIsFavTeam && !bIsFavTeam) return -1;
        if (!aIsFavTeam && bIsFavTeam) return 1;

        // Then, apply the main sort logic
        if (sortBy === 'rank') {
            const getGameRank = (game: Game) => Math.min(game.homeTeam.rank ?? Infinity, game.awayTeam.rank ?? Infinity);
            const rankA = getGameRank(a);
            const rankB = getGameRank(b);
            if (rankA !== rankB) {
                return rankA - rankB;
            }
        }

        // Fallback to time sort
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [games, selectedSport, selectedConference, sortBy, favoriteSports, favoriteTeams]);

  const isLoading = isLoadingGames || isLoadingRankings;

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
            Loading today's lines or no games match your filter...
        </p>
      )}
    </div>
  );
}
