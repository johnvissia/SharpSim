'use client';

import type { Game } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { User, ShieldAlert } from 'lucide-react';

export function PlayerPropsView({ game }: { game: Game }) {

    if (!game.homeTeam.leadingScorer && !game.awayTeam.leadingScorer) {
        return (
            <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-4">
                <ShieldAlert className="h-10 w-10 text-accent" />
                <p className="font-semibold">Key Player Data Unavailable</p>
                <p className="text-sm">Leading scorer information is not available for this game.</p>
            </div>
        );
    }

    return (
        <div className="grid md:grid-cols-2 gap-4 py-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">{game.awayTeam.name}</CardTitle>
                    <CardDescription>Key Player</CardDescription>
                </CardHeader>
                <CardContent>
                    {game.awayTeam.leadingScorer ? (
                        <div className="flex items-center gap-4">
                            <User className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="font-bold">{game.awayTeam.leadingScorer.name}</p>
                                <p className="text-sm text-primary font-semibold">{game.awayTeam.leadingScorer.value}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No leader data.</p>
                    )}
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">{game.homeTeam.name}</CardTitle>
                    <CardDescription>Key Player</CardDescription>
                </CardHeader>
                <CardContent>
                    {game.homeTeam.leadingScorer ? (
                        <div className="flex items-center gap-4">
                            <User className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="font-bold">{game.homeTeam.leadingScorer.name}</p>
                                <p className="text-sm text-primary font-semibold">{game.homeTeam.leadingScorer.value}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No leader data.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
