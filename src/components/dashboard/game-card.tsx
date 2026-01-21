'use client';

import type { Game, Team } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Ticket } from 'lucide-react';
import Image from 'next/image';
import { sportIconMap } from '@/lib/team-logos';
import { useBetSlip, type BetSlipPick } from '@/context/BetSlipContext';

const OddsButton = ({
  onClick,
  children,
  disabled = false,
  isSelected = false,
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  disabled?: boolean;
  isSelected?: boolean;
}) => (
  <Button
    variant={isSelected ? "secondary" : "outline"}
    className="w-full h-auto flex-col p-2 justify-center text-xs md:text-sm"
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
);

const TeamInfo = ({ team, sport }: { team: Team, sport: Game['sport'] }) => {
  const FallbackIcon = sportIconMap[sport] || sportIconMap.Default;
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      {team.logo ? (
        <Image
          src={team.logo}
          alt={`${team.name} logo`}
          width={24}
          height={24}
          className="h-6 w-6 object-contain"
        />
      ) : (
        <div className="w-6 h-6 flex items-center justify-center bg-muted rounded-full">
          <FallbackIcon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <span className="truncate">{team.name}</span>
      {team.rank && <span className="font-bold text-muted-foreground ml-auto">#{team.rank}</span>}
    </div>
  );
};


export function GameCard({ game, onGameClick, hasActiveBet }: { game: Game, onGameClick: (game: Game) => void, hasActiveBet: boolean }) {
  const { picks, addPick } = useBetSlip();

  const isLive = game.statusState === 'in';
  const isFinal = game.statusState === 'post';
  const canBet = game.statusState === 'pre';

  const isPickInSlip = (betType: BetSlipPick['betType'], pick: string) => {
    // This logic must exactly match the ID generation in BetSlipContext
    const pickId = `${game.id}-${betType}-${pick.replace(/\s/g, '')}`;
    return picks.some(p => p.id === pickId);
  };

  const gameDate = new Date(game.startTime);
  const now = new Date();
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

  const handleBetSelection = (
    e: React.MouseEvent,
    pick: string,
    odds: number,
    betType: 'moneyline' | 'spread' | 'total'
  ) => {
    e.stopPropagation();
    addPick({ pick, odds, betType, game });
  };
  
  const { odds } = game;
  const homeSpreadPoints = odds?.spread?.points ?? 0;
  const awaySpreadPoints = -homeSpreadPoints;
  
  return (
      <Card 
        className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer p-3 space-y-2 bg-card"
        onClick={() => onGameClick(game)}
      >
        <div className="flex justify-between items-center text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
                <span>{gameTimeOrStatus}</span>
                 {isLive && (
                    <Badge variant="destructive" className="animate-pulse text-xs">
                        LIVE
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-2">
                {hasActiveBet && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Ticket className="h-5 w-5 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>You have a pending bet on this game.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
            </div>
        </div>

        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-x-2 text-xs md:text-sm">
            <div className="text-left font-semibold text-xs text-muted-foreground">{game.sport}</div>
            <div className="text-center font-semibold text-xs text-muted-foreground">Spread</div>
            <div className="text-center font-semibold text-xs text-muted-foreground">Total</div>
            <div className="text-center font-semibold text-xs text-muted-foreground">Moneyline</div>

            <TeamInfo team={game.awayTeam} sport={game.sport} />
            
            {odds?.spread ? (
              <OddsButton 
                onClick={(e) => handleBetSelection(e, `${game.awayTeam.name} ${awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}`, odds.spread.away, 'spread')} 
                disabled={!canBet}
                isSelected={isPickInSlip('spread', `${game.awayTeam.name} ${awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}`)}
              >
                <span className="font-semibold text-primary">{awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}</span>
                <span className="text-xs text-muted-foreground">{odds.spread.away > 0 ? `+${odds.spread.away}` : odds.spread.away}</span>
              </OddsButton>
            ) : <div />}

            {odds?.total ? (
              <OddsButton 
                onClick={(e) => handleBetSelection(e, `Over ${odds.total.points}`, odds.total.over, 'total')} 
                disabled={!canBet}
                isSelected={isPickInSlip('total', `Over ${odds.total.points}`)}
              >
                <span className="font-semibold text-primary">O {odds.total.points}</span>
                <span className="text-xs text-muted-foreground">{odds.total.over > 0 ? `+${odds.total.over}` : odds.total.over}</span>
              </OddsButton>
            ) : <div />}
            
            {odds?.moneyline ? (
                <OddsButton 
                    onClick={(e) => handleBetSelection(e, game.awayTeam.name, odds.moneyline.away, 'moneyline')} 
                    disabled={!canBet}
                    isSelected={isPickInSlip('moneyline', game.awayTeam.name)}
                >
                    <span className="font-semibold text-primary">{odds.moneyline.away > 0 ? `+${odds.moneyline.away}` : odds.moneyline.away}</span>
                </OddsButton>
            ) : <div />}

            <TeamInfo team={game.homeTeam} sport={game.sport} />

            {odds?.spread ? (
             <OddsButton 
                onClick={(e) => handleBetSelection(e, `${game.homeTeam.name} ${homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}`, odds.spread.home, 'spread')} 
                disabled={!canBet}
                isSelected={isPickInSlip('spread', `${game.homeTeam.name} ${homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}`)}
             >
              <span className="font-semibold text-primary">{homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}</span>
              <span className="text-xs text-muted-foreground">{odds.spread.home > 0 ? `+${odds.spread.home}` : odds.spread.home}</span>
            </OddsButton>
            ) : <div />}

            {odds?.total ? (
             <OddsButton 
                onClick={(e) => handleBetSelection(e, `Under ${odds.total.points}`, odds.total.under, 'total')} 
                disabled={!canBet}
                isSelected={isPickInSlip('total', `Under ${odds.total.points}`)}
             >
              <span className="font-semibold text-primary">U {odds.total.points}</span>
              <span className="text-xs text-muted-foreground">{odds.total.under > 0 ? `+${odds.total.under}` : odds.total.under}</span>
            </OddsButton>
            ) : <div />}

            {odds?.moneyline ? (
                <OddsButton 
                    onClick={(e) => handleBetSelection(e, game.homeTeam.name, odds.moneyline.home, 'moneyline')} 
                    disabled={!canBet}
                    isSelected={isPickInSlip('moneyline', game.homeTeam.name)}
                >
                    <span className="font-semibold text-primary">{odds.moneyline.home > 0 ? `+${odds.moneyline.home}` : odds.moneyline.home}</span>
                </OddsButton>
            ) : <div />}
        </div>
      </Card>
  );
}
