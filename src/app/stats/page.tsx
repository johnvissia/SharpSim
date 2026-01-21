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

type BetFilter = 'straights' | 'parlays';

type SportStats = {
    wins: number;
    losses: number;
    pushes: number;
    pending: number;
    betCount: number;
    totalWagered: number;
    netProfit: number;
    totalOdds: number; 
    totalLegs: number; 
};

export default function StatsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<BetFilter>('straights');


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
        betCount: 0,
        totalWagered: 0,
        netProfit: 0,
        totalOdds: 0,
        totalLegs: 0,
    });

    const overall = {
        wins: 0,
        losses: 0,
        pushes: 0,
        pending: 0,
        totalBets: 0,
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
        return false;
    });

    overall.totalBets = filteredBets.length;

    for (const bet of filteredBets) {
        // Overall ticket-based calculations
        overall.totalWagered += bet.stake;
        if (bet.status === 'won') {
            overall.wins++;
            overall.netProfit += (bet.potentialWinnings - bet.stake);
        } else if (bet.status === 'lost') {
            overall.losses++;
            overall.netProfit -= bet.stake;
        } else if (bet.status === 'push') {
            overall.pushes++;
        } else {
            overall.pending++;
        }

        if (filter === 'straights') {
            const sport = bet.sport;
            if (!bySport[sport]) {
                bySport[sport] = initialSportStats();
            }
            const sportStats = bySport[sport]!;

            sportStats.betCount++;
            sportStats.totalWagered += bet.stake;
            sportStats.totalOdds += bet.odds;

            switch(bet.status) {
                case 'won': 
                    sportStats.wins++;
                    sportStats.netProfit += (bet.potentialWinnings - bet.stake);
                    break;
                case 'lost': 
                    sportStats.losses++; 
                    sportStats.netProfit -= bet.stake;
                    break;
                case 'push': sportStats.pushes++; break;
                case 'pending': sportStats.pending++; break;
            }
        } else { // Parlays
            const involvedSports = new Set<SportName>();
            if (bet.legs) {
                bet.legs.forEach(leg => involvedSports.add(leg.sport));
            }

            if (involvedSports.size > 0) {
              const profit = (bet.status === 'won' ? (bet.potentialWinnings - bet.stake) : (bet.status === 'lost' ? -bet.stake : 0));
              const profitPerSport = profit / involvedSports.size;
              const wagerPerSport = bet.stake / involvedSports.size;

              involvedSports.forEach(sport => {
                  if (!bySport[sport]) {
                      bySport[sport] = initialSportStats();
                  }
                  const sportStats = bySport[sport]!;
                  sportStats.betCount++;
                  sportStats.netProfit += profitPerSport;
                  sportStats.totalWagered += wagerPerSport;
                  sportStats.totalLegs += (bet.legs?.length || 0);

                  switch(bet.status) {
                      case 'won': sportStats.wins++; break;
                      case 'lost': sportStats.losses++; break;
                      case 'push': sportStats.pushes++; break;
                      case 'pending': sportStats.pending++; break;
                  }
              });
            }
        }
    }

    const settledTicketCount = overall.wins + overall.losses;
    const winPercentage = settledTicketCount > 0 ? (overall.wins / settledTicketCount) * 100 : 0;
    
    return { overall, bySport, winPercentage };
  }, [bets, filter]);

  const sortedSports = useMemo(() => {
    return Object.entries(stats.bySport).sort(([, a], [, b]) => {
        if (!a || !b) return 0;
        return b.betCount - a.betCount;
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

        <Tabs value={filter} onValueChange={(value) => setFilter(value as BetFilter)} defaultValue="straights" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="straights">Straights</TabsTrigger>
                <TabsTrigger value="parlays">Parlays</TabsTrigger>
            </TabsList>
            
            <TabsContent value="straights" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                     <StatCard
                        title="Total Straights"
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
                        description="Total amount staked."
                        loading={loading}
                    />
                    <StatCard
                        title="Net Profit / Loss"
                        value={`${stats.overall.netProfit.toFixed(2)} coins`}
                        icon={<Coins className={cn("h-4 w-4", stats.overall.netProfit >= 0 ? 'text-green-500' : 'text-destructive')} />}
                        description="Based on settled straight bets."
                        loading={loading}
                    />
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Performance by Sport (Straights)</CardTitle>
                        <CardDescription>A breakdown of your single bets. Click a sport for more details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                        ) : sortedSports.length === 0 ? (
                            <p className="text-muted-foreground text-center">No straight bets placed yet.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sport</TableHead>
                                        <TableHead className="text-center">Record (W-L)</TableHead>
                                        <TableHead className="text-right">Win %</TableHead>
                                        <TableHead className="text-right">Avg. Odds</TableHead>
                                        <TableHead className="text-right">Net Profit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedSports.map(([sport, sportStats]) => {
                                        if (!sportStats) return null;
                                        const settledCount = sportStats.wins + sportStats.losses;
                                        const winRate = settledCount > 0 ? (sportStats.wins / settledCount) * 100 : 0;
                                        const avgOdds = sportStats.betCount > 0 ? (sportStats.totalOdds / sportStats.betCount) : 0;
                                        return (
                                            <TableRow key={sport}>
                                                <TableCell className="font-medium">
                                                  <Link href={`/stats/${sport}`} className="hover:underline text-primary">{sport}</Link>
                                                </TableCell>
                                                <TableCell className="text-center">{sportStats.wins}-{sportStats.losses}</TableCell>
                                                <TableCell className="text-right">{winRate.toFixed(1)}%</TableCell>
                                                <TableCell className="text-right">{avgOdds > 0 ? `+${avgOdds.toFixed(0)}` : avgOdds.toFixed(0)}</TableCell>
                                                <TableCell className={cn("text-right font-semibold", sportStats.netProfit > 0 && "text-green-600", sportStats.netProfit < 0 && "text-destructive")}>
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

            <TabsContent value="parlays" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                     <StatCard
                        title="Total Parlays"
                        value={stats.overall.totalBets.toString()}
                        icon={<Target className="h-4 w-4 text-muted-foreground" />}
                        description={`${stats.overall.pending} pending`}
                        loading={loading}
                    />
                    <StatCard
                        title="Parlay Win Rate"
                        value={`${stats.winPercentage.toFixed(1)}%`}
                        icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                        description={`${stats.overall.wins}W - ${stats.overall.losses}L`}
                        loading={loading}
                    />
                    <StatCard
                        title="Total Wagered"
                        value={`${stats.overall.totalWagered.toFixed(2)} coins`}
                        icon={<Coins className="h-4 w-4 text-muted-foreground" />}
                        description="Total amount staked."
                        loading={loading}
                    />
                    <StatCard
                        title="Net Profit / Loss"
                        value={`${stats.overall.netProfit.toFixed(2)} coins`}
                        icon={<Coins className={cn("h-4 w-4", stats.overall.netProfit >= 0 ? 'text-green-500' : 'text-destructive')} />}
                        description="Based on settled parlays."
                        loading={loading}
                    />
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Performance by Sport (Parlays)</CardTitle>
                        <CardDescription>A breakdown of your parlay tickets involving each sport. Click a sport for more details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                        ) : sortedSports.length === 0 ? (
                            <p className="text-muted-foreground text-center">No parlay bets placed yet.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sport</TableHead>
                                        <TableHead className="text-center">Ticket Record (W-L)</TableHead>
                                        <TableHead className="text-right">Win %</TableHead>
                                        <TableHead className="text-right">Avg. Legs</TableHead>
                                        <TableHead className="text-right">Net Profit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedSports.map(([sport, sportStats]) => {
                                        if (!sportStats || sportStats.betCount === 0) return null;
                                        const settledCount = sportStats.wins + sportStats.losses;
                                        const winRate = settledCount > 0 ? (sportStats.wins / settledCount) * 100 : 0;
                                        const avgLegs = sportStats.betCount > 0 ? (sportStats.totalLegs / sportStats.betCount) : 0;
                                        return (
                                            <TableRow key={sport}>
                                                <TableCell className="font-medium">
                                                  <Link href={`/stats/${sport}`} className="hover:underline text-primary">{sport}</Link>
                                                </TableCell>
                                                <TableCell className="text-center">{sportStats.wins}-{sportStats.losses}</TableCell>
                                                <TableCell className="text-right">{winRate.toFixed(1)}%</TableCell>
                                                <TableCell className="text-right">{avgLegs.toFixed(1)}</TableCell>
                                                <TableCell className={cn("text-right font-semibold", sportStats.netProfit > 0 && "text-green-600", sportStats.netProfit < 0 && "text-destructive")}>
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
