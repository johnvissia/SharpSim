'use client';

import { useState, useEffect } from 'react';
import { getPlayerProps } from './actions';
import type { Tank01Game, Tank01Player, Tank01PlayerProp } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { User, Loader2 } from 'lucide-react';

const PlayerAccordion = ({ player }: { player: Tank01Player }) => {
    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value={player.playerId} className="border-b-0">
                <AccordionTrigger className="text-base font-semibold hover:no-underline rounded-lg px-4 py-2 bg-slate-800/50 hover:bg-slate-800">
                    <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        {player.playerName}
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                    <div className="space-y-2 pl-4 pr-2">
                        {player.props.map(prop => (
                            <div key={prop.propId} className="grid grid-cols-3 items-center gap-2 text-sm p-2 rounded-md bg-slate-900">
                                <div className="col-span-1">
                                    <p className="font-medium capitalize">{prop.market.toUpperCase()}</p>
                                    <p className="text-primary font-semibold">{prop.line}</p>
                                </div>
                                <div className="col-span-2 grid grid-cols-2 gap-2">
                                     <div className="flex justify-between items-center bg-slate-800 p-2 rounded">
                                        <span>Over</span>
                                        <span className="font-semibold">{prop.overOdds > 0 ? `+${prop.overOdds}` : prop.overOdds}</span>
                                     </div>
                                      <div className="flex justify-between items-center bg-slate-800 p-2 rounded">
                                        <span>Under</span>
                                        <span className="font-semibold">{prop.underOdds > 0 ? `+${prop.underOdds}` : prop.underOdds}</span>
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

const GameCard = ({ game }: { game: Tank01Game }) => {
    return (
        <Card className="bg-card">
            <CardHeader>
                <CardTitle className="text-xl">{game.matchup}</CardTitle>
                <p className="text-sm text-muted-foreground">
                    {new Date(game.gameTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
            </CardHeader>
            <CardContent className="space-y-2">
                {game.players.map(player => (
                    <PlayerAccordion key={player.playerId} player={player} />
                ))}
            </CardContent>
        </Card>
    );
};


export default function PropHubPage() {
    const [games, setGames] = useState<Tank01Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getPlayerProps();
                setGames(data);
            } catch (err: any) {
                setError(err.message || "Failed to fetch player props. The API might be unavailable.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return (
        <div className="p-4 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">NBA Player Prop Hub</h1>
                <p className="text-muted-foreground">Daily player prop markets from the Tank01 API.</p>
            </header>

            {loading && (
                 <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Fetching Today's Props...</h2>
                    <p className="text-muted-foreground">This may take a moment.</p>
                </div>
            )}
            
            {error && (
                 <Card className="bg-destructive/20 border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Fetching Props</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error}</p>
                    </CardContent>
                </Card>
            )}

            {!loading && !error && games.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">No player props available for today's NBA games.</p>
                    </CardContent>
                </Card>
            )}

            {!loading && !error && games.length > 0 && (
                <div className="space-y-6">
                    {games.map(game => (
                        <GameCard key={game.gameId} game={game} />
                    ))}
                </div>
            )}
        </div>
    )
}
