'use client';

import { useMemo } from 'react';
import { collection, doc } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet, SportName, UserProfile } from '@/lib/types';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { 
    TrendingUp, 
    Lightbulb, 
    Verified, 
    AlertTriangle,
    Search,
    MoreVertical,
    Activity
} from 'lucide-react';
import { sportIconMap } from '@/lib/team-logos';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type BreakdownStats = {
    wins: number;
    losses: number;
    pushes: number;
    pending: number;
    betCount: number;
    totalWagered: number;
    netProfit: number;
};

export default function StatsPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const betsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'bets');
    }, [user, firestore]);

    const { data: bets, isLoading: isLoadingBets } = useCollection<UserBet>(betsQuery);

    const userProfileRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const loading = isUserLoading || isLoadingBets || isProfileLoading;

    const stats = useMemo(() => {
        const initialBreakdownStats = (): BreakdownStats => ({
            wins: 0,
            losses: 0,
            pushes: 0,
            pending: 0,
            betCount: 0,
            totalWagered: 0,
            netProfit: 0,
        });

        const overall = {
            wins: 0,
            losses: 0,
            pushes: 0,
            pending: 0,
            totalBets: 0,
            totalWagered: 0,
            netProfit: 0,
            activeStake: 0,
        };
        const breakdown: Record<string, BreakdownStats> = {};

        if (!bets) {
            return { overall, breakdown, winPercentage: 0, roiPercentage: 0 };
        }

        overall.totalBets = bets.length;

        for (const bet of bets) {
            // Overall ticket-based calculations
            if (bet.status !== 'pending' && bet.status !== 'push') {
                 overall.totalWagered += bet.stake;
            }
            
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
                overall.activeStake += bet.stake;
            }

            // Breakdown calculations (By Sport)
            if (bet.betType === 'parlay') {
                const involvedSports = new Set<SportName>();
                if (bet.legs) {
                    bet.legs.forEach(leg => involvedSports.add(leg.sport));
                }

                if (involvedSports.size > 0) {
                    const profit = (bet.status === 'won' ? (bet.potentialWinnings - bet.stake) : (bet.status === 'lost' ? -bet.stake : 0));
                    const profitPerSport = profit / involvedSports.size;
                    const wagerPerSport = bet.stake / involvedSports.size;

                    involvedSports.forEach(sport => {
                        if (!breakdown[sport]) {
                            breakdown[sport] = initialBreakdownStats();
                        }
                        const sportStats = breakdown[sport]!;
                        sportStats.betCount++;
                        
                        if (bet.status !== 'pending' && bet.status !== 'push') {
                             sportStats.totalWagered += wagerPerSport;
                        }
                        sportStats.netProfit += profitPerSport;

                        switch (bet.status) {
                            case 'won': sportStats.wins++; break;
                            case 'lost': sportStats.losses++; break;
                            case 'push': sportStats.pushes++; break;
                            case 'pending': sportStats.pending++; break;
                        }
                    });
                }
            } else {
                const sport = bet.sport;
                if (!breakdown[sport]) {
                    breakdown[sport] = initialBreakdownStats();
                }
                const sportStats = breakdown[sport]!;

                sportStats.betCount++;
                if (bet.status !== 'pending' && bet.status !== 'push') {
                    sportStats.totalWagered += bet.stake;
                }

                switch (bet.status) {
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
            }
        }

        const settledTicketCount = overall.wins + overall.losses;
        const winPercentage = settledTicketCount > 0 ? (overall.wins / settledTicketCount) * 100 : 0;
        const roiPercentage = overall.totalWagered > 0 ? (overall.netProfit / overall.totalWagered) * 100 : 0;

        return { overall, breakdown, winPercentage, roiPercentage };
    }, [bets]);

    const chartData = useMemo(() => {
        if (!bets) return [];

        const settledBets = bets.filter(bet => bet.status === 'won' || bet.status === 'lost');
        const sortedBets = settledBets.sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

        const dailyMap = new Map<string, number>();
        sortedBets.forEach(bet => {
            const date = new Date(bet.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const profit = bet.status === 'won' ? (bet.potentialWinnings - bet.stake) : -bet.stake;
            dailyMap.set(date, (dailyMap.get(date) || 0) + profit);
        });

        let cumulative = 0;
        return Array.from(dailyMap.entries()).map(([date, dailyProfit]) => {
            cumulative += dailyProfit;
            return { date, units: Number(cumulative.toFixed(2)) };
        });
    }, [bets]);

    const sortedBreakdown = useMemo(() => {
        return Object.entries(stats.breakdown).sort(([, a], [, b]) => {
            if (!a || !b) return 0;
            return b.betCount - a.betCount;
        });
    }, [stats.breakdown]);

    const sortedPreferences = useMemo(() => {
        if (!userProfile?.preferences) return null;
        const p = userProfile.preferences;
        const sortRecord = (record: Record<string, number> = {}) => 
            Object.entries(record).sort((a, b) => b[1] - a[1]).slice(0, 5); // top 5
        
        return {
            sports: sortRecord(p.sports),
            betTypes: sortRecord(p.betTypes),
            teams: sortRecord(p.teams),
            players: sortRecord(p.players),
            conferences: sortRecord(p.conferences),
        };
    }, [userProfile]);


    if (loading) {
        return (
            <div className="p-8 space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8 min-h-screen">
            <header className="mb-10">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 uppercase tracking-tighter font-bold">
                    <span>Account</span>
                    <span className="text-[10px] mx-1">›</span>
                    <span className="text-brand-400">Ledger Analysis</span>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-foreground tracking-tighter">Performance Ledger</h1>
                        <p className="text-muted-foreground mt-1 font-medium">Data-driven insights for all bets.</p>
                    </div>
                </div>
            </header>

            {/* KPI Bento Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="bg-slate-900/50 p-6 rounded-xl flex flex-col gap-1 border border-slate-800 hover:ring-1 ring-brand-500/50 transition-all">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Profit</span>
                    <span className={cn("text-3xl font-extrabold", stats.overall.netProfit >= 0 ? "text-brand-400" : "text-destructive")}>
                        {stats.overall.netProfit >= 0 ? '+' : '-'}${Math.abs(stats.overall.netProfit).toFixed(2)}
                    </span>
                    {/* TODO: Implement historical bankroll snapshots to compute this dynamically vs last month */}
                    <div className="flex items-center gap-1 text-slate-500 text-xs font-bold mt-2">
                        <span>Lifetime Profit / Loss</span>
                    </div>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-xl flex flex-col gap-1 border border-slate-800">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total ROI</span>
                    <span className={cn("text-3xl font-extrabold", stats.roiPercentage >= 0 ? "text-brand-400" : "text-destructive")}>
                         {stats.roiPercentage > 0 ? '+' : ''}{stats.roiPercentage.toFixed(2)}%
                    </span>
                    <span className="text-slate-500 text-xs font-bold mt-2 uppercase">Aggregated across all sports</span>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-xl flex flex-col gap-1 border border-slate-800">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Win Percentage</span>
                    <span className="text-3xl font-extrabold text-foreground">{stats.winPercentage.toFixed(1)}%</span>
                    <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div className="bg-brand-500 h-full transition-all" style={{ width: `${stats.winPercentage}%` }}></div>
                    </div>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-xl flex flex-col gap-1 border border-slate-800">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Active Stake</span>
                    <span className="text-3xl font-extrabold text-foreground">${stats.overall.activeStake.toFixed(2)}</span>
                    <span className="text-slate-500 text-xs font-bold mt-2 uppercase">{stats.overall.pending} Pending Bets</span>
                </div>
            </section>

            {/* Charts & Analysis Row */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                {/* Profit Graph */}
                <div className="lg:col-span-2 bg-slate-900/50 pt-8 pb-4 px-4 md:px-8 rounded-xl border border-slate-800 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6 px-4">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Growth Velocity</h2>
                            <p className="text-slate-500 text-sm">Profit accumulation over time</p>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-[300px]">
                         <PerformanceChart data={chartData} />
                    </div>
                </div>

                {/* Side Card: Betting Habits */}
                <div className="bg-slate-900/50 rounded-xl overflow-hidden flex flex-col border border-slate-800">
                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-brand-400" />
                            Your Betting Habits
                        </h2>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto max-h-[450px]">
                        {!sortedPreferences ? (
                            <p className="text-sm text-slate-500">No betting history found.</p>
                        ) : (
                            <Accordion type="multiple" defaultValue={["teams"]} className="w-full">
                                {sortedPreferences.teams.length > 0 && (
                                    <AccordionItem value="teams" className="border-slate-800">
                                        <AccordionTrigger className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 py-3">Most Bet Teams</AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-2 pt-2 pb-2">
                                                {sortedPreferences.teams.map(([team, count]) => (
                                                    <div key={team} className="flex justify-between items-center text-sm p-2 rounded-lg bg-slate-800/30 border border-slate-800/50 hover:bg-slate-800/60 transition-colors">
                                                        <span className="font-semibold text-slate-200">{team}</span>
                                                        <span className="text-brand-400 font-bold bg-brand-500/10 px-2 py-0.5 rounded text-xs">{count} bets</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                                
                                {sortedPreferences.players.length > 0 && (
                                    <AccordionItem value="players" className="border-slate-800">
                                        <AccordionTrigger className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 py-3">Favorite Players</AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-2 pt-2 pb-2">
                                                {sortedPreferences.players.map(([player, count]) => (
                                                    <div key={player} className="flex justify-between items-center text-sm p-2 rounded-lg bg-slate-800/30 border border-slate-800/50 hover:bg-slate-800/60 transition-colors">
                                                        <span className="font-semibold text-slate-200">{player}</span>
                                                        <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded text-xs">{count} bets</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}

                                {sortedPreferences.betTypes.length > 0 && (
                                    <AccordionItem value="betTypes" className="border-slate-800">
                                        <AccordionTrigger className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 py-3">Preferred Markets</AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-2 pt-2 pb-2">
                                                {sortedPreferences.betTypes.map(([type, count]) => (
                                                    <div key={type} className="flex justify-between items-center text-sm p-2 rounded-lg bg-slate-800/30 border border-slate-800/50 hover:bg-slate-800/60 transition-colors">
                                                        <span className="font-semibold text-slate-200 capitalize">{type.replace('_', ' ')}</span>
                                                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-xs">{count} bets</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                                
                                {sortedPreferences.conferences.length > 0 && (
                                    <AccordionItem value="conferences" className="border-slate-800 border-b-0">
                                        <AccordionTrigger className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 py-3">Top Conferences</AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-2 pt-2 pb-2">
                                                {sortedPreferences.conferences.map(([conf, count]) => (
                                                    <div key={conf} className="flex justify-between items-center text-sm p-2 rounded-lg bg-slate-800/30 border border-slate-800/50 hover:bg-slate-800/60 transition-colors">
                                                        <span className="font-semibold text-slate-200">{conf}</span>
                                                        <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded text-xs">{count} bets</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                            </Accordion>
                        )}
                    </div>
                </div>
            </section>

            {/* Enhanced Data Table */}
            <section className="bg-slate-900/50 rounded-xl overflow-hidden mb-10 border border-slate-800">
                <div className="px-6 md:px-8 py-6 flex justify-between items-center border-b border-slate-800">
                    <h2 className="text-xl font-bold tracking-tight">Performance by Sport</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] text-slate-500 uppercase tracking-widest font-black border-b border-slate-800">
                                <th className="px-6 md:px-8 py-4">Sport</th>
                                <th className="px-6 md:px-8 py-4">Volume</th>
                                <th className="px-6 md:px-8 py-4">Win Rate</th>
                                <th className="px-6 md:px-8 py-4">Avg Stake</th>
                                <th className="px-6 md:px-8 py-4">ROI%</th>
                                <th className="px-6 md:px-8 py-4 text-right">Profit / Loss</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-medium">
                            {sortedBreakdown.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                                        No settled bets to display.
                                    </td>
                                </tr>
                            ) : (
                                sortedBreakdown.map(([sport, sportStats]) => {
                                    if (!sportStats) return null;
                                    const settledCount = sportStats.wins + sportStats.losses;
                                    const winRate = settledCount > 0 ? (sportStats.wins / settledCount) * 100 : 0;
                                    const avgStake = sportStats.betCount > 0 ? (sportStats.totalWagered / sportStats.betCount) : 0;
                                    const roi = sportStats.totalWagered > 0 ? (sportStats.netProfit / sportStats.totalWagered) * 100 : 0;
                                    
                                    const SportIcon = sportIconMap[sport as SportName] || Activity;

                                    return (
                                        <tr key={sport} className="group hover:bg-slate-800/40 transition-colors border-b border-slate-800/50 last:border-0">
                                            <td className="px-6 md:px-8 py-5 flex items-center gap-3">
                                                <SportIcon className="w-5 h-5 text-blue-400" />
                                                <div>
                                                    <span className="block font-bold">{sport}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 md:px-8 py-5 text-slate-400">
                                                {sportStats.betCount} Bets
                                            </td>
                                            <td className="px-6 md:px-8 py-5">
                                                <span>{winRate.toFixed(1)}%</span>
                                                <div className="w-20 bg-slate-800 h-1 rounded-full mt-1">
                                                    <div 
                                                        className={cn("h-full rounded-full", winRate >= 50 ? "bg-blue-400" : "bg-red-400")} 
                                                        style={{ width: `${winRate}%` }}
                                                    ></div>
                                                </div>
                                            </td>
                                            <td className="px-6 md:px-8 py-5 text-slate-400">
                                                ${avgStake.toFixed(2)}
                                            </td>
                                            <td className={cn("px-6 md:px-8 py-5 font-bold", roi >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                {roi > 0 ? '+' : ''}{roi.toFixed(1)}%
                                            </td>
                                            <td className={cn("px-6 md:px-8 py-5 text-right font-bold", sportStats.netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                                                {sportStats.netProfit > 0 ? '+' : ''}${sportStats.netProfit.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

