'use client';

import { useState, useEffect } from 'react';
import type { Game, Injury } from '@/lib/types';
import { getNotableInjuries } from '@/lib/espn-injuries';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';

const InjuryList = ({ injuries, teamName }: { injuries: Injury[], teamName: string }) => {
    if (injuries.length === 0) {
        return <p className="text-sm text-muted-foreground">No Notable Injuries.</p>;
    }

    return (
        <ul className="space-y-3">
            {injuries.map(injury => (
                <li key={injury.name} className="flex items-center justify-between text-sm">
                    <div>
                        <p className="font-semibold">{injury.name} <span className="text-xs text-muted-foreground">{injury.position}</span></p>
                        <p className="text-xs text-muted-foreground">Injured: {new Date(injury.date).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={injury.status.toLowerCase() === 'out' ? 'destructive' : 'secondary'}>
                        {injury.status}
                    </Badge>
                </li>
            ))}
        </ul>
    );
};

export function InjuriesView({ game }: { game: Game }) {
    const [injuries, setInjuries] = useState<{ home: Injury[], away: Injury[] } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (game.sport !== 'NBA') {
            setLoading(false);
            return;
        };

        const fetchInjuries = async () => {
            setLoading(true);
            const injuryData = await getNotableInjuries(game.homeTeam.id, game.awayTeam.id);
            setInjuries(injuryData);
            setLoading(false);
        };

        fetchInjuries();
    }, [game]);

    if (game.sport !== 'NBA') {
        return (
            <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-4">
                <ShieldAlert className="h-10 w-10 text-accent" />
                <p className="font-semibold">Injury Reports Available for NBA Only</p>
                <p className="text-sm">This feature is currently limited to NBA games.</p>
            </div>
        );
    }

    if (loading) {
        return (
             <div className="grid md:grid-cols-2 gap-4 py-4">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid md:grid-cols-2 gap-4 py-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">{game.awayTeam.name}</CardTitle>
                    <CardDescription>Injury Report</CardDescription>
                </CardHeader>
                <CardContent>
                    <InjuryList injuries={injuries?.away || []} teamName={game.awayTeam.name} />
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">{game.homeTeam.name}</CardTitle>
                    <CardDescription>Injury Report</CardDescription>
                </CardHeader>
                <CardContent>
                    <InjuryList injuries={injuries?.home || []} teamName={game.homeTeam.name} />
                </CardContent>
            </Card>
        </div>
    );
}
