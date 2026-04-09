'use client';
import React from 'react';
import type { Game, Team, SportName } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Ticket, User } from 'lucide-react';
import { useBetSlip, type BetSlipPick } from '@/context/BetSlipContext';
import { sportIconMap } from '@/lib/team-logos';
import Image from 'next/image';


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
    className="w-full h-auto min-h-[3.5rem] flex flex-col items-center justify-center p-1 text-sm leading-tight"
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
);

const TeamDisplay = ({ team, sport, score }: { team: Team, sport: SportName, score?: number | null }) => {
    const FallbackIcon = sportIconMap[sport] || sportIconMap.Default;
    return (
        <div className="flex flex-col w-full pb-1">
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-3 text-sm font-semibold">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                        {team.logo ? (
                            <Image
                                src={team.logo}
                                alt={team.name}
                                width={32}
                                height={32}
                                className="w-8 h-8 object-contain"
                            />
                        ) : (
                            <FallbackIcon className="w-6 h-6 text-muted-foreground" />
                        )}
                    </div>

                    <span className="truncate">{team.name}</span>
                </div>
                 {typeof score === 'number' && !isNaN(score) && (
                    <span className="text-3xl font-bold tracking-tight">{score}</span>
                )}
            </div>
            
            {sport === 'MLB' && team.startingPitcher && (
                <div className="pl-11 flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                    <span className="font-bold text-slate-300 truncate">{team.startingPitcher.name}</span>
                    <span className="text-slate-500">({team.startingPitcher.wins}-{team.startingPitcher.losses}, {team.startingPitcher.era} ERA)</span>
                </div>
            )}
        </div>
    );
};

const LiveLeaders = ({ team }: { team: Team }) => (
    <div className="space-y-2 text-xs text-muted-foreground">
        {team.leadingScorer && (
            <div className="flex items-center gap-1.5 truncate" title={`Points Leader: ${team.leadingScorer}`}>
                <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{team.leadingScorer}</span>
            </div>
        )}
        {team.leadingAssister && (
            <div className="flex items-center gap-1.5 truncate" title={`Assists Leader: ${team.leadingAssister}`}>
                <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{team.leadingAssister}</span>
            </div>
        )}
    </div>
);


