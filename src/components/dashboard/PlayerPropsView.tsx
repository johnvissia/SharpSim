'use client';

import type { Game, Team } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { User, ShieldAlert } from 'lucide-react';

const TeamLeaders = ({ team }: { team: Team }) => {
    const { leaders } = team;
    if (!leaders || Object.keys(leaders).length === 0) {
        return <p className="text-sm text-muted-foreground">No leader data available.</p>;
    }
    
    return (
        <div className="space-y-4">
            {leaders.points && (
                <div className="flex items-center gap-4">
                    <User className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div>
                        <p className="text-xs text-muted-foreground">Leading Scorer</p>
                        <p className="font-bold">{leaders.points.name}</p>
                        <p className="text-sm text-primary font-semibold">{leaders.points.value}</p>
                    </div>
                </div>
            )}
            {leaders.rebounds && (
                <div className="flex items-center gap-4">
                    <User className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div>
                        <p className="text-xs text-muted-foreground">Leading Rebounder</p>
                        <p className="font-bold">{leaders.rebounds.name}</p>
                        <p className="text-sm text-primary font-semibold">{leaders.rebounds.value}</p>
                    </div>
                </div>
            )}
             {leaders.assists && (
                <div className="flex items-center gap-4">
                    <User className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div>
                        <p className="text-xs text-muted-foreground">Leading Assister</p>
                        <p className="font-bold">{leaders.assists.name}</p>
                        <p className="text-sm text-primary font-semibold">{leaders.assists.value}</p>
                    </div>
                </div>
            )}
        </div>
    );
};


export function PlayerPropsView({ game }: { game: Game }) {

    const hasAnyLeaderData = !!(game.homeTeam.leaders || game.awayTeam.leaders);

    if (!hasAnyLeaderData) {
        return (
            <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-4">
                <ShieldAlert className="h-10 w-10 text-accent" />
                <p className="font-semibold">Key Player Data Unavailable</p>
                <p className="text-sm">Leader statistics are not available for this game.</p>
            </div>
        );
    }

    return (
        <div className="grid md:grid-cols-2 gap-4 py-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">{game.awayTeam.name}</CardTitle>
                    <CardDescription>Key Player Stats</CardDescription>
                </CardHeader>
                <CardContent>
                    <TeamLeaders team={game.awayTeam} />
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">{game.homeTeam.name}</CardTitle>
                    <CardDescription>Key Player Stats</CardDescription>
                </CardHeader>
                <CardContent>
                    <TeamLeaders team={game.homeTeam} />
                </CardContent>
            </Card>
        </div>
    );
}
