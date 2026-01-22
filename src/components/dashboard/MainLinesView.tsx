'use client';

import type { Game } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useBetSlip } from '@/context/BetSlipContext';
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
    className="w-full h-auto flex-col p-2 justify-center"
    onClick={(e) => {
        e.stopPropagation();
        onClick(e);
    }}
    disabled={disabled}
  >
    {children}
  </Button>
);

export function MainLinesView({ game }: { game: Game }) {
  const { addPick, picks } = useBetSlip();
  const { odds, homeTeam, awayTeam, sport, statusState } = game;
  const canBet = statusState === 'pre';

  if (!odds) {
      return (
          <div className="text-center text-muted-foreground py-8">
              Odds for this game are not available.
          </div>
      );
  }

  const handlePick = (
    pick: string,
    pickOdds: number,
    betType: 'moneyline' | 'spread' | 'total'
  ) => {
    addPick({ 
        game, 
        pick, 
        odds: pickOdds, 
        betType,
        marketId: `${game.id}-${betType}` // Market is game-level for main lines
    });
  };

  const isPickInSlip = (betType: 'moneyline' | 'spread' | 'total', pick: string) => {
    const marketId = `${game.id}-${betType}`;
    const pickId = `${marketId}-${pick.replace(/\s/g, '')}`;
    return picks.some(p => p.id === pickId);
  };
  
  const homeSpreadPoints = odds.spread?.points ?? 0;
  const awaySpreadPoints = -homeSpreadPoints;

  const AwayIcon = sportIconMap[sport] || sportIconMap.Default;
  const HomeIcon = sportIconMap[sport] || sportIconMap.Default;

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-4 items-center text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider px-2 py-1">
        <div className="col-span-1 text-left"></div>
        <div>Spread</div>
        <div>Total</div>
        <div>Moneyline</div>
      </div>

      {/* Away Team Row */}
      <div className="grid grid-cols-4 items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
        <div className="col-span-1 flex items-center gap-2 font-semibold text-sm">
          {awayTeam.logo ? (
            <Image src={awayTeam.logo} alt={awayTeam.name} width={24} height={24} className="h-6 w-6 object-contain" />
          ) : (
            <div className="w-6 h-6 flex items-center justify-center">
              <AwayIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <span>{awayTeam.name}</span>
        </div>
        <div className="text-center">
          {odds.spread ? (
            <OddsButton onClick={(e) => handlePick(`${awayTeam.name} ${awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}`, odds.spread.away, 'spread')} disabled={!canBet} isSelected={isPickInSlip('spread', `${awayTeam.name} ${awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}`)}>
              <span className="font-semibold text-primary">{awaySpreadPoints > 0 ? `+${awaySpreadPoints}` : awaySpreadPoints}</span>
              <span className="text-xs text-muted-foreground">{odds.spread.away > 0 ? `+${odds.spread.away}` : odds.spread.away}</span>
            </OddsButton>
          ) : (
            <div className="font-semibold">N/A</div>
          )}
        </div>
        <div className="text-center">
          {odds.total ? (
            <OddsButton onClick={(e) => handlePick(`Over ${odds.total.points}`, odds.total.over, 'total')} disabled={!canBet} isSelected={isPickInSlip('total', `Over ${odds.total.points}`)}>
              <span className="font-semibold text-primary">O {odds.total.points}</span>
              <span className="text-xs text-muted-foreground">{odds.total.over > 0 ? `+${odds.total.over}` : odds.total.over}</span>
            </OddsButton>
          ) : (
            <div className="font-semibold">N/A</div>
          )}
        </div>
        <div className="text-center">
          {odds.moneyline ? (
            <OddsButton onClick={(e) => handlePick(awayTeam.name, odds.moneyline.away, 'moneyline')} disabled={!canBet} isSelected={isPickInSlip('moneyline', awayTeam.name)}>
              <span className="font-semibold text-primary">{odds.moneyline.away > 0 ? `+${odds.moneyline.away}` : odds.moneyline.away}</span>
            </OddsButton>
          ) : (
             <div className="font-semibold">N/A</div>
          )}
        </div>
      </div>

      {/* Home Team Row */}
      <div className="grid grid-cols-4 items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
        <div className="col-span-1 flex items-center gap-2 font-semibold text-sm">
            {homeTeam.logo ? (
                <Image src={homeTeam.logo} alt={homeTeam.name} width={24} height={24} className="h-6 w-6 object-contain" />
            ) : (
                <div className="w-6 h-6 flex items-center justify-center">
                <HomeIcon className="w-5 h-5 text-muted-foreground" />
                </div>
            )}
            <span>{homeTeam.name}</span>
        </div>
        <div className="text-center">
          {odds.spread ? (
             <OddsButton onClick={(e) => handlePick(`${homeTeam.name} ${homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}`, odds.spread.home, 'spread')} disabled={!canBet} isSelected={isPickInSlip('spread', `${homeTeam.name} ${homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}`)}>
              <span className="font-semibold text-primary">{homeSpreadPoints > 0 ? `+${homeSpreadPoints}` : homeSpreadPoints}</span>
              <span className="text-xs text-muted-foreground">{odds.spread.home > 0 ? `+${odds.spread.home}` : odds.spread.home}</span>
            </OddsButton>
          ) : (
             <div className="font-semibold">N/A</div>
          )}
        </div>
        <div className="text-center">
          {odds.total ? (
             <OddsButton onClick={(e) => handlePick(`Under ${odds.total.points}`, odds.total.under, 'total')} disabled={!canBet} isSelected={isPickInSlip('total', `Under ${odds.total.points}`)}>
              <span className="font-semibold text-primary">U {odds.total.points}</span>
              <span className="text-xs text-muted-foreground">{odds.total.under > 0 ? `+${odds.total.under}` : odds.total.under}</span>
            </OddsButton>
          ) : (
            <div className="font-semibold">N/A</div>
          )}
        </div>
        <div className="text-center">
          {odds.moneyline ? (
            <OddsButton onClick={(e) => handlePick(homeTeam.name, odds.moneyline.home, 'moneyline')} disabled={!canBet} isSelected={isPickInSlip('moneyline', homeTeam.name)}>
              <span className="font-semibold text-primary">{odds.moneyline.home > 0 ? `+${odds.moneyline.home}` : odds.moneyline.home}</span>
            </OddsButton>
          ) : (
            <div className="font-semibold">N/A</div>
          )}
        </div>
      </div>
    </div>
  );
}
