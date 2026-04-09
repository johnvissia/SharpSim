'use client';

import { useState, useMemo } from 'react';
import type { Game, UserProfile, PlayerProp } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Loader2, User, ChevronDown, WandSparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { sportIconMap } from '@/lib/team-logos';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import { MainLinesView } from './MainLinesView';
import { GameLeadersView } from './GameLeadersView';
import { ModelCalculationView } from './ModelCalculationView';
import { MLBLiveGameTracker } from './MLBLiveGameTracker';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBetSlip } from '@/context/BetSlipContext';
import { useToast } from '@/hooks/use-toast';

interface GameDetailModalProps {
    game: Game | null;
    isOpen: boolean;
    onClose: () => void;
}

const TeamHeader = ({ team, sport, isFavorite, onToggleFavorite, isUpdating }: {
    team: Game['homeTeam'],
    sport: Game['sport'],
    isFavorite: boolean,
    onToggleFavorite: () => void,
    isUpdating: boolean
}) => {
    const FallbackIcon = sportIconMap[sport] || sportIconMap.Default;
    return (
        <div className="flex flex-col items-center text-center gap-2 w-48">
            <Button variant="ghost" size="icon" onClick={onToggleFavorite} disabled={isUpdating} className="h-8 w-8 mb-2">
                <Heart className={cn(
                    "h-7 w-7 transition-all",
                    isFavorite ? 'text-red-500 fill-red-500' : 'text-muted-foreground hover:text-red-400'
                )} />
            </Button>
            <Link href={`/stats/${sport}/${team.name}?teamId=${team.id}`} className="flex flex-col items-center text-center gap-2 p-2 rounded-lg hover:bg-accent/10 transition-colors">
                {team.logo ? (
                    <Image
                        src={team.logo}
                        alt={`${team.name} logo`}
                        width={80}
                        height={80}
                        className="object-contain h-20 w-20"
                    />
                ) : (
                    <div className="w-20 h-20 flex items-center justify-center bg-muted rounded-full">
                        <FallbackIcon className="w-10 h-10 text-muted-foreground" />
                    </div>
                )}
                <h2 className="text-2xl font-bold h-16 flex items-center justify-center">
                    {team.name}
                </h2>
                <p className="text-xs text-muted-foreground">View Team Trends &rarr;</p>
            </Link>
        </div>
    )
};

