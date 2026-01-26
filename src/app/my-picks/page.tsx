'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, writeBatch, getDocs, doc, increment } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet, CompletedGame } from '@/lib/types';
import { Ticket, ChevronLeft, ChevronRight, RefreshCw, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isSameDay, addDays, subDays } from 'date-fns';
import { BetTicket } from '@/components/bets/bet-ticket';
import { useToast } from '@/hooks/use-toast';
import { gradeUserBets } from '@/lib/bet-grading';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';


export default function MyPicksPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [isGradingDebugging, setIsGradingDebugging] = useState(false);
  const [gradingDebugResponse, setGradingDebugResponse] = useState<string | null>(null);

  useEffect(() => {
    // Set the date only on the client-side to prevent hydration mismatch
    setSelectedDate(new Date());
  }, []);
  
  useEffect(() => {
    if (!isUserLoading && !user) {
        router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const betsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'bets'), orderBy('placedAt', 'desc'));
  }, [user, firestore]);

  const { data: bets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);
  
  const loading = isUserLoading || isLoadingBets;

  const handleSyncBets = async () => {
    if (!firestore || !user || !bets) {
        toast({
            title: 'Cannot Grade Bets',
            description: 'User or database information is not available.',
            variant: 'destructive',
        });
        return;
    }

    setIsSyncing(true);
    setGradingDebugResponse(null);
    try {
        const pendingBets = bets.filter(b => b.status === 'pending');
        if (pendingBets.length === 0) {
            toast({
                title: 'No Pending Bets',
                description: 'All your bets are already settled.',
            });
            setIsSyncing(false);
            return;
        }

        // Fetch completed games
        const completedGamesRef = collection(firestore, 'completed_games');
        const completedGamesSnapshot = await getDocs(completedGamesRef);
        const completedGames = completedGamesSnapshot.docs.map(doc => doc.data() as CompletedGame);
        const completedGamesMap = new Map(completedGames.map(g => [g.id, g]));

        // Fetch completed player stats
        const completedPlayerStatsRef = collection(firestore, 'completed_player_stats');
        const completedPlayerStatsSnapshot = await getDocs(completedPlayerStatsRef);
        const completedPlayerStats = completedPlayerStatsSnapshot.docs.map(doc => doc.data() as any);
        const completedPlayerStatsMap = new Map(completedPlayerStats.map((s: any) => [s.id, s]));

        console.log(`[GRADING] Loaded ${completedGamesMap.size} completed games and ${completedPlayerStatsMap.size} player stats`);

        if (completedGamesMap.size === 0) {
             toast({
                title: 'No Game Results',
                description: 'Could not fetch completed game results to grade bets. Try syncing game lines on the dashboard first.',
                variant: 'destructive',
            });
            setIsSyncing(false);
            return;
        }

        const { updates, totalPayout } = gradeUserBets(pendingBets, completedGamesMap, completedPlayerStatsMap);

        if (updates.length === 0) {
            toast({
                title: 'Bets are Up to Date',
                description: 'No bets were ready to be settled at this time.',
            });
            setIsSyncing(false);
            return;
        }

        const batch = writeBatch(firestore);
        updates.forEach(update => {
            const betRef = doc(firestore, 'users', user.uid, 'bets', update.betId);
            batch.update(betRef, update.payload);
        });

        if (totalPayout > 0) {
            const userRef = doc(firestore, 'users', user.uid);
            batch.update(userRef, { balance: increment(totalPayout) });
        }

        await batch.commit();

        toast({
            title: 'Bets Settled!',
            description: `${updates.length} of your bets have been graded. Your balance has been updated.`,
        });

    } catch (error: any) {
        console.error("Failed to sync bets:", error);
        toast({
            title: 'Grading Failed',
            description: 'An error occurred while settling your bets. Check the console for details.',
            variant: 'destructive',
        });
    } finally {
        setIsSyncing(false);
    }
  };

  const handleDebugGrading = async () => {
    setIsGradingDebugging(true);
    setGradingDebugResponse(null);
    try {
        const response = await fetch('/api/debug-game-line-grading');
        const result = await response.json();
        setGradingDebugResponse(result.log);
        if(!response.ok) {
            toast({
                title: "Debug Failed",
                description: "The debug route returned an error.",
                variant: 'destructive',
            });
        }
    } catch (err: any) {
        setGradingDebugResponse(`Error: ${err.message}`);
        toast({
            title: "Debug Error",
            description: "Failed to fetch from the debug route.",
            variant: 'destructive',
        });
    } finally {
        setIsGradingDebugging(false);
    }
  };

  const filteredBets = useMemo(() => {
    if (!bets || !selectedDate) return [];
    
    const isViewingToday = isSameDay(selectedDate, new Date());

    let betsToShow: UserBet[];

    if (isViewingToday) {
      // On today's view, show ALL pending bets + today's settled bets.
      const pendingBets = bets.filter(bet => bet.status === 'pending');
      const settledBetsForToday = bets.filter(bet => 
        bet.status !== 'pending' && isSameDay(new Date(bet.placedAt), selectedDate)
      );

      // Use a map to avoid duplicates if a pending bet was placed today
      const betMap = new Map<string, UserBet>();
      settledBetsForToday.forEach(b => betMap.set(b.id, b));
      pendingBets.forEach(b => betMap.set(b.id, b));
      betsToShow = Array.from(betMap.values());

    } else {
      // On a past day's view, show ONLY bets placed on that day.
      betsToShow = bets.filter(bet => isSameDay(new Date(bet.placedAt), selectedDate));
    }
    
    // Sort whatever list we ended up with.
    betsToShow.sort((a, b) => {
        const aIsPending = a.status === 'pending';
        const bIsPending = b.status === 'pending';

        // Pending bets always go to the top
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;

        // Otherwise, sort by most recent placedAt time
        return new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime();
    });

    return betsToShow;
  }, [bets, selectedDate]);

  const dailyNet = useMemo(() => {
    if (!bets || !selectedDate) return 0;
    const betsForDate = bets.filter(bet => isSameDay(new Date(bet.placedAt), selectedDate));
    
    return betsForDate.reduce((acc, bet) => {
      if (bet.status === 'won') {
        return acc + (bet.potentialWinnings - bet.stake);
      }
      if (bet.status === 'lost') {
        return acc - bet.stake;
      }
      return acc;
    }, 0);
  }, [bets, selectedDate]);


  if (isUserLoading || !user) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
            <Loader className="h-12 w-12 animate-spin text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
                Loading...
            </h2>
            <p className="text-muted-foreground">
                Authenticating and fetching your picks.
            </p>
        </div>
    );
  }
  
  if (loading || !selectedDate) {
    return (
      <div className="p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Ticket className="h-8 w-8 text-primary"/> My Picks
          </h1>
          <p className="text-muted-foreground">
            Track your active and settled bets here.
          </p>
        </header>
        <div className="flex items-center justify-center gap-4 mb-8">
            <Skeleton className="h-10 w-10" />
            <div className="w-48 text-center">
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
            </div>
            <Skeleton className="h-10 w-10" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Ticket className="h-8 w-8 text-primary"/> My Picks
          </h1>
          <p className="text-muted-foreground">
            Track your active and settled bets here.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={handleSyncBets} disabled={isSyncing || isGradingDebugging} size="lg">
                <RefreshCw className={`mr-2 h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Grading...' : 'Grade Bets'}
            </Button>
            <Button onClick={handleDebugGrading} disabled={isGradingDebugging || isSyncing} variant="outline" size="lg" className="text-purple-400 border-purple-400/50 hover:bg-purple-400/10 hover:text-purple-300">
                <span role="img" aria-label="ladybug" className="mr-2">🐞</span>
                {isGradingDebugging ? 'Debugging...' : 'Debug Grading'}
            </Button>
        </div>
      </header>

      {gradingDebugResponse && (
        <Card className="my-6 bg-slate-800 border-purple-500/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-purple-400">
                    <span role="img" aria-label="ladybug">🐞</span>
                    Game Line Grading Debug Report
                </CardTitle>
                <CardDescription>
                    This is a dry run report for a single pending game line bet. No data was actually changed.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <pre className="text-xs bg-slate-900 p-4 rounded-md overflow-x-auto text-white max-h-[500px]">
                    {gradingDebugResponse}
                </pre>
            </CardContent>
        </Card>
      )}

       <div className="flex items-center justify-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center w-48">
            <h2 className="text-xl font-semibold">
              {format(selectedDate, 'MMM d, yyyy')}
            </h2>
            <p className={cn(
                "font-semibold text-sm",
                dailyNet > 0 ? "text-green-500" : dailyNet < 0 ? "text-destructive" : "text-muted-foreground"
            )}>
                {dailyNet > 0 ? '+' : ''}{dailyNet.toFixed(2)} Coins
            </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6">
        {filteredBets.length === 0 ? (
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    No active bets or slips for this date.
                </CardContent>
            </Card>
        ) : (
            filteredBets.map(bet => (
                <BetTicket key={bet.id} bet={bet} />
            ))
        )}
      </div>
    </div>
  );
}
