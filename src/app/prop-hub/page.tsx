
'use client';

import { useState, useMemo } from 'react';
import type { PlayerProp } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { User, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useBetSlip } from '@/context/BetSlipContext';

interface UIAccordionProp {
    propId: string;
    market: string;
    line: number;
    overOdds: number;
    underOdds: number;
    pick: 'over' | 'under';
}

interface UIPlayer {
    playerId: string;
    playerName: string;
    props: UIAccordionProp[];
}

interface UIGame {
    gameId: string;
    matchup: string;
    gameTime: string;
    players: UIPlayer[];
}


const PlayerAccordion = ({ player, game }: { player: UIPlayer, game: UIGame }) => {
    const { addPick, picks } = useBetSlip();

    const handlePick = (prop: UIAccordionProp) => {
        const gameForSlip = {
            id: game.gameId,
            sport: 'NBA' as const,
            startTime: game.gameTime,
            homeTeam: { id: '', name: game.matchup.split(' @ ')[1], logo: '', players: []},
            awayTeam: { id: '', name: game.matchup.split(' @ ')[0], logo: '', players: []},
        };

        const pickString = `${prop.pick.charAt(0).toUpperCase() + prop.pick.slice(1)} ${prop.line}`;
        const pickOdds = prop.pick === 'over' ? prop.overOdds : prop.underOdds;

        addPick({
            game: gameForSlip,
            pick: `${player.playerName} - ${pickString}`,
            odds: pickOdds,
            betType: 'player_prop',
            marketId: `${prop.propId}`, // Unique ID for this specific prop market
            playerId: player.playerId,
            market: prop.market,
            line: prop.line,
        });
    };
    
    const isPickInSlip = (propId: string) => {
        return picks.some(p => p.marketId === propId);
    };

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
                                     <Button 
                                        variant={isPickInSlip(prop.propId) && picks.find(p => p.marketId === prop.propId)?.pick.includes('Over') ? 'secondary' : 'outline'}
                                        onClick={() => handlePick({...prop, pick: 'over'})}
                                        className="flex justify-between items-center bg-slate-800 p-2 rounded h-auto"
                                     >
                                        <span>Over</span>
                                        <span className="font-semibold">{prop.overOdds > 0 ? `+${prop.overOdds}` : prop.overOdds}</span>
                                     </Button>
                                      <Button
                                        variant={isPickInSlip(prop.propId) && picks.find(p => p.marketId === prop.propId)?.pick.includes('Under') ? 'secondary' : 'outline'}
                                        onClick={() => handlePick({...prop, pick: 'under'})}
                                        className="flex justify-between items-center bg-slate-800 p-2 rounded h-auto"
                                     >
                                        <span>Under</span>
                                        <span className="font-semibold">{prop.underOdds > 0 ? `+${prop.underOdds}` : prop.underOdds}</span>
                                     </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

const GameCard = ({ game }: { game: UIGame }) => {
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
                    <PlayerAccordion key={player.playerId} player={player} game={game} />
                ))}
            </CardContent>
        </Card>
    );
};


