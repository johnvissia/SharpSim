'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useBetSlip } from '@/context/BetSlipContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { X, Ticket } from 'lucide-react';
import { calculateParlay } from '@/lib/parlay';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, writeBatch, increment } from 'firebase/firestore';
import type { UserBet, ParlayLeg } from '@/lib/types';
import { cn } from '@/lib/utils';

export function BetSlip() {
  const { picks, removePick, clearPicks } = useBetSlip();
  const [stake, setStake] = useState('');
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const slipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // On mount, position the slip at the bottom-right corner.
  useEffect(() => {
    if (slipRef.current) {
        const { innerWidth, innerHeight } = window;
        const { offsetWidth, offsetHeight } = slipRef.current;
        setPosition({
            x: innerWidth - offsetWidth - 20,
            y: innerHeight - offsetHeight - 20,
        });
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only allow dragging from the header, not on buttons inside it
    if ((e.target as HTMLElement).closest('button')) {
        return;
    }
    
    if (slipRef.current) {
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
        document.body.style.userSelect = 'none';
        e.preventDefault();
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && slipRef.current) {
        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;
        
        const { innerWidth, innerHeight } = window;
        const { offsetWidth, offsetHeight } = slipRef.current;
        
        newX = Math.max(0, Math.min(newX, innerWidth - offsetWidth));
        newY = Math.max(0, Math.min(newY, innerHeight - offsetHeight));

        setPosition({ x: newX, y: newY });
    }
  }, [isDragging, dragStart]);


  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.userSelect = '';
    if (slipRef.current) {
        const { innerWidth, innerHeight } = window;
        const { offsetWidth, offsetHeight } = slipRef.current;
        const margin = 20;

        const corners = [
            { x: margin, y: margin }, // Top-left
            { x: innerWidth - offsetWidth - margin, y: margin }, // Top-right
            { x: margin, y: innerHeight - offsetHeight - margin }, // Bottom-left
            { x: innerWidth - offsetWidth - margin, y: innerHeight - offsetHeight - margin } // Bottom-right
        ];

        let closestCorner = corners[0];
        let minDistance = Infinity;

        corners.forEach(corner => {
            const distance = Math.sqrt(Math.pow(position.x - corner.x, 2) + Math.pow(position.y - corner.y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestCorner = corner;
            }
        });
        
        setPosition(closestCorner);
    }
  }, [position.x, position.y]);

  useEffect(() => {
    if (isDragging) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp, { once: true });
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);


  const { potentialPayout, combinedOdds } = useMemo(() => {
    if (picks.length === 0 || !stake) {
      return { potentialPayout: 0, combinedOdds: 0 };
    }
    const stakeNum = parseFloat(stake);
    if (stakeNum <= 0) {
      return { potentialPayout: 0, combinedOdds: 0 };
    }

    if (picks.length === 1) {
        const odds = picks[0].odds;
        let profit = 0;
        if (odds > 0) {
            profit = stakeNum * (odds / 100);
        } else {
            profit = stakeNum / (Math.abs(odds) / 100);
        }
        return { potentialPayout: stakeNum + profit, combinedOdds: odds };
    }

    const oddsArray = picks.map(p => p.odds);
    const { potentialPayout, americanOdds } = calculateParlay(stakeNum, oddsArray);
    return { potentialPayout, combinedOdds: americanOdds };
  }, [picks, stake]);

  const handlePlaceBet = async () => {
    if (!user || !firestore || !stake) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in and enter a stake to place a bet.',
      });
      return;
    }
    
    const stakeNum = parseFloat(stake);
    if (stakeNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Stake',
        description: 'Please enter a wager amount greater than zero.',
      });
      return;
    }
    
    const userDocRef = doc(firestore, 'users', user.uid);
    const betsCollectionRef = collection(firestore, 'users', user.uid, 'bets');
    const batch = writeBatch(firestore);

    try {
      let newBet: Omit<UserBet, 'id'>;

      if (picks.length === 1) {
        const pick = picks[0];
        newBet = {
          gameId: pick.game.id,
          userId: user.uid,
          sport: pick.game.sport,
          betType: pick.betType,
          pick: pick.pick,
          matchup: `${pick.game.awayTeam.name} @ ${pick.game.homeTeam.name}`,
          commenceTime: pick.game.startTime,
          stake: stakeNum,
          odds: pick.odds,
          potentialWinnings: potentialPayout,
          status: 'pending',
          placedAt: new Date().toISOString(),
        };
      } else {
        const parlayLegs: ParlayLeg[] = picks.map(p => ({
            gameId: p.game.id,
            matchup: `${p.game.awayTeam.name} @ ${p.game.homeTeam.name}`,
            commenceTime: p.game.startTime,
            pick: p.pick,
            betType: p.betType,
            odds: p.odds,
            status: 'pending',
            sport: p.game.sport,
        }));

        newBet = {
          gameId: picks.map(p => p.game.id).join(','),
          userId: user.uid,
          sport: picks[0].game.sport, // Use first pick's sport for parlay
          betType: 'parlay',
          pick: `${picks.length}-Leg Parlay`,
          stake: stakeNum,
          odds: combinedOdds,
          potentialWinnings: potentialPayout,
          status: 'pending',
          placedAt: new Date().toISOString(),
          legs: parlayLegs,
        };
      }

      const newBetRef = doc(betsCollectionRef);
      batch.set(newBetRef, newBet);
      batch.update(userDocRef, { balance: increment(-stakeNum) });

      await batch.commit();

      toast({
        title: 'Bet Placed!',
        description: `You wagered ${stakeNum.toFixed(2)} coins. Good luck!`,
      });
      setStake('');
      clearPicks();
    } catch (error: any) {
        console.error('Failed to place bet:', error);
        toast({
            title: 'Bet Failed',
            description: error.message || 'Could not place bet. You may not have enough coins.',
            variant: 'destructive',
        });
    }
  };

  if (picks.length === 0) {
    return null; // Don't show the bet slip if it's empty
  }

  return (
    <Card
      ref={slipRef}
      className={cn(
        "fixed w-80 z-50",
        isDragging ? 'shadow-2xl cursor-grabbing' : 'shadow-lg'
      )}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transition: isDragging ? 'none' : 'top 0.3s ease-out, left 0.3s ease-out',
      }}
    >
      <CardHeader 
        className="flex flex-row items-center justify-between p-4 cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <CardTitle className="text-lg flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Bet Slip
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={clearPicks}>Clear All</Button>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {picks.map(pick => (
                <div key={pick.id} className="text-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-semibold">{pick.pick}</p>
                            <p className="text-xs text-muted-foreground">{pick.game.awayTeam.name} @ {pick.game.homeTeam.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <p className="font-bold">{pick.odds > 0 ? `+${pick.odds}` : pick.odds}</p>
                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePick(pick.id)}>
                                <X className="h-4 w-4" />
                             </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-4">
            {picks.length > 1 && (
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{picks.length}-Leg Parlay</span>
                    <span className="font-bold">{combinedOdds > 0 ? `+${combinedOdds}` : combinedOdds}</span>
                </div>
            )}
             <div className="space-y-2">
                <Label htmlFor="stake">Wager</Label>
                <Input 
                    id="stake" 
                    type="number" 
                    placeholder="0.00" 
                    value={stake} 
                    onChange={(e) => setStake(e.target.value)} 
                />
            </div>
            <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">To Win</span>
                <span className="font-bold text-green-600">{(potentialPayout - parseFloat(stake || '0')).toFixed(2)} coins</span>
            </div>
             <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-muted-foreground">Total Payout</span>
                <span className="text-green-500">{potentialPayout.toFixed(2)} coins</span>
            </div>
            <Button 
              className="w-full"
              disabled={!stake || parseFloat(stake) <= 0 || !user}
              onClick={handlePlaceBet}
            >
                Place Bet
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
