'use client';
import type { Game } from '@/lib/types';
import { User } from 'lucide-react';

const LeaderStat = ({ label, value }: { label: string; value?: string; }) => (
    <div className="flex items-center gap-3">
        <div className="bg-muted p-2 rounded-full">
            <User className="h-5 w-5 text-accent" />
        </div>
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm">{value || 'N/A'}</p>
        </div>
    </div>
);


export function GameLeadersView({ game }: { game: Game }) {
    return (
        <div className="p-4 bg-slate-900 rounded-lg">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Away Team Leaders */}
                <div className="space-y-4">
                    <h3 className="font-bold text-lg text-center">{game.awayTeam.name}</h3>
                    <div className="space-y-3">
                        <LeaderStat 
                            label="Leading Scorer"
                            value={game.awayTeam.leadingScorer}
                        />
                         <LeaderStat 
                            label="Leading Assister"
                            value={game.awayTeam.leadingAssister}
                        />
                         <LeaderStat 
                            label="Leading Rebounder"
                            value={game.awayTeam.leadingRebounder}
                        />
                    </div>
                </div>

                {/* Home Team Leaders */}
                <div className="space-y-4">
                    <h3 className="font-bold text-lg text-center">{game.homeTeam.name}</h3>
                     <div className="space-y-3">
                        <LeaderStat 
                            label="Leading Scorer"
                            value={game.homeTeam.leadingScorer}
                        />
                         <LeaderStat 
                            label="Leading Assister"
                            value={game.homeTeam.leadingAssister}
                        />
                         <LeaderStat 
                            label="Leading Rebounder"
                            value={game.homeTeam.leadingRebounder}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