export function GameCard({ game, onGameClick, hasActiveBet }: { game: Game, onGameClick: (game: Game) => void, hasActiveBet: boolean }) {
  const { picks, addPick } = useBetSlip();

  const isLive = game.statusState === 'in';
  const isFinal = game.statusState === 'post';
  const canBet = game.statusState === 'pre';

  const isPickInSlip = (betType: BetSlipPick['betType'], pick: string) => {
    const marketId = `${game.id}-${betType}`;
    // This logic must exactly match the ID generation in BetSlipContext
    const pickId = `${marketId}-${pick.replace(/\s/g, '')}`;
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
    addPick({ 
      pick, 
      odds, 
      betType, 
      game, 
      marketId: `${game.id}-${betType}` 
    });
  };
  
  const { odds, liveScore } = game;
  const homeSpreadPoints = odds?.spread?.points ?? 0;
  const awaySpreadPoints = -homeSpreadPoints;
  
  return (
      <Card 
        className="shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer p-4 bg-card"
        onClick={() => onGameClick(game)}
      >
        <div className="flex items-center gap-4">
          {/* Left Side: Teams, Scores & Status */}
          <div className="flex-grow space-y-3">
              <TeamDisplay team={game.awayTeam} sport={game.sport} score={(isLive || isFinal) ? liveScore?.away : undefined} />
              <TeamDisplay team={game.homeTeam} sport={game.sport} score={(isLive || isFinal) ? liveScore?.home : undefined} />
              <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-2">
                      <span>{gameTimeOrStatus}</span>
                      {isLive && (
                          <Badge variant="destructive" className="animate-pulse text-xs">
                              LIVE
                          </Badge>
                      )}
                  </div>
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

          {/* Right Side: Odds or Leaders */}
          {canBet && odds ? (
            <div className="flex-none grid grid-cols-3 gap-2 text-xs md:text-sm w-1/2 lg:w-2/5">
                {/* Spread Column */}
                <div className="flex flex-col gap-2">
                    <div className="text-center font-semibold text-xs text-muted-foreground">Spread</div>
                    <OddsButton 
                        onClick={(e) => handleBetSelection(e, `${game.awayTeam.name} ${awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}`, odds.spread.away, 'spread')} 
                        disabled={!canBet}
                        isSelected={isPickInSlip('spread', `${game.awayTeam.name} ${awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}`)}
                    >
                        <span className="font-semibold text-primary">{awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}</span>
                        <span className="text-xs text-muted-foreground">{odds.spread.away > 0 ? `+${odds.spread.away}` : odds.spread.away}</span>
                    </OddsButton>
                    <OddsButton 
                        onClick={(e) => handleBetSelection(e, `${game.homeTeam.name} ${homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}`, odds.spread.home, 'spread')} 
                        disabled={!canBet}
                        isSelected={isPickInSlip('spread', `${game.homeTeam.name} ${homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}`)}
                    >
                        <span className="font-semibold text-primary">{homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}</span>
                        <span className="text-xs text-muted-foreground">{odds.spread.home > 0 ? `+${odds.spread.home}` : odds.spread.home}</span>
                    </OddsButton>
                </div>

                {/* Total Column */}
                <div className="flex flex-col gap-2">
                    <div className="text-center font-semibold text-xs text-muted-foreground">Total</div>
                    <OddsButton 
                        onClick={(e) => handleBetSelection(e, `Over ${odds.total.points}`, odds.total.over, 'total')} 
                        disabled={!canBet}
                        isSelected={isPickInSlip('total', `Over ${odds.total.points}`)}
                    >
                       <span className="font-semibold text-primary">O {odds.total.points}</span>
                       <span className="text-xs text-muted-foreground">{odds.total.over > 0 ? `+${odds.total.over}` : odds.total.over}</span>
                    </OddsButton>
                    <OddsButton 
                        onClick={(e) => handleBetSelection(e, `Under ${odds.total.points}`, odds.total.under, 'total')} 
                        disabled={!canBet}
                        isSelected={isPickInSlip('total', `Under ${odds.total.points}`)}
                    >
                        <span className="font-semibold text-primary">U {odds.total.points}</span>
                        <span className="text-xs text-muted-foreground">{odds.total.under > 0 ? `+${odds.total.under}` : odds.total.under}</span>
                    </OddsButton>
                </div>

                {/* Moneyline Column */}
                <div className="flex flex-col gap-2">
                    <div className="text-center font-semibold text-xs text-muted-foreground">Moneyline</div>
                    <OddsButton 
                        onClick={(e) => handleBetSelection(e, game.awayTeam.name, odds.moneyline.away, 'moneyline')} 
                        disabled={!canBet}
                        isSelected={isPickInSlip('moneyline', game.awayTeam.name)}
                    >
                        <span className="font-semibold text-primary">{odds.moneyline.away > 0 ? `+${odds.moneyline.away}` : odds.moneyline.away}</span>
                    </OddsButton>
                    <OddsButton 
                        onClick={(e) => handleBetSelection(e, game.homeTeam.name, odds.moneyline.home, 'moneyline')} 
                        disabled={!canBet}
                        isSelected={isPickInSlip('moneyline', game.homeTeam.name)}
                    >
                        <span className="font-semibold text-primary">{odds.moneyline.home > 0 ? `+${odds.moneyline.home}` : odds.moneyline.home}</span>
                    </OddsButton>
                </div>
            </div>
            ) : (isLive || isFinal) ? (
            <div className="flex-none grid grid-cols-2 gap-4 text-xs w-1/2 lg:w-2/5">
                <LiveLeaders team={game.awayTeam} />
                <LiveLeaders team={game.homeTeam} />
            </div>
          ) : null}
        </div>
      </Card>
  );
}
