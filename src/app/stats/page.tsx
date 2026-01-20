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
        totalWagered: 0,
        netProfit: 0,
    });

    const overall = {
        wins: 0, // Leg-based for Win Rate card
        losses: 0, // Leg-based for Win Rate card
        pushes: 0,
        pending: 0,
        totalBets: 0, // Slip-based for Total Bets card
        totalWagered: 0,
        netProfit: 0,
    };
    const bySport: Partial<Record<SportName, SportStats>> = {};

    if (!bets) {
      return { overall, bySport, winPercentage: 0 };
    }

    const filteredBets = bets.filter(bet => {
        if (filter === 'straights') return bet.betType !== 'parlay';
        if (filter === 'parlays') return bet.betType === 'parlay';
        return true;
    });

    overall.totalBets = filteredBets.length;

    for (const bet of filteredBets) {
        // Overall ticket-based calculations for wagered and profit
        overall.totalWagered += bet.stake;
        if (bet.status === 'won') {
            overall.netProfit += (bet.potentialWinnings - bet.stake);
        } else if (bet.status === 'lost') {
            overall.netProfit -= bet.stake;
        }

        // Determine legs for W-L calculation
        const legsToProcess = bet.legs ? bet.legs : [{...bet, status: bet.status, sport: bet.sport}];

        const involvedSportsForTicket = new Set<SportName>();
        legsToProcess.forEach(l => {
          if (l.sport) involvedSportsForTicket.add(l.sport);
        });

        for (const leg of legsToProcess) {
            const sport = leg.sport;
            if (!sport) continue; // Guard against old data without sport on leg

            if (!bySport[sport]) {
                bySport[sport] = initialSportStats();
            }
            const sportStats = bySport[sport]!;

            switch(leg.status) {
                case 'won': sportStats.wins += 1; break;
                case 'lost': sportStats.losses += 1; break;
                case 'push': sportStats.pushes += 1; break;
                case 'pending': sportStats.pending += 1; break;
            }
        }
        
        // Distribute wager/profit across involved sports for that ticket
        if (involvedSportsForTicket.size > 0) {
          const profit = (bet.status === 'won' ? (bet.potentialWinnings - bet.stake) : (bet.status === 'lost' ? -bet.stake : 0));
          const profitPerSport = profit / involvedSportsForTicket.size;
          const wagerPerSport = bet.stake / involvedSportsForTicket.size;

          involvedSportsForTicket.forEach(sport => {
            const sportStats = bySport[sport];
            if (sportStats) {
                sportStats.netProfit += profitPerSport;
                sportStats.totalWagered += wagerPerSport;
            }
          });
        }
    }

    // Aggregate leg-based W/L into overall W/L for the top-level card
    let totalLegWins = 0;
    let totalLegLosses = 0;
    let totalPending = 0;
    Object.values(bySport).forEach(sportStats => {
        if(sportStats) {
            totalLegWins += sportStats.wins;
            totalLegLosses += sportStats.losses;
            totalPending += sportStats.pending;
        }
    });

    const settledLegCount = totalLegWins + totalLegLosses;
    const winPercentage = settledLegCount > 0 ? (totalLegWins / settledLegCount) * 100 : 0;
    
    overall.wins = totalLegWins;
    overall.losses = totalLegLosses;
    overall.pending = totalPending;
    
    return { overall, bySport, winPercentage };
  }, [bets, filter]);

  const sortedSports = useMemo(() => {
    return Object.entries(stats.bySport).sort(([, a], [, b]) => {
        if (!a || !b) return 0;
        return (b.wins + b.losses) - (a.wins + a.losses);
    });
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
                        description={`${stats.overall.pending} pending legs`}
                        loading={loading}
                    />
                    <StatCard
                        title="Win Rate"
                        value={`${stats.winPercentage.toFixed(1)}%`}
                        icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                        description={`${stats.overall.wins}W - ${stats.overall.losses}L (by leg)`}
                        loading={loading}
                    />
                    <StatCard
                        title="Total Wagered"
                        value={`${stats.overall.totalWagered.toFixed(2)} coins`}
                        icon={<Coins className="h-4 w-4 text-muted-foreground" />}
                        description="Total amount staked on all slips."
                        loading={loading}
                    />
                    <StatCard
                        title="Net Profit / Loss"
                        value={`${stats.overall.netProfit.toFixed(2)} coins`}
                        icon={<Coins className={cn("h-4 w-4", stats.overall.netProfit >= 0 ? 'text-green-500' : 'text-destructive')} />}
                        description="Based on settled slips."
                        loading={loading}
                    />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Performance by Sport</CardTitle>
                        <CardDescription>A breakdown of your performance by leg. Click a sport for more details.</CardDescription>
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
                                        if (!sportStats) return null;
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
