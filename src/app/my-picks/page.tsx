'use client';

import { useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet, DailyGame } from '@/lib/types';
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

  const dailyGamesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'daily_games');
  }, [firestore]);

  const { data: bets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);
  const { data: dailyGames, isLoading: isLoadingGames } = useCollection<DailyGame>(dailyGamesQuery);
  
  const loading = isUserLoading || isLoadingBets || isLoadingGames;

  const gamesMap = useMemo(() => {
    if (!dailyGames) return new Map<string, DailyGame>();
    return new Map(dailyGames.map(g => [g.id, g]));
  }, [dailyGames]);

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
      <div className="space-y-4">
        {(!bets || bets.length === 0) ? (
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    You have not placed any bets yet.
                </CardContent>
            </Card>
        ) : (
            bets.map(bet => {
                const isParlay = bet.betType === 'parlay';
                let gameInfo: string;
                if (isParlay) {
                    gameInfo = `${bet.pick.split('|').length}-Leg Parlay`;
                } else {
                    const game = gamesMap.get(bet.gameId);
                    gameInfo = game ? `${game.awayTeam} @ ${game.homeTeam}` : 'Loading game...';
                }

                return (
                    <Card key={bet.id} className="shadow-md">
                    <CardContent className="p-4 flex justify-between items-center gap-4">
                        <div className="flex-grow">
                        <p className="font-semibold text-lg">{bet.pick} <span className="text-muted-foreground font-normal">({bet.odds > 0 ? `+${bet.odds}`: bet.odds})</span></p>
                        <p className="text-sm text-muted-foreground">{gameInfo}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                        {getBetStatusBadge(bet.status)}
                        <p className="text-sm">Stake: {bet.stake.toFixed(2)} coins</p>
                        <p className="text-sm">To Win: {(bet.potentialWinnings - bet.stake).toFixed(2)} coins</p>
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
