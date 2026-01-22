'use client';

import { useMemo } from 'react';
import type { Game, PlayerProp } from '@/lib/types';
import { useBetSlip } from '@/context/BetSlipContext';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function PlayerPropsView({ game }: { game: Game }) {
    const { addPick, picks } = useBetSlip();

    const handlePick = (prop: PlayerProp, overUnder: 'Over' | 'Under') => {
        const odds = overUnder === 'Over' ? prop.overOdds : prop.underOdds;
        const pickString = `${prop.playerName} ${overUnder} ${prop.line} ${prop.market.toUpperCase()}`;
        
        // The marketId is the same for both over and under of a single prop
        const marketId = prop.propId; 
        
        addPick({
            game,
            pick: pickString,
            odds,
            betType: 'player_prop',
            marketId: marketId
        });
    };

    const isPickSelected = (prop: PlayerProp, overUnder: 'Over' | 'Under') => {
      const pickString = `${prop.playerName} ${overUnder} ${prop.line} ${prop.market.toUpperCase()}`;
      const pickId = `${prop.propId}-${pickString.replace(/\s/g, '')}`;
      return picks.some(p => p.id === pickId);
    };

    const playerPropsByPlayer = useMemo(() => {
        if (!game.playerProps) return new Map();
        return groupPropsByPlayer(game.playerProps);
    }, [game.playerProps]);

    if (!game.playerProps || game.playerProps.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-4">
                <ShieldAlert className="h-10 w-10 text-accent" />
                <p className="font-semibold">Player Props Data Not Available</p>
                <p className="text-sm">Props for this game may not be loaded yet. Try syncing odds on the dashboard.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4 py-4">
             <Accordion type="multiple" className="w-full space-y-2">
                {Array.from(playerPropsByPlayer.entries()).map(([playerName, props]) => (
                    <AccordionItem value={playerName} key={playerName} className="border rounded-lg bg-card overflow-hidden">
                         <AccordionTrigger className="px-4 py-3 text-base font-semibold hover:no-underline data-[state=open]:border-b">
                             {playerName}
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
        </div>
    );
}
