'use client';

import { useState, useMemo } from 'react';
import type { PlayerProp } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { User, Loader2, RefreshCw, AlertCircle, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useBetSlip } from '@/context/BetSlipContext';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface UIMarketProp {
    propId: string;
    playerName: string;
    playerId: string;
    line: number;
    overOdds: number;
    underOdds: number;
}

interface UIMarket {
    marketKey: string;
    marketName: string;
    props: UIMarketProp[];
}

interface UIGame {
    gameId: string;
    matchup: string;
    gameTime: string;
    sport: 'NBA' | 'MLB';
    markets: UIMarket[];
}

const MARKET_NAMES: Record<string, string> = {
    // MLB
    pitcher_strikeouts: 'Pitcher Strikeouts',
    pitcher_record_a_win: 'Pitcher Record a Win',
    batter_hits: 'Batter Hits',
    batter_runs: 'Batter Runs',
    batter_home_runs: 'Batter Home Runs',
    batter_rbis: 'Batter RBIs',
    batter_strikeouts: 'Batter Strikeouts',
    batter_walks: 'Batter Walks',
    batter_total_bases: 'Batter Total Bases',
    batter_hits_runs_rbis: 'Batter Hits + Runs + RBIs',
    
    // NBA
    player_points: 'Player Points',
    player_rebounds: 'Player Rebounds',
    player_assists: 'Player Assists',
    player_threes: 'Player Threes',
    player_blocks: 'Player Blocks',
    player_steals: 'Player Steals',
    player_turnovers: 'Player Turnovers',
    player_points_rebounds_assists: 'Player Points + Rebounds + Assists',
    player_blocks_steals: 'Player Blocks + Steals'
};

