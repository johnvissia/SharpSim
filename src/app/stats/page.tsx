'use client';

import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet } from '@/lib/types';
import { BarChart3, TrendingUp, HelpCircle, CheckCircle, XCircle, Coins, Target } from 'lucide-react';

const StatCard = ({ title, value, icon, description, loading }: { title: string, value: string, icon?: React.ReactNode, description?: string, loading?: boolean }) => {
    if (loading) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    {icon}
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-24" />
                    {description && <Skeleton className="h-4 w-40 mt-2" />}
                </CardContent>
            </Card>
        )
    }
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    )
}


export default function StatsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const betsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'bets');
  }, [user, firestore]);

  const { data: bets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);

  const loading = isUserLoading || isLoadingBets;

  const stats = useMemo(() => {
    if (!bets) {
      return {
        totalBets: 0,
        wins: 0,
        losses: 0,
        pending: 0,
        winPercentage: 0,
        totalWagered: 0,
        netProfit: 0,
      };
    }

    const settledBets = bets.filter(b => b.status === 'won' || b.status === 'lost');
    const wins = settledBets.filter(b => b.status === 'won').length;
    const losses = settledBets.filter(b => b.status === 'lost').length;
    const winPercentage = settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;

    const totalWagered = bets.reduce((acc, bet) => acc + bet.stake, 0);

    const netProfit = bets.reduce((acc, bet) => {
        if (bet.status === 'won') {
            return acc + (bet.potentialWinnings - bet.stake);
        }
        if (bet.status === 'lost') {
            return acc - bet.stake;
        }
        // Pushes result in a refund, so they have a net effect of 0.
        // Pending bets are not counted.
        return acc;
    }, 0);

    return {
      totalBets: bets.length,
      wins,
      losses,
      pending: bets.filter(b => b.status === 'pending').length,
      winPercentage,
      totalWagered,
      netProfit,
    };
  }, [bets]);

  return (
    <div className="p-4 md:p-8">
        <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <BarChart3 className="h-8 w-8 text-primary"/>
                My Betting Stats
            </h1>
            <p className="text-muted-foreground">
                An overview of your betting performance.
            </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             <StatCard
                title="Total Bets"
                value={stats.totalBets.toString()}
                icon={<Target className="h-4 w-4 text-muted-foreground" />}
                description={`${stats.pending} pending`}
                loading={loading}
            />
             <StatCard
                title="Total Wins"
                value={stats.wins.toString()}
                icon={<CheckCircle className="h-4 w-4 text-green-500" />}
                description="Correctly predicted outcomes"
                loading={loading}
            />
             <StatCard
                title="Total Losses"
                value={stats.losses.toString()}
                icon={<XCircle className="h-4 w-4 text-destructive" />}
                description="Incorrectly predicted outcomes"
                loading={loading}
            />
            <StatCard
                title="Win Rate"
                value={`${stats.winPercentage.toFixed(1)}%`}
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                description="Based on settled bets"
                loading={loading}
            />
        </div>

        <div className="grid gap-4 md:grid-cols-2 mt-4">
            <StatCard
                title="Total Wagered"
                value={`${stats.totalWagered.toFixed(2)} coins`}
                icon={<Coins className="h-4 w-4 text-muted-foreground" />}
                description="Total amount staked on all bets."
                loading={loading}
            />
            <StatCard
                title="Net Profit / Loss"
                value={`${stats.netProfit.toFixed(2)} coins`}
                icon={<Coins className="h-4 w-4 text-muted-foreground" />}
                description="Based on settled bets."
                loading={loading}
            />
        </div>
    </div>
  );
}
