'use client';

import type { UserBet, ParlayLeg } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Clock, MinusCircle } from 'lucide-react';
import { useMemo } from 'react';

const getBetStatusBadge = (status: UserBet['status']) => {
  if (status === 'pending') return <Badge variant="secondary">Pending</Badge>;
  if (status === 'won') return <Badge className="bg-green-500 text-white hover:bg-green-500/90">Won</Badge>;
  if (status === 'lost') return <Badge variant="destructive">Lost</Badge>;
  if (status === 'push') return <Badge>Push</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

const LegProgressBadge = ({ legs }: { legs: ParlayLeg[] }) => {
    const totalLegs = legs.length;
    const wonLegs = legs.filter(leg => leg.status === 'won').length;

    const isPerfect = wonLegs === totalLegs;
    const isHeartbreaker = wonLegs === totalLegs - 1 && totalLegs > 1;

    let badgeClass = "bg-secondary text-secondary-foreground hover:bg-secondary/80"; // Gray/Neutral

    if (isPerfect && totalLegs > 0) {
        badgeClass = "bg-yellow-400 text-black hover:bg-yellow-400/80"; // Gold
    } else if (isHeartbreaker) {
        badgeClass = "bg-orange-500 text-white hover:bg-orange-500/80"; // Orange
    }

    return (
        <Badge className={cn("border-transparent", badgeClass)}>
            {wonLegs}/{totalLegs} Hit
        </Badge>
    );
};


export function BetTicket({ bet }: { bet: UserBet }) {
  const isParlay = bet.betType === 'parlay';

  // Create a unified list of legs to render. For single bets, it's an array with one item.
  const legs = useMemo((): ParlayLeg[] => {
    if (isParlay && bet.legs) {
      return bet.legs;
    }
    // For single bets, create a synthetic leg.
    return [
      {
        gameId: bet.gameId,
        matchup: bet.matchup || 'N/A',
        commenceTime: bet.commenceTime || new Date().toISOString(),
        pick: bet.pick,
        // Cast is safe here because if it's not a parlay, it's one of the other bet types.
        betType: bet.betType as 'moneyline' | 'spread' | 'total' | 'player_prop',
        odds: bet.odds,
        status: bet.status,
        sport: bet.sport,
      },
    ];
  }, [bet, isParlay]);

  const ticketLabel = isParlay ? bet.pick : 'Single Bet';

  return (
    <Card className={cn(
      "ticket transition-colors",
      { 'bg-green-100 dark:bg-green-500/10': bet.status === 'won' },
      { 'bg-red-100/50 dark:bg-red-500/10': bet.status === 'lost' }
    )}>
      <CardContent className="!p-0">
        <div className="p-4 space-y-4">
          {legs.map((leg, index) => {
            const getLegIconDetails = (status: ParlayLeg['status']) => {
              switch (status) {
                case 'won':
                  return { Icon: CheckCircle2, color: 'text-green-500' };
                case 'lost':
                  return { Icon: XCircle, color: 'text-red-500' };
                case 'push':
                  return { Icon: MinusCircle, color: 'text-gray-500' };
                default: // pending
                  return { Icon: Clock, color: 'text-muted-foreground' };
              }
            };

            const { Icon, color: iconColor } = getLegIconDetails(leg.status);
            const gameDate = new Date(leg.commenceTime);
            const gameTime = gameDate.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

            return (
              <div key={index}>
                <div className="flex justify-between items-center text-sm">
                  <p className="font-bold truncate pr-2">{leg.matchup}</p>
                  <p className="font-mono font-semibold">{leg.odds > 0 ? `+${leg.odds}` : leg.odds}</p>
                </div>
                <p className="text-xs text-muted-foreground">{gameTime}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
                  <div>
                    <p className="font-semibold">{leg.pick}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{leg.betType}</p>
                  </div>
                </div>
                {index < legs.length - 1 && <Separator className="my-3" />}
              </div>
            );
          })}
        </div>
        <div className="border-t-2 border-dashed border-border/50 mx-4" />
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center font-bold text-base">
            <p>{ticketLabel}</p>
            <div className="flex items-center gap-4">
              <p className="font-mono">{bet.odds > 0 ? `+${bet.odds}`: bet.odds}</p>
              <div className="flex items-center gap-2">
                {isParlay && bet.status !== 'pending' && <LegProgressBadge legs={legs} />}
                {getBetStatusBadge(bet.status)}
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground font-mono">
            <p>Risk: <span className="font-semibold text-foreground">{bet.stake.toFixed(2)} coins</span></p>
            <p>Payout: <span className="font-semibold text-green-600">
                {(
                    bet.status === 'lost' ? 0 :
                    bet.status === 'push' ? bet.stake :
                    bet.potentialWinnings
                ).toFixed(2)} coins
            </span></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
