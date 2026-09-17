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

  // The odds for the ticket are locked in when the bet is placed and stored in the `bet` object.
  // This `useMemo` ensures we are always using the original odds from the database.
  const ticketOdds = useMemo(() => bet.odds, [bet.odds]);

  // Create a unified list of legs to render. For single bets, this creates a synthetic leg.
  // The odds for each leg are the ones snapshotted at placement time.
  const legs = useMemo((): ParlayLeg[] => {
    if (isParlay && bet.legs) {
      return bet.legs;
    }
    // For single bets, create a synthetic leg using the locked-in bet data.
    return [
      {
        gameId: bet.gameId,
        matchup: bet.matchup || 'N/A',
        commenceTime: bet.commenceTime || new Date().toISOString(),
        pick: bet.pick,
        betType: bet.betType as 'moneyline' | 'spread' | 'total' | 'player_prop',
        odds: bet.odds, // The odds for this single leg are the overall ticket odds.
        status: bet.status,
        sport: bet.sport,
        playerId: bet.playerId,
        playerName: bet.playerName,
        market: bet.market,
        line: bet.line,
      },
    ];
  }, [bet, isParlay]);

  const ticketLabel = isParlay ? bet.pick : 'Single Bet';

  const toWinLabel = useMemo(() => {
    switch (bet.status) {
      case 'won':
        return 'Payout';
      case 'lost':
        return 'Payout';
      case 'push':
        return 'Refund';
      case 'pending':
      default:
        return 'To Win';
    }
  }, [bet.status]);

  const toWinAmount = useMemo(() => {
    switch (bet.status) {
      case 'won':
        return bet.potentialWinnings;
      case 'lost':
        return 0;
      case 'push':
        return bet.stake;
      case 'pending':
        return bet.potentialWinnings;
      default:
        return 0;
    }
  }, [bet.status, bet.potentialWinnings, bet.stake]);

  return (
    <Card className={cn(
      "relative overflow-hidden transition-colors border-slate-800 bg-slate-900/90 shadow-xl rounded-2xl",
      { 'bg-green-500/10 border-green-500/30': bet.status === 'won' },
      { 'bg-red-500/10 border-red-500/30': bet.status === 'lost' }
    )}>
      <CardContent className="!p-0">
        <div className="p-5 space-y-3">
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
            const gameTime = gameDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            return (
              <div key={index}>
                <div className="flex items-start gap-3">
                  <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconColor)} />
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-base font-black truncate pr-2 leading-tight uppercase tracking-tight text-white">{leg.pick}</p>
                      <p className="font-mono tabular-nums text-sm font-black text-white pl-2">
                        {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                      </p>
                    </div>
                    <div className="flex items-center gap-x-1.5 flex-wrap text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                      <span className="truncate max-w-[140px]">{leg.matchup}</span>
                      <span className="text-slate-700">•</span>
                      <span>{gameTime}</span>
                    </div>
                  </div>
                </div>
                {index < legs.length - 1 && <Separator className="my-3 bg-slate-800/50" />}
              </div>
            );
          })}
        </div>

        {/* Ticket Perforation & Notch Circles */}
        <div className="relative py-1">
          <div className="border-t border-dashed border-slate-700/60 mx-6" />
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-950 border-r border-slate-800/40" />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-950 border-l border-slate-800/40" />
        </div>

        <div className="p-5 bg-slate-950/40">
          <div className="flex justify-between items-center font-black text-sm uppercase tracking-wider text-slate-400">
            <p>{ticketLabel}</p>
            <div className="flex items-center gap-3">
              <p className="font-black font-mono tabular-nums text-slate-200">{ticketOdds > 0 ? `+${ticketOdds}` : ticketOdds}</p>
              <div className="flex items-center gap-2">
                {isParlay && bet.status !== 'pending' && <LegProgressBadge legs={legs} />}
                {getBetStatusBadge(bet.status)}
              </div>
            </div>
          </div>
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-800/50">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">Risk</span>
              <span className="text-base font-black text-white font-mono tabular-nums drop-shadow-sm">${bet.stake.toFixed(2)}</span>
            </div>

            <div className="text-right flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">{toWinLabel}</span>
              <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.2)] font-mono tabular-nums italic">
                ${toWinAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
