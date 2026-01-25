'use client';

import { useState } from 'react';
import type { Game, UserProfile } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Heart, Loader2, User, Star, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { sportIconMap } from '@/lib/team-logos';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import { MainLinesView } from './MainLinesView';
import { GameLeadersView } from './GameLeadersView';
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

interface PlayerProp {
  playerId: string;
  playerName: string;
  market: string;
  line: number;
  overOdds: number;
  underOdds: number;
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
                    {team.rank && <span className="font-bold mr-2 text-muted-foreground">#{team.rank}</span>}
                    {team.name}
                </h2>
                <p className="text-xs text-muted-foreground">View Team Trends &rarr;</p>
            </Link>
        </div>
    )
}

const PlayerPropsView = ({ game }: { game: Game }) => {
  const [props, setProps] = useState<PlayerProp[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUsage, setApiUsage] = useState<{ used: string | null; remaining: string | null }>({ used: null, remaining: null });
  const { addPick, picks } = useBetSlip();
  const { toast } = useToast();

  const loadPlayerProps = async () => {
    if (loaded || loading) return;

    if (!game.oddsApiId) {
      setError('No odds data available for this game');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/fetch-game-props?eventId=${game.oddsApiId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch player props');
      }

      if (data.props && data.props.length > 0) {
        setProps(data.props);
        setLoaded(true);
        
        if (data.apiUsage) {
          setApiUsage(data.apiUsage);
        }

        toast({
          title: 'Player Props Loaded',
          description: `Found ${data.props.length} props${data.apiUsage?.remaining ? ` • ${data.apiUsage.remaining} API calls remaining` : ''}`,
        });
      } else {
        setError('No player props available for this game');
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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
    if (!pickInSlip) {
        return false;
    }
    return pickInSlip.pick.toLowerCase().includes(side);
  };

  // Group props by market type
  const marketPropsMap = new Map<string, PlayerProp[]>();
  props.forEach(prop => {
    if (!marketPropsMap.has(prop.market)) {
      marketPropsMap.set(prop.market, []);
    }
    marketPropsMap.get(prop.market)!.push(prop);
  });

  // Sort players within each market alphabetically
  marketPropsMap.forEach(marketProps => {
    marketProps.sort((a, b) => a.playerName.localeCompare(b.playerName));
  });

  const markets = Array.from(marketPropsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-4">
      {!loaded && !loading && (
        <div className="text-center py-12">
          <Button onClick={loadPlayerProps} size="lg" className="gap-2">
            <span>Load Player Props</span>
            <span className="text-xs text-muted-foreground">(Uses 1 API call)</span>
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-semibold">Fetching player props...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
          </div>
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-semibold">{error}</p>
          <Button onClick={loadPlayerProps} variant="outline" size="sm" className="mt-4">
            Try Again
          </Button>
        </div>
      )}

      {loaded && props.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No player props available for this game</p>
        </div>
      )}

      {loaded && markets.length > 0 && (
        <>
          {apiUsage.remaining && (
            <div className="text-xs text-muted-foreground text-right px-2 mb-2">
              📊 API calls remaining: {apiUsage.remaining}
            </div>
          )}
          <div className="space-y-2">
            {markets.map(([marketType, marketProps]) => {
              // Format market name nicely
              const marketName = marketType
                .replace(/_/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

              return (
                <details key={marketType} className="group bg-slate-900 rounded-lg overflow-hidden">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors select-none">
                    <div className="flex items-center gap-3">
                      <svg 
                        className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-bold text-base">{marketName}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {marketProps.length} players
                    </Badge>
                  </summary>
                  <div className="px-4 pb-3 pt-1 space-y-2">
                    {marketProps.map((prop, idx) => (
                      <div
                        key={`${prop.playerId}_${prop.market}_${prop.line}_${idx}`}
                        className="grid grid-cols-[200px_1fr] md:grid-cols-[250px_1fr] items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{prop.playerName}</p>
                            <p className="text-primary font-bold text-xl">{prop.line}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={isInSlip(prop, 'over') ? 'secondary' : 'outline'}
                            onClick={() => handlePick(prop, 'over')}
                            className="flex flex-col items-center justify-center p-2 h-auto gap-0.5"
                          >
                            <span className="font-medium text-xs">Over</span>
                            <span className="font-bold text-base">
                              {prop.overOdds > 0 ? `+${prop.overOdds}` : prop.overOdds}
                            </span>
                          </Button>
                          <Button
                            variant={isInSlip(prop, 'under') ? 'secondary' : 'outline'}
                            onClick={() => handlePick(prop, 'under')}
                            className="flex flex-col items-center justify-center p-2 h-auto gap-0.5"
                          >
                            <span className="font-medium text-xs">Under</span>
                            <span className="font-bold text-base">
                              {prop.underOdds > 0 ? `+${prop.underOdds}` : prop.underOdds}
                            </span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </>
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
  
  // Only show player props tab for NBA games that can bet
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
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="lines">Game Lines</TabsTrigger>
                        <TabsTrigger value="props">Player Props</TabsTrigger>
                        </TabsList>
                        <TabsContent value="lines">
                        <MainLinesView game={game} />
                        </TabsContent>
                        <TabsContent value="props">
                        <PlayerPropsView game={game} />
                        </TabsContent>
                    </Tabs>
                    ) : (
                    <MainLinesView game={game} />
                    )
                ) : (
                    <GameLeadersView game={game} />
                )}
            </div>
        </DialogContent>
    </Dialog>
  );
}
