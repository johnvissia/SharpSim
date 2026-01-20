'use client';

import type { UserBet, ParlayLeg } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Clock, MinusCircle } from 'lucide-react';

const getBetStatusBadge = (status: UserBet['status']) => {
  if (status === 'pending') return <Badge variant="secondary">Pending</Badge>;
  if (status === 'won') return <Badge className="bg-green-500 text-white">Won</Badge>;
  if (status === 'lost') return <Badge variant="destructive">Lost</Badge>;
  if (status === 'push') return <Badge>Push</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

export function BetTicket({ bet }: { bet: UserBet }) {
  const isParlay = bet.betType === 'parlay';

  return (
    <Card className={cn(
      "ticket transition-colors",
      { 'bg-green-100 dark:bg-green-500/10': bet.status === 'won' },
      { 'bg-red-100/50 dark:bg-red-500/10': bet.status === 'lost' }
    )}>
      <CardContent className="!p-0">
        {isParlay && bet.legs ? (
          <>
            <div className="p-4 space-y-4">
              {bet.legs.map((leg, index) => {
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
                    {index < bet.legs.length - 1 && <Separator className="my-3" />}
                  </div>
                );
              })}
            </div>
            <div className="border-t-2 border-dashed border-border/50 mx-4" />
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center font-bold text-base">
                <p>{bet.pick}</p>
                <div className="flex items-center gap-4">
                  <p className="font-mono">{bet.odds > 0 ? `+${bet.odds}`: bet.odds}</p>
                  {getBetStatusBadge(bet.status)}
                </div>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground font-mono">
                <p>Risk: <span className="font-semibold text-foreground">{bet.stake.toFixed(2)} coins</span></p>
                <p>Payout: <span className="font-semibold text-green-600">{bet.potentialWinnings.toFixed(2)} coins</span></p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-start p-4">
              <div className="flex-grow">
                <p className="font-semibold text-lg">{bet.pick} <span className="font-mono text-muted-foreground font-normal">({bet.odds > 0 ? `+${bet.odds}`: bet.odds})</span></p>
                <p className="text-sm text-muted-foreground">{bet.matchup || 'Game details not available'}</p>
              </div>
              {getBetStatusBadge(bet.status)}
            </div>
            <div className="border-t-2 border-dashed border-border/50 mx-4" />
            <div className="flex justify-between items-center p-4 text-sm text-muted-foreground">
              <p className="font-mono">Stake: <span className="font-semibold text-foreground">{bet.stake.toFixed(2)} coins</span></p>
              <p className="font-mono">Payout: <span className="font-semibold text-green-600">{bet.potentialWinnings.toFixed(2)} coins</span></p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}