const getMarketDisplayName = (marketKey: string) => {
    if (MARKET_NAMES[marketKey]) return MARKET_NAMES[marketKey];
    return marketKey
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const getMarketIcon = (marketKey: string) => {
    // MLB Specific
    if (marketKey === 'pitcher_strikeouts') return '⚾ K';
    if (marketKey === 'batter_strikeouts') return '⚾ K';
    if (marketKey === 'batter_home_runs') return '🚀 ⚾';
    if (marketKey === 'batter_total_bases') return '💎'; // Diamond basepath
    
    // Generic / Fallbacks
    if (marketKey.includes('strikeout')) return '⚾ K';
    if (marketKey.includes('home_run')) return '🚀 ⚾';
    if (marketKey.includes('bases')) return '💎';
    if (marketKey.includes('hit')) return '⚡ ⚾';
    if (marketKey.includes('run') || marketKey.includes('rbi')) return '🏃';
    
    // NBA Specific
    if (marketKey.includes('point')) return '🏀';
    if (marketKey.includes('rebound')) return '🛡️';
    if (marketKey.includes('assist')) return '🤝';
    if (marketKey.includes('three')) return '🎯';
    return '📈';
};

const SportBadge = ({ sport }: { sport: 'NBA' | 'MLB' }) => {
    if (sport === 'NBA') {
        return (
            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-black tracking-wider uppercase text-[10px] rounded-md px-2 py-0.5">
                🏀 NBA
            </Badge>
        );
    }
    return (
        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black tracking-wider uppercase text-[10px] rounded-md px-2 py-0.5">
            ⚾ MLB
        </Badge>
    );
};

const PlayerPropRow = ({ prop, game, marketName }: { prop: UIMarketProp, game: UIGame, marketName: string }) => {
    const { addPick, picks } = useBetSlip();

    const handlePick = (pickType: 'over' | 'under') => {
        const teams = game.matchup.includes(' @ ') ? game.matchup.split(' @ ') : game.matchup.split(' vs ');
        const awayName = teams[0] || 'Away';
        const homeName = teams[1] || 'Home';

        const gameForSlip = {
            id: game.gameId,
            sport: game.sport,
            startTime: game.gameTime,
            homeTeam: { id: '', name: homeName, logo: '', players: []},
            awayTeam: { id: '', name: awayName, logo: '', players: []},
        };

        const odds = pickType === 'over' ? prop.overOdds : prop.underOdds;
        const pickString = `${pickType.charAt(0).toUpperCase() + pickType.slice(1)} ${prop.line}`;

        addPick({
            game: gameForSlip,
            pick: `${prop.playerName} - ${pickString} (${marketName})`,
            odds: odds,
            betType: 'player_prop',
            marketId: `${prop.propId}`, 
            playerId: prop.playerId,
            market: marketName,
            line: prop.line,
        });
    };

    const getSelectedPickType = () => {
        const found = picks.find(p => p.marketId === prop.propId);
        if (!found) return null;
        return found.pick.includes('Over') ? 'over' : 'under';
    };

    const formatOdds = (odds: number) => {
        return odds > 0 ? `+${odds}` : `${odds}`;
    };

    const activeSelection = getSelectedPickType();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 py-3 px-4 rounded-xl bg-slate-950/60 border border-slate-900/60 hover:border-slate-800/80 transition-all">
            <div className="sm:col-span-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                    <img 
                        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(prop.playerName)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`} 
                        alt={prop.playerName} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-200">{prop.playerName}</p>
                </div>
            </div>
            <div className="sm:col-span-2 text-center sm:text-right pr-4">
                <p className="text-xs font-black uppercase text-slate-500 tracking-wider">Line</p>
                <p className="text-base font-black text-indigo-400 font-mono leading-none mt-0.5">{prop.line}</p>
            </div>
            <div className="sm:col-span-4 grid grid-cols-2 gap-2">
                 <Button 
                    variant="outline"
                    onClick={() => handlePick('over')}
                    className={`flex justify-between items-center px-3 py-2 h-9 rounded-lg border font-bold text-xs transition-all ${
                        activeSelection === 'over' 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-lg shadow-indigo-500/10' 
                        : 'bg-slate-900/80 hover:bg-slate-900 text-slate-300 border-slate-800/80 hover:border-slate-700'
                    }`}
                 >
                    <span className="uppercase tracking-wide font-black">Over</span>
                    <span className="font-mono text-xs">{formatOdds(prop.overOdds)}</span>
                 </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePick('under')}
                    className={`flex justify-between items-center px-3 py-2 h-9 rounded-lg border font-bold text-xs transition-all ${
                        activeSelection === 'under' 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-lg shadow-indigo-500/10' 
                        : 'bg-slate-900/80 hover:bg-slate-900 text-slate-300 border-slate-800/80 hover:border-slate-700'
                    }`}
                 >
                    <span className="uppercase tracking-wide font-black">Under</span>
                    <span className="font-mono text-xs">{formatOdds(prop.underOdds)}</span>
                 </Button>
            </div>
        </div>
    );
};

const MarketAccordion = ({ market, game }: { market: UIMarket, game: UIGame }) => {
    return (
        <AccordionItem value={market.marketKey} className="border border-slate-800/60 bg-slate-900/10 rounded-xl overflow-hidden mb-3">
            <AccordionTrigger className="text-sm font-bold hover:no-underline rounded-xl px-5 py-3.5 bg-slate-900/40 hover:bg-slate-900/80 transition-all flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-base">{getMarketIcon(market.marketKey)}</span>
                    <span className="text-slate-200 font-bold tracking-tight">{market.marketName}</span>
                </div>
                <Badge variant="secondary" className="bg-slate-800 text-slate-400 border border-slate-700/50 text-[10px] uppercase font-bold tracking-wider rounded-md px-2 py-0.5">
                    {market.props.length} {market.props.length === 1 ? 'Player' : 'Players'}
                </Badge>
            </AccordionTrigger>
            <AccordionContent className="p-4 space-y-2 bg-slate-950/20 border-t border-slate-900">
                {market.props.map(prop => (
                    <PlayerPropRow key={prop.propId} prop={prop} game={game} marketName={market.marketName} />
                ))}
            </AccordionContent>
        </AccordionItem>
    );
};

const GameAccordion = ({ game }: { game: UIGame }) => {
    const formattedDate = new Date(game.gameTime).toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    });

    return (
        <AccordionItem value={game.gameId} className="border border-slate-800/80 bg-slate-900/20 backdrop-blur-md rounded-2xl overflow-hidden mb-4 shadow-xl hover:border-slate-700/80 transition-all duration-300">
            <AccordionTrigger className="hover:no-underline px-6 py-5 bg-slate-900/50 hover:bg-slate-900/80 transition-all flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap text-left">
                    <div className="space-y-1">
                        <h3 className="text-lg font-black tracking-tight text-white uppercase italic">{game.matchup}</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{formattedDate}</p>
                    </div>
                    <SportBadge sport={game.sport} />
                </div>
                <div className="flex items-center gap-3 pr-2">
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md">
                        {game.markets.length} {game.markets.length === 1 ? 'Market' : 'Markets'}
                    </Badge>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 sm:p-6 border-t border-slate-800/60 bg-slate-950/40">
                {game.markets.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No active markets found for this game.</p>
                ) : (
                    <Accordion type="multiple" className="w-full">
                        {game.markets.map(market => (
                            <MarketAccordion key={market.marketKey} market={market} game={game} />
                        ))}
                    </Accordion>
                )}
            </AccordionContent>
        </AccordionItem>
    );
};

export default function PropHubPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const firestore = useFirestore();

    const [selectedSport, setSelectedSport] = useState<'ALL' | 'NBA' | 'MLB'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const propsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'player_props'), orderBy('commenceTime'));
    }, [firestore]);

    const { data: playerProps, isLoading: isLoadingProps } = useCollection<PlayerProp>(propsQuery);

    const games = useMemo(() => {
        if (!playerProps) return [];
        
        const gamesMap = new Map<string, {
            gameId: string;
            matchup: string;
            gameTime: string;
            sport: 'NBA' | 'MLB';
            markets: Map<string, UIMarket>;
        }>();

        playerProps.forEach(prop => {
            const propSport = (prop.sport as 'NBA' | 'MLB') || 'NBA';
            if (!gamesMap.has(prop.gameId)) {
                gamesMap.set(prop.gameId, {
                    gameId: prop.gameId,
                    matchup: prop.matchup,
                    gameTime: prop.commenceTime,
                    sport: propSport,
                    markets: new Map()
                });
            }
            const game = gamesMap.get(prop.gameId)!;

            const marketKey = prop.marketKey || prop.market;
            const marketName = getMarketDisplayName(marketKey);

            if (!game.markets.has(marketKey)) {
                game.markets.set(marketKey, {
                    marketKey,
                    marketName,
                    props: []
                });
            }
            const market = game.markets.get(marketKey)!;

            const pId = prop.playerId || prop.playerName.replace(/\s+/g, '_');
            market.props.push({
                propId: prop.id,
                playerName: prop.playerName,
                playerId: pId,
                line: prop.line,
                overOdds: prop.overOdds,
                underOdds: prop.underOdds
            });
        });

        return Array.from(gamesMap.values()).map(game => {
            const marketsArray = Array.from(game.markets.values()).map(market => {
                const sortedProps = [...market.props].sort((a, b) => 
                    a.playerName.localeCompare(b.playerName)
                );
                return {
                    ...market,
                    props: sortedProps
                };
            });

            const marketPriority = [
                'pitcher_strikeouts',
                'batter_hits',
                'player_points',
                'player_rebounds',
                'player_assists'
            ];
            
            const sortedMarkets = [...marketsArray].sort((a, b) => {
                const indexA = marketPriority.indexOf(a.marketKey);
                const indexB = marketPriority.indexOf(b.marketKey);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.marketName.localeCompare(b.marketName);
            });

            return {
                ...game,
                markets: sortedMarkets
            };
        });

    }, [playerProps]);

    const filteredGames = useMemo(() => {
        let result = games;
        
        // Filter by sport
        if (selectedSport !== 'ALL') {
            result = result.filter(g => g.sport === selectedSport);
        }
        
        // Filter by search query (checks matchup, market name, and player names)
        if (searchQuery.trim() !== '') {
            const queryLower = searchQuery.toLowerCase();
            result = result
                .map(g => {
                    // If the game matchup name matches the query, we keep the game with all its markets
                    if (g.matchup.toLowerCase().includes(queryLower)) {
                        return g;
                    }

                    // Otherwise, we filter the markets within the game
                    const filteredMarkets = g.markets
                        .map(m => {
                            // If the market name matches the query, we keep the market with all its players
                            if (m.marketName.toLowerCase().includes(queryLower)) {
                                return m;
                            }

                            // Otherwise, we filter the players (props) inside the market
                            const filteredProps = m.props.filter(p => 
                                p.playerName.toLowerCase().includes(queryLower)
                            );

                            return {
                                ...m,
                                props: filteredProps
                            };
                        })
                        .filter(m => m.props.length > 0);

                    return {
                        ...g,
                        markets: filteredMarkets
                    };
                })
                .filter(g => g.markets.length > 0);
        }
        
        return result;
    }, [games, selectedSport, searchQuery]);

    const handleSyncProps = async () => {
        setLoading(true);
        setError(null);
        try {
            const sportsToSync = selectedSport === 'ALL' ? ['NBA', 'MLB'] : [selectedSport];
            let totalSynced = 0;

            for (const s of sportsToSync) {
                toast({
                    title: `Syncing ${s} Player Props`,
                    description: `Fetching latest lines from the-odds-api...`
                });

                const response = await fetch(`/api/sync-player-props?sport=${s.toLowerCase()}`, { method: 'POST' });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || `Failed to sync ${s} props.`);
                }
                totalSynced += result.count || 0;
            }

            toast({
                title: 'Sync Complete',
                description: `Successfully synced a total of ${totalSynced} player props.`,
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

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-800/80">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-indigo-400" />
                    <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">
                        Player Prop Hub
                    </h1>
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  Add high-value Player Props to your bet slip directly from top sportsbooks.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                  <Button 
                    onClick={handleSyncProps} 
                    disabled={loading || isLoadingProps} 
                    size="lg"
                    className="w-full lg:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-xs px-6 py-5 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-95 transition-all"
                  >
                      {loading ? (
                          <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Syncing...
                          </>
                      ) : (
                          <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Sync Props
                          </>
                      )}
                  </Button>
              </div>
            </header>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 bg-slate-900/20 border border-slate-800/40 rounded-2xl backdrop-blur-md">
                <Tabs value={selectedSport} onValueChange={(v) => setSelectedSport(v as any)} className="w-full md:w-auto">
                    <TabsList className="bg-slate-950/80 p-1 border border-slate-900 rounded-xl w-full sm:w-auto">
                        <TabsTrigger 
                            value="ALL" 
                            className="text-xs uppercase font-black px-4 py-2 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
                        >
                            🌍 All Sports
                        </TabsTrigger>
                        <TabsTrigger 
                            value="NBA" 
                            className="text-xs uppercase font-black px-4 py-2 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
                        >
                            🏀 NBA
                        </TabsTrigger>
                        <TabsTrigger 
                            value="MLB" 
                            className="text-xs uppercase font-black px-4 py-2 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
                        >
                            ⚾ MLB
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                        type="text"
                        placeholder="Search player, matchup, or market..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-5 bg-slate-950/50 border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-slate-200 placeholder-slate-500 font-medium text-sm transition-all"
                    />
                </div>
            </div>

            {/* Loading Skeleton */}
            {isLoadingProps && (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(n => (
                        <Card key={n} className="border-slate-800 bg-slate-900/10 rounded-2xl overflow-hidden p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-6 w-48 bg-slate-800" />
                                <Skeleton className="h-5 w-16 bg-slate-800" />
                            </div>
                            <div className="space-y-2 pt-2">
                                <Skeleton className="h-10 w-full bg-slate-800" />
                                <Skeleton className="h-10 w-full bg-slate-800" />
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            
            {/* Error Message */}
            {error && !loading && (
                 <Card className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-start gap-4">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                        <h4 className="font-bold text-red-400">Sync Error</h4>
                        <p className="text-sm text-red-200/70">{error}</p>
                    </div>
                </Card>
            )}
            
            {/* No Active Props State */}
            {!isLoadingProps && !loading && filteredGames.length === 0 && (
                <Card className="border-slate-800/80 bg-slate-950/20 backdrop-blur-md rounded-2xl shadow-xl">
                    <CardContent className="p-12 text-center flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-2xl">
                            🔎
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-slate-300">No Player Props Available</h3>
                            <p className="text-sm text-slate-500 max-w-sm">
                                {searchQuery 
                                    ? "No matches found for your search query. Try typing another player, team, or prop market." 
                                    : "No player props are currently loaded in the database. Click \"Sync Props\" to fetch active lines."}
                            </p>
                        </div>
                        {!searchQuery && (
                            <Button 
                                onClick={handleSyncProps}
                                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-wider"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Sync Lines Now
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Games and Props Accordions */}
            {!isLoadingProps && !loading && filteredGames.length > 0 && (
                <Accordion type="multiple" className="w-full space-y-4">
                    {filteredGames.map(game => (
                        <GameAccordion key={game.gameId} game={game} />
                    ))}
                </Accordion>
            )}
        </div>
    );
}
