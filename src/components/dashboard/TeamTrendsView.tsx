'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchTeamTrends } from '@/lib/espn-trends';
import type { TeamTrend } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';


const renderMargin = (result: 'W' | 'L', margin: number) => {
    const absMargin = Math.abs(margin);

    if (result === 'W') {
        if (absMargin >= 1 && absMargin <= 3) {
            return (
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-yellow-600">Close Win</span>
                </div>
            );
        }
        if (absMargin >= 15) {
            return <span className="font-bold text-green-600">Blowout</span>;
        }
        return <span className="text-green-600">+{absMargin}</span>;
    }

    // It's a loss
    if (absMargin >= 15) {
        return <span className="font-bold text-destructive">Crushed</span>;
    }
    return <span className="text-destructive">-{absMargin}</span>;
}

const renderRest = (restDays?: number) => {
    if (restDays === undefined || restDays < 0) return <span className="text-muted-foreground">-</span>;
    if (restDays === 0) return <Badge variant="destructive">B2B</Badge>;
    if (restDays >= 3) return <span className="text-green-600 font-medium">{restDays}d Rest</span>
    return <span className="text-muted-foreground">{restDays}d Rest</span>;
}

export function TeamTrendsView({ teamId, teamName, sport }: { teamId: string, teamName: string, sport: string }) {
    const [trends, setTrends] = useState<TeamTrend[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const supportedSports = ['NBA', 'NHL'];
        if (!supportedSports.includes(sport)) {
            setLoading(false);
            setError(`Team trends are currently available for ${supportedSports.join(' and ')} only.`);
            return;
        }

        const getTrends = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchTeamTrends(teamId, sport);
                setTrends(data);
            } catch (e: any) {
                console.error(`Failed to load trends for ${teamName}`, e);
                setError(e.message || 'Failed to load team trends.');
            } finally {
                setLoading(false);
            }
        };

        getTrends();
    }, [teamId, teamName, sport]);
    
    const summaryStats = useMemo(() => {
        if (!trends || trends.length === 0) {
            return null;
        }

        const completed = trends.filter(t => t.result !== 'Upcoming');

        if (completed.length === 0) return null;

        let homeWins = 0;
        let homeLosses = 0;
        let homeMarginSum = 0;
        let awayWins = 0;
        let awayLosses = 0;
        let awayMarginSum = 0;

        completed.forEach(game => {
            if (game.opponent.at === 'vs') { // Home game
                homeMarginSum += game.margin;
                if (game.result === 'W') {
                    homeWins++;
                } else {
                    homeLosses++;
                }
            } else { // Away game
                awayMarginSum += game.margin;
                if (game.result === 'W') {
                    awayWins++;
                } else {
                    awayLosses++;
                }
            }
        });

        const totalHomeGames = homeWins + homeLosses;
        const totalAwayGames = awayWins + awayLosses;
        const totalWins = homeWins + awayWins;
        const totalLosses = homeLosses + awayLosses;

        const avgHomeMargin = totalHomeGames > 0 ? homeMarginSum / totalHomeGames : 0;
        const avgAwayMargin = totalAwayGames > 0 ? awayMarginSum / totalAwayGames : 0;
        
        const homeWinPct = totalHomeGames > 0 ? homeWins / totalHomeGames : 0;
        const awayWinPct = totalAwayGames > 0 ? awayWins / totalAwayGames : 0;
        
        const isHomeCourtHero = homeWinPct - awayWinPct > 0.20;

        return {
            overallRecord: `${totalWins}-${totalLosses}`,
            homeRecord: `${homeWins}-${homeLosses}`,
            awayRecord: `${awayWins}-${awayLosses}`,
            avgHomeMargin,
            avgAwayMargin,
            isHomeCourtHero
        };

    }, [trends]);

    if (loading) {
        return (
            <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                 </div>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            {Array.from({ length: 7 }).map((_, i) => (
                                <TableHead key={i}><Skeleton className="h-5 w-16" /></TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 10 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 7 }).map((_, j) => (
                                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )
    }

    if (error) {
        return <p className="text-sm text-center text-muted-foreground py-8">{error}</p>
    }

    if (!trends || trends.length === 0) {
        return <p className="text-sm text-center text-muted-foreground py-8">No recent game data found.</p>
    }

    const renderAtsBadge = (status: TeamTrend['ats']) => {
        switch (status) {
            case 'Cover':
                return <Badge className="bg-green-500 text-primary-foreground hover:bg-green-500/90">Cover</Badge>;
            case 'No Cover':
                return <Badge variant="destructive">No Cover</Badge>;
            case 'Push':
                return <Badge variant="secondary">Push</Badge>;
            default:
                return <span className="text-muted-foreground">-</span>;
        }
    };

    const renderOuBadge = (status: TeamTrend['ou']) => {
        switch (status) {
            case 'Over':
                return <Badge variant="outline" className="text-blue-600 border-blue-600/50">Over</Badge>
            case 'Under':
                return <Badge variant="outline" className="text-purple-600 border-purple-600/50">Under</Badge>
            case 'Push':
                return <Badge variant="secondary">Push</Badge>;
            default:
                return <span className="text-muted-foreground">-</span>;
        }
    };

    return (
        <div>
            {summaryStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Last 10 Games</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.overallRecord}</div>
                            {summaryStats.isHomeCourtHero && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    <Badge variant="secondary">🏠 Home Court Hero</Badge>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">🏠 Home Splits</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.homeRecord}</div>
                            <p className={cn("text-xs", summaryStats.avgHomeMargin >= 0 ? "text-green-600" : "text-destructive")}>
                                Avg. Margin: {summaryStats.avgHomeMargin.toFixed(1)} pts
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">✈️ Away Splits</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summaryStats.awayRecord}</div>
                             <p className={cn("text-xs", summaryStats.avgAwayMargin >= 0 ? "text-green-600" : "text-destructive")}>
                                Avg. Margin: {summaryStats.avgAwayMargin.toFixed(1)} pts
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead>Matchup</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Margin</TableHead>
                        <TableHead>Rest</TableHead>
                        <TableHead className="text-center">Spread (ATS)</TableHead>
                        <TableHead className="text-center">Total (O/U)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {trends.map((game, index) => (
                        <TableRow key={index} className={cn(game.result === 'Upcoming' && 'bg-blue-500/10')}>
                            <TableCell className="text-muted-foreground">{new Date(game.fullDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
                            <TableCell>
                                <span>{game.opponent.at} </span>
                                <span className="font-semibold">{game.opponent.name}</span>
                            </TableCell>
                            <TableCell className={cn(
                                "font-semibold", 
                                game.result === 'W' && 'text-green-600',
                                game.result === 'L' && 'text-destructive',
                                game.result === 'Upcoming' && 'text-blue-400'
                            )}>
                                {game.result} {game.result !== 'Upcoming' && game.score}
                            </TableCell>
                            <TableCell>
                                {game.result === 'W' || game.result === 'L' 
                                    ? renderMargin(game.result, game.margin) 
                                    : <span className="text-muted-foreground text-center">-</span>
                                }
                            </TableCell>
                            <TableCell>
                                {renderRest(game.restDays)}
                            </TableCell>
                            <TableCell className="text-center">{renderAtsBadge(game.ats)}</TableCell>
                            <TableCell className="text-center">{renderOuBadge(game.ou)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
