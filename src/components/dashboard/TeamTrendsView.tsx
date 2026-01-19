'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { fetchTeamTrends } from '@/lib/espn-trends';
import type { TeamTrend } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { sportIconMap } from '@/lib/team-logos';

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
    
    const renderContent = () => {
        if (loading) {
            return (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-10" />
                                <Skeleton className="h-6 w-6 rounded-full" />
                                <Skeleton className="h-5 w-24" />
                            </div>
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-5 w-20" />
                        </div>
                    ))}
                </div>
            )
        }

        if (error) {
            return <p className="text-sm text-center text-muted-foreground py-4">{error}</p>
        }

        if (!trends || trends.length === 0) {
            return <p className="text-sm text-center text-muted-foreground py-4">No recent game data found.</p>
        }

        return (
            <ul className="space-y-3">
                {trends.map((game, index) => {
                    const FallbackIcon = sportIconMap[sport] || sportIconMap.Default;
                    return (
                    <li key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 font-medium">
                            <span className="w-10 text-muted-foreground">{game.date}</span>
                            <span className="w-4 text-muted-foreground">{game.opponent.at}</span>
                            {game.opponent.logo ? (
                                <Image src={game.opponent.logo} alt={game.opponent.name} width={20} height={20} className="h-5 w-5 object-contain" />
                            ) : (
                                <div className="w-5 h-5 flex items-center justify-center">
                                    <FallbackIcon className="w-4 h-4 text-muted-foreground" />
                                </div>
                            )}
                            <span className="truncate w-24">{game.opponent.name}</span>
                        </div>
                        <span className={cn("font-semibold", game.result === 'W' ? 'text-green-600' : 'text-destructive')}>
                            {game.result} {game.score}
                        </span>
                        <div className="flex gap-1">
                            <Badge variant={game.ats === 'Cover' ? 'default' : 'destructive'} className={cn({"bg-green-500": game.ats === 'Cover', 'opacity-50': game.ats === 'N/A' || game.ats === 'Push'})}>
                                {game.ats === 'No Cover' ? 'Fail' : game.ats}
                            </Badge>
                             <Badge variant="secondary">{game.ou}</Badge>
                        </div>
                    </li>
                )})}
            </ul>
        )
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{teamName} - Last 10 Games</CardTitle>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
        </Card>
    );
}
