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
            <div className="space-y-3 p-6">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-4 w-full">
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 flex-1" />
                        </div>
                    </div>
                ))}
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
            case 'N/A':
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
            case 'N/A':
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
                        <TableCell className="text-center">{renderAtsBadge(game.ats)}</TableCell>
                        <TableCell className="text-center">{renderOuBadge(game.ou)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
