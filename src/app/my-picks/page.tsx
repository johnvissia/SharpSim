'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, writeBatch, getDocs, doc, increment } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet, CompletedGame } from '@/lib/types';
import { Ticket, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isSameDay, addDays, subDays } from 'date-fns';
import { BetTicket } from '@/components/bets/bet-ticket';
import { useToast } from '@/hooks/use-toast';
import { gradeUserBets } from '@/lib/bet-grading';


export default function MyPicksPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set the date only on the client-side to prevent hydration mismatch
    setSelectedDate(new Date());
  }, []);

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
    try {
        const pendingBets = bets.filter(b => b.status === 'pending');
        if (pendingBets.length === 0) {
            toast({
                title: 'No Pending Bets',
                description: 'All your bets are already settled.',
            });
            return;
        }

        // Fetch completed games
        const completedGamesRef = collection(firestore, 'completed_games');
        const completedGamesSnapshot = await getDocs(completedGamesRef);
        const completedGames = completedGamesSnapshot.docs.map(doc => doc.data() as CompletedGame);
        const completedGamesMap = new Map(completedGames.map(g => [g.id, g]));

        if (completedGamesMap.size === 0) {
             toast({
                title: 'No Game Results',
                description: 'Could not fetch completed game results to grade bets. Try syncing game lines on the dashboard first.',
                variant: 'destructive',
            });
            return;
        }

        const { updates, totalPayout } = gradeUserBets(pendingBets, completedGamesMap);

        if (updates.length === 0) {
            toast({
                title: 'Bets are Up to Date',
                description: 'No bets were ready to be settled at this time.',
            });
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

  const filteredBets = useMemo(() => {
    if (!bets || !selectedDate) return [];
    return bets.filter(bet => isSameDay(new Date(bet.placedAt), selectedDate));
  }, [bets, selectedDate]);

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
            <Skeleton className="h-8 w-48" />
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
        <Button onClick={handleSyncBets} disabled={isSyncing} size="lg">
            <RefreshCw className={`mr-2 h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Grading...' : 'Grade Bets'}
        </Button>
      </header>

       <div className="flex items-center justify-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold text-center w-48">
          {format(selectedDate, 'MMM d, yyyy')}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6">
        {filteredBets.length === 0 ? (
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    No slips found for this date.
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
