'use client';

import { useState, useEffect, useMemo } from 'react';
import { GameFeed } from '@/components/dashboard/game-feed';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, orderBy, query, where, writeBatch, increment } from 'firebase/firestore';
import { fetchAndSaveDailyData } from '@/lib/api';
import { fetchEspnSchedule } from '@/lib/espn';
import { gradeUserBets, calculateLegResult } from '@/lib/bet-grading';
import type { Game, Sport, SystemStatus, DailyGame, TeamRanking, Team, SportsbookOdds, UserBet, ParlayLeg, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader } from 'lucide-react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { BetSlip } from '@/components/dashboard/BetSlip';
import { GameDetailModal } from '@/components/dashboard/GameDetailModal';
import { sportNameMapping } from '@/lib/sports';
import { getConference } from '@/lib/ncaa-conferences';

// This function is now being moved from game-feed.tsx to page.tsx
const transformDailyGamesToGames = (
    dailyGames: DailyGame[] | null,
    rankingsMap: Map<string, { rank: number; conference: string }>
): Game[] => {
    if (!dailyGames) return [];
    
    return dailyGames.map((dg): Game | null => {
        const sportName = sportNameMapping[dg.sportKey];
        if (!sportName) {
            console.warn(`No sport name mapping for key: ${dg.sportKey}`);
            return null;
        }

        const allOdds: SportsbookOdds[] = (dg.bookmakerOdds || []).map((jsonString: string): SportsbookOdds | null => {
            try {
                const bookmaker = JSON.parse(jsonString);
                const h2hMarket = bookmaker.markets.find((m: any) => m.key === 'h2h');
                const spreadsMarket = bookmaker.markets.find((m: any) => m.key === 'spreads');
                const totalsMarket = bookmaker.markets.find((m: any) => m.key === 'totals');

                const moneyline = h2hMarket ? {
                    home: h2hMarket.outcomes.find((o: any) => o.name.trim() === dg.homeTeam.trim())?.price || 0,
                    away: h2hMarket.outcomes.find((o: any) => o.name.trim() === dg.awayTeam.trim())?.price || 0,
                } : null;

                if (!moneyline || !moneyline.home || !moneyline.away) return null;

                let spread = { points: 0, home: 0, away: 0 };
                if (spreadsMarket) {
                    const homeSpreadOutcome = spreadsMarket.outcomes.find((o: any) => o.name.trim() === dg.homeTeam.trim());
                    const awaySpreadOutcome = spreadsMarket.outcomes.find((o: any) => o.name.trim() === dg.awayTeam.trim());
                    if (homeSpreadOutcome && awaySpreadOutcome) {
                        spread = { points: homeSpreadOutcome.point, home: homeSpreadOutcome.price, away: awaySpreadOutcome.price };
                    }
                }

                let total = { points: 0, over: 0, under: 0 };
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
                return null;
            }
        }).filter((o): o is SportsbookOdds => o !== null);

        const homeRankingInfo = rankingsMap.get(dg.homeTeam);
        const homeConference = homeRankingInfo?.conference || getConference(dg.homeTeam);
        
        const homeTeam: Team = {
            id: dg.homeTeam,
            name: dg.homeTeam,
            logo: '', // Will be populated by ESPN data
            players: [],
            rank: homeRankingInfo?.rank,
            conference: homeConference,
        };
        
        const awayRankingInfo = rankingsMap.get(dg.awayTeam);
        const awayConference = awayRankingInfo?.conference || getConference(dg.awayTeam);

        const awayTeam: Team = {
            id: dg.awayTeam,
            name: dg.awayTeam,
            logo: '', // Will be populated by ESPN data
            players: [],
            rank: awayRankingInfo?.rank,
            conference: awayConference,
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
            game.odds = allOdds[0].odds;
        }

        return game;
    }).filter((g): g is Game => g !== null);
};


