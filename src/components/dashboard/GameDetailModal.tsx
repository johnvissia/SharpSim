'use client';

import { useState } from 'react';
import type { Game } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import Image from 'next/image';
import { sportIconMap } from '@/lib/team-logos';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';

interface GameDetailModalProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
}

const TeamHeader = ({ team, sport }: { team: Game['homeTeam'], sport: Game['sport']}) => {
    const FallbackIcon = sportIconMap[sport] || sportIconMap.Default;
    return (
        <div className="flex flex-col items-center text-center gap-4">
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
            <h2 className="text-2xl font-bold">
                {team.rank && <span className="font-bold mr-2 text-muted-foreground">#{team.rank}</span>}
                {team.name}
            </h2>
        </div>
    )
}

export function GameDetailModal({ game, isOpen, onClose }: GameDetailModalProps) {
  const [activeTab, setActiveTab] = useState('main-lines');

  if (!game) return null;

  const gameDate = new Date(game.startTime);
  const now = new Date();
  const isLive = now > gameDate;

  const isToday =
    now.getFullYear() === gameDate.getFullYear() &&
    now.getMonth() === gameDate.getMonth() &&
    now.getDate() === gameDate.getDate();

  const gameTime = isToday
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
                 <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="absolute top-4 right-4">
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close</span>
                    </Button>
                </DialogClose>
                <div className="flex items-center justify-around pt-8">
                    <TeamHeader team={game.awayTeam} sport={game.sport} />
                    <div className="flex flex-col items-center self-center text-center">
                        <span className="text-4xl font-bold text-muted-foreground">VS</span>
                         <div className="text-sm text-muted-foreground mt-2">{gameTime}</div>
                        {isLive && (
                            <Badge className="bg-red-600 hover:bg-red-600 text-white animate-pulse text-xs mt-2">
                                LIVE
                            </Badge>
                        )}
                    </div>
                    <TeamHeader team={game.homeTeam} sport={game.sport} />
                </div>
            </DialogHeader>

            <div className="px-6 pb-6 overflow-y-auto">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="main-lines">Main Lines</TabsTrigger>
                        <TabsTrigger value="player-props">Player Props</TabsTrigger>
                    </TabsList>
                    <TabsContent value="main-lines" className="mt-4">
                        <p className="text-center text-muted-foreground py-8">
                            Main lines content will go here.
                        </p>
                    </TabsContent>
                    <TabsContent value="player-props" className="mt-4">
                        <p className="text-center text-muted-foreground py-8">
                            Player props content will go here.
                        </p>
                    </TabsContent>
                </Tabs>
            </div>
        </DialogContent>
    </Dialog>
  );
}
