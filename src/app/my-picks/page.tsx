'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet, CompletedGame } from '@/lib/types';
import { Ticket, ChevronLeft, ChevronRight, Loader, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isSameDay, addDays, subDays } from 'date-fns';
import { BetTicket } from '@/components/bets/bet-ticket';
import { useToast } from '@/hooks/use-toast';

import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';


export default function MyPicksPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isSyncing, setIsSyncing] = useState(false);

  const triggerBetSync = async (showToast = false) => {
    if (!user?.uid) return;
    setIsSyncing(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`/api/sync-user-bets?userId=${user.uid}`, {
        signal: controller.signal,
      }).catch((err) => {
        console.warn("[MyPicks] Bet sync network issue:", err.message || err);
        return null;
      });

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && showToast) {
          if (data.gradedCount > 0) {
            toast({
              title: "Picks Graded",
              description: `Graded ${data.gradedCount} pick(s). ${data.totalPayout > 0 ? `+${data.totalPayout} coins credited!` : ''}`,
            });
          } else {
            toast({
              title: "Sync Complete",
              description: "All pending picks checked against latest game scores.",
            });
          }
        }
      } else if (showToast && res && !res.ok) {
        toast({
          title: "Sync Warning",
          description: "Could not sync picks right now. Please try again in a moment.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.warn("[MyPicks] Gracefully handled sync exception:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      triggerBetSync(false);
    }
  }, [user?.uid]);

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
    return query(collection(firestore, 'users', user.uid, 'bets'));
  }, [user, firestore]);

  const { data: bets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);
  
  const loading = isUserLoading || isLoadingBets;



  const filteredBets = useMemo(() => {
    if (!bets || !selectedDate) return [];
    
    const isViewingToday = isSameDay(selectedDate, new Date());

    let betsToShow: UserBet[];

    if (isViewingToday) {
      // On today's view, show pending bets FOR TODAY'S GAMES + settled bets placed today.
      const isGameToday = (bet: UserBet) => {
        if (bet.betType === 'parlay' && bet.legs) {
          // A parlay is for "today" if at least one of its legs starts today.
          return bet.legs.some(leg => isSameDay(new Date(leg.commenceTime), selectedDate));
        }
        // For single bets, check the main commenceTime.
        return bet.commenceTime ? isSameDay(new Date(bet.commenceTime), selectedDate) : false;
      };

      const pendingBetsForToday = bets.filter(bet => 
        bet.status === 'pending' && isGameToday(bet)
      );
      
      const settledBetsForToday = bets.filter(bet => 
        bet.status !== 'pending' && isSameDay(new Date(bet.placedAt), selectedDate)
      );
      
      // Combine them, ensuring no duplicates.
      const betMap = new Map<string, UserBet>();
      settledBetsForToday.forEach(b => betMap.set(b.id, b));
      pendingBetsForToday.forEach(b => betMap.set(b.id, b));
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
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Ticket className="h-8 w-8 text-primary"/> My Picks
          </h1>
          <p className="text-muted-foreground">
            Track your active and settled bets here.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => triggerBetSync(true)}
          disabled={isSyncing}
          className="flex items-center gap-2 border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 self-start sm:self-auto"
        >
          <RefreshCw className={cn("h-4 w-4 text-emerald-400", isSyncing && "animate-spin")} />
          {isSyncing ? "Grading Picks..." : "Sync & Grade Picks"}
        </Button>
      </header>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBets.length === 0 ? (
            <Card className="col-span-full">
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
