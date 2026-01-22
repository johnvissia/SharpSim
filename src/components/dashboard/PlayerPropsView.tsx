'use client';

import { useMemo } from 'react';
import type { Game, Player, PlayerProp } from '@/lib/types';
import { useBetSlip } from '@/context/BetSlipContext';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ShieldAlert, User } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

// Helper to group props by player
const groupPropsByPlayer = (props: PlayerProp[]): Map<string, PlayerProp[]> => {
    return props.reduce((acc, prop) => {
        const key = prop.playerName;
        if (!acc.has(key)) {
            acc.set(key, []);
        }
        acc.get(key)!.push(prop);
        return acc;
    }, new Map<string, PlayerProp[]>());
};

const OddsButton = ({
  onClick,
  children,
  isSelected = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  isSelected?: boolean;
}) => (
  <Button
    variant={isSelected ? "secondary" : "outline"}
    size="sm"
    className="w-full h-auto justify-between px-3"
    onClick={(e) => {
        e.stopPropagation();
        onClick();
    }}
  >
    {children}
  </Button>
);

const PlayerPropsAccordion = ({ propsByPlayer }: { propsByPlayer: Map<string, PlayerProp[]> }) => {
    const { addPick, picks } = useBetSlip();

    const handlePick = (prop: PlayerProp, overUnder: 'Over' | 'Under') => {
        const odds = overUnder === 'Over' ? prop.overOdds : prop.underOdds;
        const pickString = `${prop.playerName} ${overUnder} ${prop.line} ${prop.market.toUpperCase()}`;
        addPick({
            game: {} as Game, // Game object is on the context, but not needed here
            pick: pickString,
            odds,
            betType: 'player_prop',
            marketId: prop.propId,
            playerId: prop.playerId,
            market: prop.market,
            line: prop.line,
        });
    };

    const isPickSelected = (prop: PlayerProp, overUnder: 'Over' | 'Under') => {
      const pickId = `${prop.propId}-${overUnder}`;
      return picks.some(p => p.id === pickId);
    };

    if (propsByPlayer.size === 0) {
        return <p className="text-sm text-center text-muted-foreground py-4">No player props found for this team.</p>;
    }
    
    return (
        <Accordion type="multiple" className="w-full space-y-2">
            {Array.from(propsByPlayer.entries()).map(([playerName, props]) => (
                <AccordionItem value={playerName} key={playerName} className="border rounded-lg bg-card/50 overflow-hidden">
                     <AccordionTrigger className="px-4 py-3 text-base font-semibold hover:no-underline data-[state=open]:border-b">
                         <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground"/>
                            {playerName}
                         </div>
                     </AccordionTrigger>
                     <AccordionContent className="p-0">
                        <div>
                        {props.map(prop => (
                            <div key={prop.propId} className="grid grid-cols-3 items-center gap-2 px-4 py-3 border-b last:border-b-0">
                                <div className="col-span-1">
                                    <p className="font-medium capitalize">{prop.market.toUpperCase()}</p>
                                    <p className="text-sm text-primary font-semibold">{prop.line}</p>
                                </div>
                                <div className="col-span-2 grid grid-cols-2 gap-2">
                                    <OddsButton 
                                        onClick={() => handlePick(prop, 'Over')}
                                        isSelected={isPickSelected(prop, 'Over')}
                                    >
                                         <span>Over</span>
                                         <span className="font-semibold">{prop.overOdds > 0 ? `+${prop.overOdds}`: prop.overOdds}</span>
                                    </OddsButton>
                                    <OddsButton 
                                        onClick={() => handlePick(prop, 'Under')}
                                        isSelected={isPickSelected(prop, 'Under')}
                                    >
                                         <span>Under</span>
                                         <span className="font-semibold">{prop.underOdds > 0 ? `+${prop.underOdds}` : prop.underOdds}</span>
                                    </OddsButton>
                                </div>
                            </div>
                        ))}
                        </div>
                     </AccordionContent>
                </AccordionItem>
            ))}
         </Accordion>
    );
};

interface PlayerPropsViewProps {
  game: Game;
  rosters: { home: Player[], away: Player[] } | null;
  isLoadingRosters: boolean;
}

export function PlayerPropsView({ game, rosters, isLoadingRosters }: PlayerPropsViewProps) {
    const { homeTeamProps, awayTeamProps } = useMemo(() => {
        if (!game.playerProps || !rosters) {
            return { homeTeamProps: new Map(), awayTeamProps: new Map() };
        }
        
        const homePlayerIds = new Set(rosters.home.map(p => p.id));
        const awayPlayerIds = new Set(rosters.away.map(p => p.id));

        const homeProps = game.playerProps.filter(p => homePlayerIds.has(p.playerId));
        const awayProps = game.playerProps.filter(p => awayPlayerIds.has(p.playerId));

        return {
            homeTeamProps: groupPropsByPlayer(homeProps),
            awayTeamProps: groupPropsByPlayer(awayProps)
        };
    }, [game.playerProps, rosters]);

    if (isLoadingRosters) {
        return (
            <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-1/3 mt-4" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }
    
    if (!game.playerProps || game.playerProps.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-4">
                <ShieldAlert className="h-10 w-10 text-accent" />
                <p className="font-semibold">Player Props Data Not Available</p>
                <p className="text-sm">Props for this game may not be loaded yet. Try syncing props on the dashboard.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6 py-4">
            <div>
                <h3 className="text-lg font-bold mb-3">{game.awayTeam.name} Props</h3>
                <PlayerPropsAccordion propsByPlayer={awayTeamProps} />
            </div>
             <div>
                <h3 className="text-lg font-bold mb-3">{game.homeTeam.name} Props</h3>
                <PlayerPropsAccordion propsByPlayer={homeTeamProps} />
            </div>
        </div>
    );
}