export default function DashboardPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [espnGames, setEspnGames] = useState<Game[]>([]);
  const [isLoadingEspn, setIsLoadingEspn] = useState(true);

  const categories = ['All', 'Favorites', 'NBA', 'NCAAM', 'NHL', 'NFL', 'NCAAF'];

  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
  const favoriteTeams = useMemo(() => userProfile?.favoriteTeams || [], [userProfile]);
  
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

  const completedGamesQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'completed_games');
  }, [firestore]);
  const { data: completedGames } = useCollection<CompletedGame>(completedGamesQuery);

  const pendingBetsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'bets'), where('status', '==', 'pending'));
  }, [user, firestore]);
  const { data: pendingBets } = useCollection<UserBet>(pendingBetsQuery);

  const activeBetGameIds = useMemo(() => {
    if (!pendingBets) return new Set<string>();
    const gameIds = new Set<string>();
    pendingBets.forEach(bet => {
        if (bet.betType === 'parlay' && bet.legs) {
            bet.legs.forEach(leg => gameIds.add(leg.gameId));
        } else if (bet.gameId) {
            if (bet.gameId.includes(',')) {
                bet.gameId.split(',').forEach(id => gameIds.add(id));
            } else {
                gameIds.add(bet.gameId);
            }
        }
    });
    return gameIds;
  }, [pendingBets]);

  useEffect(() => {
    const runAutoSettlement = async () => {
      if (!firestore || !user || !pendingBets || !completedGames || pendingBets.length === 0 || completedGames.length === 0) {
        return;
      }

      const completedGamesMap = new Map(completedGames.map(g => [g.id, g]));
      const { updates, totalPayout } = gradeUserBets(pendingBets, completedGamesMap);

      if (updates.length > 0) {
        console.log(`Auto-settlement: Found ${updates.length} bets to update.`);
        const batch = writeBatch(firestore);
        
        updates.forEach(update => {
          const betRef = doc(firestore, 'users', user.uid, 'bets', update.betId);
          batch.update(betRef, update.payload);
        });

        if (totalPayout > 0) {
          const userRef = doc(firestore, 'users', user.uid);
          batch.update(userRef, { balance: increment(totalPayout) });
        }
        
        try {
          await batch.commit();
          toast({
              title: "Bets Settled",
              description: `${updates.length} of your bets have been automatically graded.`
          });
        } catch (error) {
          console.error("Auto-settlement failed:", error);
        }
      }
    };

    runAutoSettlement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedGames, pendingBets, firestore, user]);

  useEffect(() => {
    const getEspnData = async () => {
        setIsLoadingEspn(true);
        const games = await fetchEspnSchedule();
        setEspnGames(games);
        setIsLoadingEspn(false);
    };
    getEspnData();
  }, []);
  
  const mergedGames = useMemo(() => {
    const teamNameNormalizationMap: Record<string, string> = {
      'LA Clippers': 'Los Angeles Clippers',
    };
    const normalizeTeamName = (name: string) => teamNameNormalizationMap[name] || name;

    const rankingsMap = new Map(rankings?.map(r => [r.teamName, { rank: r.rank, conference: r.conference }]) || []);
    const oddsGames = transformDailyGamesToGames(dailyGames, rankingsMap);

    const finalGames = new Map<string, Game>();

    espnGames.forEach(espnGame => {
        const homeName = normalizeTeamName(espnGame.homeTeam.name);
        const awayName = normalizeTeamName(espnGame.awayTeam.name);
        const key = `${espnGame.sport}-${homeName}-${awayName}`;
        
        const homeRankingInfo = rankingsMap.get(espnGame.homeTeam.name);
        const awayRankingInfo = rankingsMap.get(espnGame.awayTeam.name);
        const enrichedEspnGame = {
            ...espnGame,
            homeTeam: {
                ...espnGame.homeTeam,
                rank: homeRankingInfo?.rank,
                conference: homeRankingInfo?.conference || getConference(espnGame.homeTeam.name)
            },
            awayTeam: {
                ...espnGame.awayTeam,
                rank: awayRankingInfo?.rank,
                conference: awayRankingInfo?.conference || getConference(espnGame.awayTeam.name)
            }
        };
        finalGames.set(key, enrichedEspnGame);
    });

    oddsGames.forEach(oddsGame => {
        const homeName = normalizeTeamName(oddsGame.homeTeam.name);
        const awayName = normalizeTeamName(oddsGame.awayTeam.name);
        const key = `${oddsGame.sport}-${homeName}-${awayName}`;
        const existingGame = finalGames.get(key);

        if (existingGame) {
            finalGames.set(key, {
                ...existingGame,
                odds: oddsGame.odds,
                allOdds: oddsGame.allOdds,
                id: existingGame.id,
                oddsApiId: oddsGame.id,
            });
        } else {
            finalGames.set(key, { ...oddsGame, id: oddsGame.id, oddsApiId: oddsGame.id });
        }
    });
    
    if (isLoadingEspn && finalGames.size === 0) {
        return oddsGames;
    }
    
    return Array.from(finalGames.values());

  }, [dailyGames, rankings, espnGames, isLoadingEspn]);

  const filteredAndSortedGames = useMemo(() => {
    const now = new Date();
    const finishedGameCutoff = 4 * 60 * 60 * 1000; 

    return mergedGames.filter(game => {
        if (selectedCategory === 'Favorites') {
            if (!favoriteTeams.includes(game.homeTeam.name) && !favoriteTeams.includes(game.awayTeam.name)) {
                return false;
            }
        } else if (selectedCategory !== 'All') {
            if (game.sport !== selectedCategory) {
                return false;
            }
        }

        if (game.statusState === 'post') {
            const gameTime = new Date(game.startTime).getTime();
            if (now.getTime() - gameTime > finishedGameCutoff) {
                return false;
            }
        }

        return true;
    })
    .sort((a, b) => {
        const isFavA = favoriteTeams.includes(a.homeTeam.name) || favoriteTeams.includes(a.awayTeam.name);
        const isFavB = favoriteTeams.includes(b.homeTeam.name) || favoriteTeams.includes(b.awayTeam.name);

        if (isFavA !== isFavB) {
            return isFavA ? -1 : 1;
        }

        const aHasBet = !!a.oddsApiId && activeBetGameIds.has(a.oddsApiId);
        const bHasBet = !!b.oddsApiId && activeBetGameIds.has(b.oddsApiId);

        if (aHasBet !== bHasBet) {
            return aHasBet ? -1 : 1;
        }

        const statusOrder = {
            'in': 1,
            'pre': 2,
            'post': 3,
        };

        const aStatus = a.statusState ?? 'pre';
        const bStatus = b.statusState ?? 'pre';

        const aOrder = statusOrder[aStatus as keyof typeof statusOrder] || 4;
        const bOrder = statusOrder[bStatus as keyof typeof statusOrder] || 4;
        
        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        if (aStatus === 'post') {
            return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        }
        
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [mergedGames, selectedCategory, activeBetGameIds, favoriteTeams]);


  const showLoadingSpinner = isUserLoading || (isLoadingGames && !dailyGames);

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 py-3 mb-4">
            <div className="flex gap-2 overflow-x-auto px-4 no-scrollbar">
                {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`
                    px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all
                    ${selectedCategory === cat 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}
                    `}
                >
                    {cat}
                </button>
                ))}
            </div>
        </div>

        <div className="px-4 pb-8">
            {showLoadingSpinner ? (
            <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
                <Loader className="h-12 w-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                {isUserLoading ? 'Authenticating...' : 'Loading Daily Lines...'}
                </h2>
                <p className="text-muted-foreground">
                {isUserLoading ? 'Preparing your session...' : 'Getting the latest game information.'}
                </p>
            </div>
            ) : (
            <GameFeed
                games={filteredAndSortedGames}
                isLoading={isLoadingGames || isLoadingEspn}
                onGameClick={setSelectedGame}
                activeBetGameIds={activeBetGameIds}
            />
            )}
        </div>
      </div>
      <BetSlip />
      <GameDetailModal game={selectedGame} isOpen={!!selectedGame} onClose={() => setSelectedGame(null)} />
    </>
  );
}