export default function PropHubPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const firestore = useFirestore();

    const [debugLoading, setDebugLoading] = useState(false);
    const [debugResponse, setDebugResponse] = useState<string | null>(null);

    const [gradingDebugLoading, setGradingDebugLoading] = useState(false);
    const [gradingDebugResponse, setGradingDebugResponse] = useState<string | null>(null);

    const propsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'player_props'), orderBy('commenceTime'));
    }, [firestore]);

    const { data: playerProps, isLoading: isLoadingProps } = useCollection<PlayerProp>(propsQuery);

    const games = useMemo(() => {
        if (!playerProps) return [];
        
        const gamesMap = new Map<string, { gameId: string, matchup: string, gameTime: string, players: Map<string, UIPlayer> }>();

        playerProps.forEach(prop => {
            if (!gamesMap.has(prop.gameId)) {
                gamesMap.set(prop.gameId, {
                    gameId: prop.gameId,
                    matchup: prop.matchup,
                    gameTime: prop.commenceTime,
                    players: new Map()
                });
            }
            const game = gamesMap.get(prop.gameId)!;

            if (!game.players.has(prop.playerId)) {
                game.players.set(prop.playerId, {
                    playerId: prop.playerId,
                    playerName: prop.playerName,
                    props: []
                });
            }
            const player = game.players.get(prop.playerId)!;

            player.props.push({
                propId: prop.id, // The doc ID from firestore
                market: prop.market,
                line: prop.line,
                overOdds: prop.overOdds,
                underOdds: prop.underOdds,
                pick: 'over' // dummy value, will be set on click
            });
        });

        return Array.from(gamesMap.values()).map(game => ({
            ...game,
            players: Array.from(game.players.values())
        }));

    }, [playerProps]);

    const handleSyncProps = async () => {
        setLoading(true);
        setError(null);
        setGradingDebugResponse(null);
        setDebugResponse(null);
        try {
            const response = await fetch('/api/sync-player-props');
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Failed to sync props from API.');
            }
            toast({
                title: 'Sync Complete',
                description: result.message,
            });
        } catch (err: any) {
            setError(err.message || "Failed to fetch player props. The API might be unavailable.");
             toast({
                title: 'Sync Failed',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };
    
    const handleDebug = async () => {
        setDebugLoading(true);
        setDebugResponse(null);
        setGradingDebugResponse(null);
        try {
            const response = await fetch('/api/debug-tank01');
            const result = await response.json();
            setDebugResponse(JSON.stringify(result, null, 2));

        } catch (err: any) {
            setDebugResponse(`Error: ${err.message}`);
        } finally {
            setDebugLoading(false);
        }
    };

    const handleGradingDebug = async () => {
        setGradingDebugLoading(true);
        setGradingDebugResponse(null);
        setDebugResponse(null);
        try {
            const response = await fetch('/api/debug-grading');
            const result = await response.json();
            setGradingDebugResponse(JSON.stringify(result, null, 2));
        } catch (err: any) {
            setGradingDebugResponse(`Error: ${err.message}`);
        } finally {
            setGradingDebugLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8">
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">NBA Player Prop Hub</h1>
                <p className="text-muted-foreground">Daily player prop markets from the Tank01 API.</p>
              </div>
              <div className="flex items-center gap-4">
                  <Button onClick={handleSyncProps} disabled={loading} size="lg">
                      <RefreshCw className={`mr-2 h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'Syncing...' : 'Sync Player Props'}
                  </Button>
                  <Button onClick={handleDebug} disabled={debugLoading} variant="destructive">
                     <span role="img" aria-label="tools" className="mr-2">🛠️</span>
                     {debugLoading ? 'Testing...' : 'Test API Connection'}
                  </Button>
                  <Button onClick={handleGradingDebug} disabled={gradingDebugLoading} variant="outline" className="text-purple-400 border-purple-400/50 hover:bg-purple-400/10 hover:text-purple-300">
                     <span role="img" aria-label="ladybug" className="mr-2">🐞</span>
                     {gradingDebugLoading ? 'Debugging...' : 'Debug Grading'}
                  </Button>
              </div>
            </header>

            {debugResponse && (
                <Card className="my-6 bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg text-amber-400">
                            <AlertCircle className="h-5 w-5" />
                            Raw API Connection Response
                        </CardTitle>
                        <CardDescription>
                            This is the raw JSON returned from the <strong>`/api/debug-tank01`</strong> route.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs bg-slate-900 p-4 rounded-md overflow-x-auto text-white max-h-96">
                            {debugResponse}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {gradingDebugResponse && (
                 <Card className="my-6 bg-slate-800 border-purple-500/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg text-purple-400">
                            <span role="img" aria-label="ladybug">🐞</span>
                            Grading Debug Report
                        </CardTitle>
                        <CardDescription>
                            This is a dry run report for a single pending bet from the <strong>`/api/debug-grading`</strong> route. No data was actually changed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs bg-slate-900 p-4 rounded-md overflow-x-auto text-white max-h-[500px]">
                            {gradingDebugResponse}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {(isLoadingProps) && (
                 <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Fetching Today's Props...</h2>
                    <p className="text-muted-foreground">This may take a moment.</p>
                </div>
            )}
            
            {error && !loading &&(
                 <Card className="bg-destructive/20 border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Fetching Props</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error}</p>
                    </CardContent>
                </Card>
            )}
            
            {!isLoadingProps && !loading && games.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">No player props available. Click "Sync Player Props" to fetch tomorrow's lines.</p>
                    </CardContent>
                </Card>
            )}

            {!isLoadingProps && !loading && games.length > 0 && (
                <div className="space-y-6">
                    {games.map(game => (
                        <GameCard key={game.gameId} game={game} />
                    ))}
                </div>
            )}
        </div>
    )
}
