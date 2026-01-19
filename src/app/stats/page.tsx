'use client';

import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet, SportName } from '@/lib/types';
import { BarChart3, TrendingUp, Coins, Target } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';
import Link from 'next/link';


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

type BetFilter = 'all' | 'straights' | 'parlays';

type SportStats = {
    wins: number;
    losses: number;
    pushes: number;
    pending: number;
    totalBets: number;
    totalWagered: number;
    netProfit: number;
};

export default function StatsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<BetFilter>('all');


  const betsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'bets');
  }, [user, firestore]);

  const { data: bets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);

  const loading = isUserLoading || isLoadingBets;

  const stats = useMemo(() => {
    const initialSportStats = (): SportStats => ({
        wins: 0,
        losses: 0,
        pushes: 0,
        pending: 0,
        totalBets: 0,
        totalWagered: 0,
        netProfit: 0,
    });

    const overall = initialSportStats();
    const bySport: Partial<Record<SportName, SportStats>> = {};

    if (!bets) {
      return { overall, bySport, winPercentage: 0 };
    }

    const filteredBets = bets.filter(bet => {
        if (filter === 'straights') return bet.betType !== 'parlay';
        if (filter === 'parlays') return bet.betType === 'parlay';
        return true;
    });

    for (const bet of filteredBets) {
        // Initialize sport stats if not present
        if (!bySport[bet.sport]) {
            bySport[bet.sport] = initialSportStats();
        }
        const sportStats = bySport[bet.sport]!;

        // Update overall and sport-specific stats
        [overall, sportStats].forEach(s => {
            s.totalBets += 1;
            s.totalWagered += bet.stake;

            switch (bet.status) {
                case 'won':
                    s.wins += 1;
                    s.netProfit += (bet.potentialWinnings - bet.stake);
                    break;
                case 'lost':
                    s.losses += 1;
                    s.netProfit -= bet.stake;
                    break;
                case 'push':
                    s.pushes += 1;
                    break;
                case 'pending':
                    s.pending += 1;
                    break;
            }
        });
    }

    const settledCount = overall.wins + overall.losses;
    const winPercentage = settledCount > 0 ? (overall.wins / settledCount) * 100 : 0;
    
    return { overall, bySport, winPercentage };
  }, [bets, filter]);

  const sortedSports = useMemo(() => {
    return Object.entries(stats.bySport).sort(([, a], [, b]) => b.totalBets - a.totalBets);
  }, [stats.bySport]);

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

        <Tabs value={filter} onValueChange={(value) => setFilter(value as BetFilter)} className="space-y-4">
            <TabsList>
                <TabsTrigger value="all">All Bets</TabsTrigger>
                <TabsTrigger value="straights">Straights</TabsTrigger>
                <TabsTrigger value="parlays">Parlays</TabsTrigger>
            </TabsList>
            <TabsContent value={filter} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total Bets"
                        value={stats.overall.totalBets.toString()}
                        icon={<Target className="h-4 w-4 text-muted-foreground" />}
                        description={`${stats.overall.pending} pending`}
                        loading={loading}
                    />
                    <StatCard
                        title="Win Rate"
                        value={`${stats.winPercentage.toFixed(1)}%`}
                        icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                        description={`${stats.overall.wins}W - ${stats.overall.losses}L`}
                        loading={loading}
                    />
                    <StatCard
                        title="Total Wagered"
                        value={`${stats.overall.totalWagered.toFixed(2)} coins`}
                        icon={<Coins className="h-4 w-4 text-muted-foreground" />}
                        description="Total amount staked on all bets."
                        loading={loading}
                    />
                    <StatCard
                        title="Net Profit / Loss"
                        value={`${stats.overall.netProfit.toFixed(2)} coins`}
                        icon={<Coins className={cn("h-4 w-4", stats.overall.netProfit >= 0 ? 'text-green-500' : 'text-destructive')} />}
                        description="Based on settled bets."
                        loading={loading}
                    />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Performance by Sport</CardTitle>
                        <CardDescription>A breakdown of your performance. Click a sport for more details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : sortedSports.length === 0 ? (
                            <p className="text-muted-foreground text-center">No bets placed yet for this filter.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sport</TableHead>
                                        <TableHead className="text-center">Record (W-L)</TableHead>
                                        <TableHead className="text-right">Win %</TableHead>
                                        <TableHead className="text-right">Net Profit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedSports.map(([sport, sportStats]) => {
                                        const settledCount = sportStats.wins + sportStats.losses;
                                        const winRate = settledCount > 0 ? (sportStats.wins / settledCount) * 100 : 0;
                                        return (
                                            <TableRow key={sport}>
                                                <TableCell className="font-medium">
                                                  <Link href={`/stats/${sport}`} className="hover:underline text-primary">
                                                      {sport}
                                                  </Link>
                                                </TableCell>
                                                <TableCell className="text-center">{sportStats.wins}-{sportStats.losses}</TableCell>
                                                <TableCell className="text-right">{winRate.toFixed(1)}%</TableCell>
                                                <TableCell className={cn(
                                                    "text-right font-semibold",
                                                    sportStats.netProfit > 0 && "text-green-600",
                                                    sportStats.netProfit < 0 && "text-destructive"
                                                )}>
                                                    {sportStats.netProfit.toFixed(2)} coins
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
