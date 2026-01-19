
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
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
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
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [espnGames, setEspnGames] = useState<Game[]>([]); // State for new ESPN data
  const [isLoadingEspn, setIsLoadingEspn] = useState(true);

  const conferenceOptions = ["All", "SEC", "Big 10", "ACC", "Big 12"];

  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const systemStatusRef = useMemoFirebase(() => (firestore ? doc(firestore, 'system', 'status') : null), [firestore]);
  const { data: systemStatus, isLoading: isStatusLoading } = useDoc<SystemStatus>(systemStatusRef);
  
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

  // Daily sync effect remains largely the same
  useEffect(() => {
    if (isStatusLoading || !firestore || !user || !systemStatusRef) return;
    const today = new Date().toISOString().split('T')[0];
    const lastUpdated = systemStatus?.last_updated_date;
    if (lastUpdated === today) {
        console.log('Daily data is already up to date for', today);
        return;
    }
    const runDailySync = async () => {
      console.log('New day detected or first sync. Running daily protocol...');
      setIsAutoSyncing(true);
      toast({
        title: 'Performing Daily Sync...',
        description: 'Fetching latest odds, scores, and settling yesterdays bets.',
      });
      try {
        await fetchAndSaveDailyData(firestore);
        toast({ title: 'Syncing complete. Now grading bets...' });
        await gradeUserBets(firestore, user);
        setDocumentNonBlocking(systemStatusRef, { last_updated_date: today }, { merge: true });
        toast({
          title: 'Daily Protocol Complete!',
          description: 'Odds are fresh and bets are settled.',
        });
      } catch (error: any) {
        console.error('Failed during automatic daily protocol:', error);
        toast({
          variant: 'destructive',
          title: 'Auto-Sync Failed',
          description: error.message || 'Could not run daily protocol. It will be retried on next page load.',
          duration: 20000,
        });
      } finally {
        setIsAutoSyncing(false);
      }
    };
    runDailySync();
  }, [systemStatus, isStatusLoading, firestore, user, systemStatusRef, toast]);
  
  const handleManualFetch = async () => {
    if (!firestore || !user) return;
    setIsFetchingManually(true);
    toast({ title: 'Syncing Data...', description: 'Fetching latest odds and scores for all sports.' });
    try {
      await fetchAndSaveDailyData(firestore);
      toast({ title: 'Sync Complete!', description: 'Odds and scores have been updated.' });
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Sync Failed', description: error.message || 'Could not fetch data from The Odds API.', duration: 20000 });
    }
    setIsFetchingManually(false);
  };
  
  // New merging logic
  const mergedGames = useMemo(() => {
    const rankingsMap = new Map(rankings?.map(r => [r.teamName, { rank: r.rank, conference: r.conference }]) || []);
    const oddsGames = transformDailyGamesToGames(dailyGames, rankingsMap);

    if (isLoadingEspn || espnGames.length === 0) {
        return oddsGames; // Return odds games if ESPN data is not ready
    }

    // Create a map for quick lookups of ESPN games
    const espnGameMap = new Map<string, Game>();
    espnGames.forEach(g => {
        const key = `${g.sport}-${g.homeTeam.name}-${g.awayTeam.name}`;
        espnGameMap.set(key, g);
    });

    // Enrich oddsGames with data from espnGames
    return oddsGames.map(oddsGame => {
        const key = `${oddsGame.sport}-${oddsGame.homeTeam.name}-${oddsGame.awayTeam.name}`;
        const espnGame = espnGameMap.get(key);

        if (espnGame) {
            return {
                ...oddsGame, // odds data from The Odds API
                id: espnGame.id, // Use ESPN's ID for consistency in props view
                homeTeam: { ...oddsGame.homeTeam, logo: espnGame.homeTeam.logo },
                awayTeam: { ...oddsGame.awayTeam, logo: espnGame.awayTeam.logo },
                liveScore: espnGame.liveScore,
                statusDetail: espnGame.statusDetail,
                startTime: espnGame.startTime, // Use more accurate ESPN start time
            };
        }
        return oddsGame; // Return original if no match found
    });
  }, [dailyGames, rankings, espnGames, isLoadingEspn]);

  const showLoadingSpinner = isUserLoading || isAutoSyncing || (isLoadingGames && !dailyGames);

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
              {isFetchingManually || isAutoSyncing ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isAutoSyncing ? 'Auto-Sync...' : isFetchingManually ? 'Syncing...' : 'Sync Odds'}
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
              {isUserLoading ? 'Preparing your session...' : 'This happens once per day to ensure all data is fresh.'}
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
