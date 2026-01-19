'use client';

import { useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet } from '@/lib/types';
import { Ticket } from 'lucide-react';

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

  const betsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'bets'), orderBy('placedAt', 'desc'));
  }, [user, firestore]);

  const { data: bets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);
  
  const loading = isUserLoading || isLoadingBets;

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
      <div className="space-y-6">
        {(!bets || bets.length === 0) ? (
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    You have not placed any bets yet.
                </CardContent>
            </Card>
        ) : (
            bets.map(bet => {
                const isParlay = bet.betType === 'parlay';

                return (
                    <Card key={bet.id} className="ticket">
                        <CardContent className="!p-0">
                            <div className="flex justify-between items-start p-4">
                                <div className="flex-grow">
                                    {isParlay ? (
                                        <div className="space-y-1">
                                            <p className="font-semibold text-lg">{bet.pick.split(' | ').length}-Leg Parlay <span className="font-mono text-muted-foreground font-normal">({bet.odds > 0 ? `+${bet.odds}`: bet.odds})</span></p>
                                            <ul className="text-sm text-muted-foreground list-disc pl-5">
                                                {bet.pick.split(' | ').map((leg, index) => (
                                                    <li key={index}>{leg}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="font-semibold text-lg">{bet.pick} <span className="font-mono text-muted-foreground font-normal">({bet.odds > 0 ? `+${bet.odds}`: bet.odds})</span></p>
                                            <p className="text-sm text-muted-foreground">{bet.matchup || 'Game details not available'}</p>
                                        </>
                                    )}
                                </div>
                                {getBetStatusBadge(bet.status)}
                            </div>
                            <div className="border-t-2 border-dashed border-border/50 mx-4" />
                            <div className="flex justify-between items-center p-4 text-sm text-muted-foreground">
                                <p className="font-mono">Stake: <span className="font-semibold text-foreground">{bet.stake.toFixed(2)} coins</span></p>
                                <p className="font-mono">To Win: <span className="font-semibold text-green-600">{(bet.potentialWinnings - bet.stake).toFixed(2)} coins</span></p>
                            </div>
                        </CardContent>
                    </Card>
                );
            })
        )}
      </div>
    </div>
  );
}