const PlayerLines = ({ playerName, props, game }: { playerName: string; props: PlayerProp[]; game: Game }) => {
    const { addPick, picks } = useBetSlip();
    const [isOpen, setIsOpen] = useState(false);

    if (props.length === 0) return null;

    const sortedProps = [...props].sort((a, b) => a.line - b.line);
    const mainLine = sortedProps[Math.floor(sortedProps.length / 2)];
    const alternateLines = sortedProps.filter(p => p.id !== mainLine.id);

    const handlePick = (prop: PlayerProp, side: 'over' | 'under') => {
        const pickString = `${side.charAt(0).toUpperCase() + side.slice(1)} ${prop.line}`;
        const pickOdds = side === 'over' ? prop.overOdds : prop.underOdds;

        addPick({
            game,
            pick: `${prop.playerName} ${prop.market.toUpperCase()} - ${pickString}`,
            odds: pickOdds,
            betType: 'player_prop',
            marketId: `${game.id}_${prop.playerId}_${prop.market}_${prop.line}`,
            playerId: prop.playerId,
            market: prop.market,
            line: prop.line,
        });
    };

    const isInSlip = (prop: PlayerProp, side: 'over' | 'under') => {
        const marketId = `${game.id}_${prop.playerId}_${prop.market}_${prop.line}`;
        const pickInSlip = picks.find(p => p.marketId === marketId);
        if (!pickInSlip) return false;
        return pickInSlip.pick.toLowerCase().includes(side);
    };

    return (
        <div className="bg-slate-800/50 rounded-lg overflow-hidden transition-all duration-300">
            <div
                className="grid grid-cols-[200px_1fr] md:grid-cols-[250px_1fr] items-center gap-3 p-3 cursor-pointer hover:bg-slate-700/50"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{playerName}</p>
                        <p className="text-brand-500 font-bold text-xl">{mainLine.line}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant={isInSlip(mainLine, 'over') ? 'secondary' : 'outline'}
                        onClick={(e) => { e.stopPropagation(); handlePick(mainLine, 'over'); }}
                        className="flex flex-col items-center justify-center p-2 h-auto gap-0.5"
                    >
                        <span className="font-medium text-xs">Over</span>
                        <span className="font-bold text-base">{mainLine.overOdds > 0 ? `+${mainLine.overOdds}` : mainLine.overOdds}</span>
                    </Button>
                    <Button
                        variant={isInSlip(mainLine, 'under') ? 'secondary' : 'outline'}
                        onClick={(e) => { e.stopPropagation(); handlePick(mainLine, 'under'); }}
                        className="flex flex-col items-center justify-center p-2 h-auto gap-0.5"
                    >
                        <span className="font-medium text-xs">Under</span>
                        <span className="font-bold text-base">{mainLine.underOdds > 0 ? `+${mainLine.underOdds}` : mainLine.underOdds}</span>
                    </Button>
                </div>
            </div>

            {isOpen && alternateLines.length > 0 && (
                <div className="px-3 pb-3 space-y-2">
                    <div className="pt-2 border-t border-slate-700/50">
                        {alternateLines.map(prop => (
                            <div key={`${prop.playerId}-${prop.line}`} className="grid grid-cols-[200px_1fr] md:grid-cols-[250px_1fr] items-center gap-3 py-2">
                                <div className="flex items-center gap-2">
                                    <div className="min-w-0 pl-6">
                                        <p className="text-brand-500 font-bold text-lg">{prop.line}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button size="sm" variant={isInSlip(prop, 'over') ? 'secondary' : 'outline'} onClick={() => handlePick(prop, 'over')} className="justify-between">
                                        <span>Over</span>
                                        <span>{prop.overOdds > 0 ? `+${prop.overOdds}` : prop.overOdds}</span>
                                    </Button>
                                    <Button size="sm" variant={isInSlip(prop, 'under') ? 'secondary' : 'outline'} onClick={() => handlePick(prop, 'under')} className="justify-between">
                                        <span>Under</span>
                                        <span>{prop.underOdds > 0 ? `+${prop.underOdds}` : prop.underOdds}</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const PlayerPropsView = ({ game }: { game: Game }) => {
    const [playerProps, setPlayerProps] = useState<PlayerProp[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleFetchProps = async () => {
        if (!game.oddsApiId) {
            const msg = "This game does not have the required ID to fetch props.";
            setError(msg);
            toast({ title: "Error", description: msg, variant: "destructive" });
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/fetch-game-props?eventId=${game.oddsApiId}`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || data.error || "Failed to fetch props from the API.");
            }

            setPlayerProps(data.props);

            if (data.props.length === 0) {
                toast({ title: "No Props Available", description: "Props for this game may not have been released yet." });
            } else {
                toast({ title: "Success", description: `Loaded ${data.count} player props.` });
            }

        } catch (e: any) {
            setError(e.message);
            toast({ title: "Fetch Failed", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const marketPropsMap = useMemo(() => {
        const map = new Map<string, PlayerProp[]>();
        if (!playerProps) return map;
        playerProps.forEach(prop => {
            if (!map.has(prop.market)) {
                map.set(prop.market, []);
            }
            map.get(prop.market)!.push(prop);
        });
        return map;
    }, [playerProps]);

    const markets = useMemo(() => Array.from(marketPropsMap.entries()).sort((a, b) => a[0].localeCompare(b[0])), [marketPropsMap]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 text-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
                <h2 className="text-xl font-semibold text-foreground">Fetching Player Props...</h2>
                <p className="text-muted-foreground">This may take a moment.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-destructive flex flex-col items-center gap-4">
                <p>Error fetching props:</p>
                <p className="text-sm mt-1">{error}</p>
                <Button onClick={handleFetchProps} className="mt-4">Try Again</Button>
            </div>
        )
    }

    if (!playerProps) {
        return (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-4">
                <p>Player props are not loaded for this game.</p>
                <Button onClick={handleFetchProps} size="lg">
                    <WandSparkles className="mr-2 h-5 w-5" />
                    Load Player Props
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {markets.length > 0 ? (
                <div className="space-y-2">
                    {markets.map(([marketType, marketProps]) => {
                        const marketName = marketType.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                        const playersInMarket = new Map<string, { playerName: string; props: PlayerProp[] }>();
                        marketProps.forEach(prop => {
                            if (!playersInMarket.has(prop.playerId)) {
                                playersInMarket.set(prop.playerId, { playerName: prop.playerName, props: [] });
                            }
                            playersInMarket.get(prop.playerId)!.props.push(prop);
                        });
                        const sortedPlayers = Array.from(playersInMarket.values()).sort((a, b) => a.playerName.localeCompare(b.playerName));

                        return (
                            <details key={marketType} className="group bg-slate-900 rounded-lg overflow-hidden">
                                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors select-none">
                                    <div className="flex items-center gap-3">
                                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                                        <span className="font-bold text-base">{marketName}</span>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">{sortedPlayers.length} players</Badge>
                                </summary>
                                <div className="px-4 pb-3 pt-1 space-y-2">
                                    {sortedPlayers.map(playerData => (
                                        <PlayerLines
                                            key={playerData.playerName}
                                            playerName={playerData.playerName}
                                            props={playerData.props}
                                            game={game}
                                        />
                                    ))}
                                </div>
                            </details>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No player props are currently available for this game.</p>
                </div>
            )}
        </div>
    );
};

export function GameDetailModal({ game, isOpen, onClose }: GameDetailModalProps) {
    const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
    const { user } = useUser();
    const firestore = useFirestore();

    const userProfileRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const favoriteTeams = userProfile?.favoriteTeams || [];

    const handleToggleFavorite = async (teamName: string) => {
        if (!userProfileRef) return;
        setIsUpdatingFavorite(true);
        const isCurrentlyFavorite = favoriteTeams.includes(teamName);
        try {
            await updateDoc(userProfileRef, {
                favoriteTeams: isCurrentlyFavorite ? arrayRemove(teamName) : arrayUnion(teamName),
            });
        } catch (error) {
            console.error("Failed to update favorites:", error);
        } finally {
            setIsUpdatingFavorite(false);
        }
    };

    if (!game) return null;

    const gameDate = new Date(game.startTime);
    const now = new Date();

    const isLive = game.statusState === 'in';
    const isFinal = game.statusState === 'post';
    const canBet = game.statusState === 'pre';

    const isToday =
        now.getFullYear() === gameDate.getFullYear() &&
        now.getMonth() === gameDate.getMonth() &&
        now.getDate() === gameDate.getDate();

    const gameTimeOrStatus = isLive || isFinal
        ? game.statusDetail
        : isToday
            ? gameDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : gameDate.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });

    const showPlayerProps = game.sport === 'NBA' && canBet;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="sr-only">
                        Game Details: {game.awayTeam.name} vs {game.homeTeam.name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        View betting lines, player props, and game information for this matchup.
                    </DialogDescription>
                    <div className="flex items-start justify-around pt-8">
                        <TeamHeader
                            team={game.awayTeam}
                            sport={game.sport}
                            isFavorite={favoriteTeams.includes(game.awayTeam.name)}
                            onToggleFavorite={() => handleToggleFavorite(game.awayTeam.name)}
                            isUpdating={isUpdatingFavorite}
                        />
                        <div className="flex flex-col items-center self-center text-center pt-10">
                            <span className="text-4xl font-bold text-muted-foreground">VS</span>
                            <div className="text-sm text-muted-foreground mt-2">{gameTimeOrStatus}</div>
                            {isLive && (
                                <Badge className="bg-red-600 hover:bg-red-600 text-white animate-pulse text-xs mt-2">
                                    LIVE
                                </Badge>
                            )}
                        </div>
                        <TeamHeader
                            team={game.homeTeam}
                            sport={game.sport}
                            isFavorite={favoriteTeams.includes(game.homeTeam.name)}
                            onToggleFavorite={() => handleToggleFavorite(game.homeTeam.name)}
                            isUpdating={isUpdatingFavorite}
                        />
                    </div>
                </DialogHeader>

                <div className="px-6 pb-6 overflow-y-auto">
                    {canBet ? (
                        showPlayerProps ? (
                            <Tabs defaultValue="lines" className="w-full">
                                <TabsList className="grid w-full grid-cols-3 mb-4">
                                    <TabsTrigger value="lines">Game Lines</TabsTrigger>
                                    <TabsTrigger value="props">Player Props</TabsTrigger>
                                    <TabsTrigger value="model">Model Calc</TabsTrigger>
                                </TabsList>
                                <TabsContent value="lines">
                                    <MainLinesView game={game} />
                                </TabsContent>
                                <TabsContent value="props">
                                    <PlayerPropsView game={game} />
                                </TabsContent>
                                <TabsContent value="model">
                                    <ModelCalculationView game={game} />
                                </TabsContent>
                            </Tabs>
                        ) : (
                            game.sport === 'MLB' ? (
                                <Tabs defaultValue="lines" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 mb-4">
                                        <TabsTrigger value="lines">Game Lines</TabsTrigger>
                                        <TabsTrigger value="analysis">Matchup Analysis</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="lines">
                                        <MainLinesView game={game} />
                                    </TabsContent>
                                    <TabsContent value="analysis">
                                        <MLBLiveGameTracker game={game} />
                                    </TabsContent>
                                </Tabs>
                            ) : (
                                <MainLinesView game={game} />
                            )
                        )
                    ) : (
                        <div className="space-y-6">
                            {game.sport === 'MLB' ? (
                                <MLBLiveGameTracker game={game} />
                            ) : (
                                <>
                                    <Card className="bg-slate-900 border-slate-800">
                                        <CardHeader><CardTitle>Model Retroactive Analysis</CardTitle></CardHeader>
                                        <CardContent><ModelCalculationView game={game} /></CardContent>
                                    </Card>
                                    <GameLeadersView game={game} />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
