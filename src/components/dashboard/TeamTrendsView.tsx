'use client';

import { useState, useEffect } from 'react';
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
    if (restDays === undefined) return <span className="text-muted-foreground">-</span>;
    if (restDays === 0) return <Badge variant="destructive">B2B</Badge>;
    if (restDays >= 3) return <span className="text-green-600 font-medium">{restDays}d Rest</span>
    return <span className="text-muted-foreground">-</span>;
}

export function TeamTrendsView({ teamId, teamName, sport }: { teamId: string, teamName: string, sport: string }) {
    const [trends, setTrends] = useState<TeamTrend[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (sport !== 'NBA') {
            setLoading(false);
            setError('Team trends are currently available for NBA only.');
            return;
        }

        const getTrends = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchTeamTrends(teamId);
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
    
    if (loading) {
        return (
            <div className="space-y-1 p-2">
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
            case 'Under':
            case 'Push':
                return <Badge variant="secondary">{status}</Badge>;
            default:
                return <span className="text-muted-foreground">-</span>;
        }
    };

    return (
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
                    <TableRow key={index}>
                        <TableCell className="text-muted-foreground">{game.date}</TableCell>
                        <TableCell>
                            <span>{game.opponent.at} </span>
                            <span className="font-semibold">{game.opponent.name}</span>
                        </TableCell>
                        <TableCell className={cn("font-semibold", game.result === 'W' ? 'text-green-600' : 'text-destructive')}>
                            {game.result} {game.score}
                        </TableCell>
                        <TableCell>
                            {renderMargin(game.result, game.margin)}
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
    );
}
