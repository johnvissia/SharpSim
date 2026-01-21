'use client';

import { useState } from 'react';
import type { Game, UserProfile } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogClose, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { sportIconMap } from '@/lib/team-logos';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import { MainLinesView } from './MainLinesView';
import { PlayerPropsView } from './PlayerPropsView';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { cn } from '@/lib/utils';

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
                    {team.rank && <span className="font-bold mr-2 text-muted-foreground">#{team.rank}</span>}
                    {team.name}
                </h2>
                <p className="text-xs text-muted-foreground">View Team Trends &rarr;</p>
            </Link>
        </div>
    )
}

export function GameDetailModal({ game, isOpen, onClose }: GameDetailModalProps) {
  const [activeTab, setActiveTab] = useState('main-lines');
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
                 <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="absolute top-4 right-4">
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close</span>
                    </Button>
                </DialogClose>
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
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="main-lines">Main Lines</TabsTrigger>
                        <TabsTrigger value="player-props">Player Props</TabsTrigger>
                    </TabsList>
                    <TabsContent value="main-lines" className="mt-4">
                        <MainLinesView game={game} />
                    </TabsContent>
                    <TabsContent value="player-props" className="mt-4">
                        <PlayerPropsView game={game} />
                    </TabsContent>
                </Tabs>
            </div>
        </DialogContent>
    </Dialog>
  );
}
