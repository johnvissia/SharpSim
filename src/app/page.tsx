'use client';

import { useState, useEffect, useMemo } from 'react';
import { GameFeed } from '@/components/dashboard/game-feed';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { fetchAndSaveDailyData } from '@/lib/api';
import { fetchEspnSchedule } from '@/lib/espn';
import { gradeUserBets } from '@/lib/bet-grading';
import { getSports } from '@/lib/mock-data';
import type { Game, Sport, SystemStatus, DailyGame, TeamRanking, Team, SportsbookOdds } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Loader } from 'lucide-react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { BetSlip } from '@/components/dashboard/BetSlip';
import { GameDetailModal } from '@/components/dashboard/GameDetailModal';
import { sportNameMapping } from '@/lib/sports';
import { getConference } from '@/lib/ncaa-conferences';
import { isSameDay } from 'date-fns';

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
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState('All');
  const [selectedConference, setSelectedConference] = useState('All');
  const [loadingSports, setLoadingSports] = useState(true);
  const [isFetchingManually, setIsFetchingManually] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [espnGames, setEspnGames] = useState<Game[]>([]); // State for new ESPN data
  const [isLoadingEspn, setIsLoadingEspn] = useState(true);

  const conferenceOptions = ["All", "SEC", "Big 10", "ACC", "Big 12"];

  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const systemStatusRef = useMemoFirebase(() => (firestore ? doc(firestore, 'system', 'status') : null), [firestore]);
  
  // Fetching data previously in GameFeed
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

  // Fetch static sports list
  useEffect(() => {
    const fetchSportsData = async () => {
      setLoadingSports(true);
      const sportsData = await getSports();
      setSports(sportsData);
      setLoadingSports(false);
    };
    fetchSportsData();
  }, []);

  // New effect to fetch live ESPN data
  useEffect(() => {
    const getEspnData = async () => {
        setIsLoadingEspn(true);
        const games = await fetchEspnSchedule();
        setEspnGames(games);
        setIsLoadingEspn(false);
    };
    getEspnData();
  }, []);
  
  const handleManualFetch = async () => {
    if (!firestore || !user || !systemStatusRef) return;
    setIsFetchingManually(true);
    toast({ title: 'Syncing Data...', description: 'Fetching latest odds, scores, and settling bets.' });
    try {
      await fetchAndSaveDailyData(firestore);
      toast({ title: 'Odds Sync Complete!', description: 'Now grading any settled bets.' });
      await gradeUserBets(firestore, user);
      const today = new Date().toISOString().split('T')[0];
      setDocumentNonBlocking(systemStatusRef, { last_updated_date: today }, { merge: true });
      toast({
        title: 'Sync Protocol Complete!',
        description: 'Odds are fresh and bets are settled.',
      });
    } catch (error: any) {
      console.error('Failed during manual sync protocol:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Sync Failed', 
        description: error.message || 'Could not run sync protocol.', 
        duration: 20000 
      });
    }
    setIsFetchingManually(false);
  };
  
  const mergedGames = useMemo(() => {
    const rankingsMap = new Map(rankings?.map(r => [r.teamName, { rank: r.rank, conference: r.conference }]) || []);
    const oddsGames = transformDailyGamesToGames(dailyGames, rankingsMap);

    const finalGames = new Map<string, Game>();

    // Step 1: Add all games from the live ESPN feed. This is our primary source of truth for what's on today.
    espnGames.forEach(espnGame => {
        const key = `${espnGame.sport}-${espnGame.homeTeam.name}-${espnGame.awayTeam.name}`;
        
        // Enrich ESPN game with ranking/conference data right away.
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

    // Step 2: Enrich with odds data from The Odds API / Firestore.
    oddsGames.forEach(oddsGame => {
        const key = `${oddsGame.sport}-${oddsGame.homeTeam.name}-${oddsGame.awayTeam.name}`;
        const existingGame = finalGames.get(key);

        if (existingGame) {
            // Game already exists from ESPN feed, merge odds into it.
            finalGames.set(key, {
                ...existingGame,
                odds: oddsGame.odds,
                allOdds: oddsGame.allOdds,
                oddsApiId: oddsGame.id,
            });
        } else {
            // This game has odds but wasn't in the ESPN feed. Add it with its Odds API ID.
            finalGames.set(key, { ...oddsGame, oddsApiId: oddsGame.id });
        }
    });
    
    // If ESPN data is still loading, it's better to show games with odds than nothing.
    if (isLoadingEspn && finalGames.size === 0) {
        return oddsGames;
    }
    
    const allGames = Array.from(finalGames.values());
    const today = new Date();

    return allGames.filter(game => {
      const isFinal = game.statusDetail?.toLowerCase().includes('final');
      if (!isFinal) {
        return true; // Always show games that are not final
      }

      // If the game is final, only show it if it started today
      const gameDate = new Date(game.startTime);
      return isSameDay(gameDate, today);
    });

  }, [dailyGames, rankings, espnGames, isLoadingEspn]);

  const showLoadingSpinner = isUserLoading || (isLoadingGames && !dailyGames);

  const ncaaSports = ['NCAAF', 'NCAAM'];
  const isConferenceFilterEnabled = ncaaSports.includes(selectedSport);

  return (
    <>
      <div className="flex flex-col gap-8 p-4 md:p-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Today's Games
              </h1>
              <p className="text-muted-foreground">
                {selectedSport === 'All'
                  ? 'All upcoming games'
                  : `Upcoming ${selectedSport} games`}
              </p>
            </div>
            <Button
              onClick={handleManualFetch}
              disabled={isFetchingManually || showLoadingSpinner}
            >
              {isFetchingManually ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isFetchingManually ? 'Syncing...' : 'Sync Odds'}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {loadingSports ? (
                  <Skeleton className="h-10" />
              ) : (
                  <Select onValueChange={setSelectedSport} defaultValue={selectedSport} disabled={showLoadingSpinner}>
                      <SelectTrigger><SelectValue placeholder="Select a sport" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="All">All Sports</SelectItem>
                          {sports.map((sport) => ( <SelectItem key={sport.id} value={sport.name}>{sport.name}</SelectItem> ))}
                      </SelectContent>
                  </Select>
              )}
              <Select onValueChange={setSelectedConference} defaultValue={selectedConference} disabled={showLoadingSpinner || !isConferenceFilterEnabled}>
                  <SelectTrigger><SelectValue placeholder="Filter by Conference" /></SelectTrigger>
                  <SelectContent>
                      {conferenceOptions.map((conf) => ( <SelectItem key={conf} value={conf}>{conf}</SelectItem> ))}
                  </SelectContent>
              </Select>
          </div>
        </header>

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
              games={mergedGames}
              isLoading={isLoadingGames || isLoadingEspn}
              selectedSport={selectedSport}
              selectedConference={selectedConference}
              onGameClick={setSelectedGame}
          />
        )}
      </div>
      <BetSlip />
      <GameDetailModal game={selectedGame} isOpen={!!selectedGame} onClose={() => setSelectedGame(null)} />
    </>
  );
}
