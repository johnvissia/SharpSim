'use client';

import { useMemo, useState } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet } from '@/lib/types';
import { Ticket, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isSameDay, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const getBetStatusBadge = (status: UserBet['status']) => {
  if (status === 'pending') return <Badge variant="secondary">Pending</Badge>;
  if (status === 'won') return <Badge className="bg-green-500 text-white">Won</Badge>;
  if (status === 'lost') return <Badge variant="destructive">Lost</Badge>;
  if (status === 'push') return <Badge>Push</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

export default function MyPicksPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const betsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'bets'), orderBy('placedAt', 'desc'));
  }, [user, firestore]);

  const { data: bets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);
  
  const loading = isUserLoading || isLoadingBets;

  const filteredBets = useMemo(() => {
    if (!bets) return [];
    return bets.filter(bet => isSameDay(new Date(bet.placedAt), selectedDate));
  }, [bets, selectedDate]);

  if (loading) {
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
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

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
            filteredBets.map(bet => {
                const isParlay = bet.betType === 'parlay';

                return (
                    <Card key={bet.id} className={cn(
                        "ticket transition-colors",
                        { 'bg-green-100 dark:bg-green-500/10': bet.status === 'won' }
                    )}>
                        <CardContent className="!p-0">
                            {isParlay && bet.legs ? (
                                // --- NEW FLIFF-STYLE PARLAY TICKET ---
                                <>
                                    <div className="p-4 space-y-4">
                                        {bet.legs.map((leg, index) => {
                                            const Icon = leg.status === 'won' ? CheckCircle2 : leg.status === 'lost' ? XCircle : Clock;
                                            const iconColor = leg.status === 'won' ? 'text-green-500' : leg.status === 'lost' ? 'text-red-500' : 'text-muted-foreground';
                                            const gameDate = new Date(leg.commenceTime);
                                            const gameTime = gameDate.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

                                            return (
                                                <div key={index}>
                                                    {/* Leg Row 1 */}
                                                    <div className="flex justify-between items-center text-sm">
                                                        <p className="font-bold truncate pr-2">{leg.matchup}</p>
                                                        <p className="font-mono font-semibold">{leg.odds > 0 ? `+${leg.odds}` : leg.odds}</p>
                                                    </div>
                                                    {/* Leg Row 2 */}
                                                    <p className="text-xs text-muted-foreground">{gameTime}</p>
                                                    {/* Leg Row 3 */}
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
                                                        <div>
                                                            <p className="font-semibold">{leg.pick}</p>
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{leg.betType}</p>
                                                        </div>
                                                    </div>
                                                    {index < bet.legs.length - 1 && <Separator className="my-3" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="border-t-2 border-dashed border-border/50 mx-4" />
                                    <div className="p-4 space-y-2">
                                        <div className="flex justify-between items-center font-bold text-base">
                                            <p>{bet.pick}</p>
                                            <div className="flex items-center gap-4">
                                                <p className="font-mono">{bet.odds > 0 ? `+${bet.odds}`: bet.odds}</p>
                                                {getBetStatusBadge(bet.status)}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-muted-foreground font-mono">
                                            <p>Risk: <span className="font-semibold text-foreground">{bet.stake.toFixed(2)} coins</span></p>
                                            <p>Payout: <span className="font-semibold text-green-600">{bet.potentialWinnings.toFixed(2)} coins</span></p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // --- EXISTING SINGLE TICKET ---
                                <>
                                    <div className="flex justify-between items-start p-4">
                                        <div className="flex-grow">
                                            <p className="font-semibold text-lg">{bet.pick} <span className="font-mono text-muted-foreground font-normal">({bet.odds > 0 ? `+${bet.odds}`: bet.odds})</span></p>
                                            <p className="text-sm text-muted-foreground">{bet.matchup || 'Game details not available'}</p>
                                        </div>
                                        {getBetStatusBadge(bet.status)}
                                    </div>
                                    <div className="border-t-2 border-dashed border-border/50 mx-4" />
                                    <div className="flex justify-between items-center p-4 text-sm text-muted-foreground">
                                        <p className="font-mono">Stake: <span className="font-semibold text-foreground">{bet.stake.toFixed(2)} coins</span></p>
                                        <p className="font-mono">To Win: <span className="font-semibold text-green-600">{(bet.potentialWinnings - bet.stake).toFixed(2)} coins</span></p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                );
            })
        )}
      </div>
    </div>
  );
}
