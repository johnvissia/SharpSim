'use client';

import { useState, useMemo } from 'react';
import { useBetSlip } from '@/context/BetSlipContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { X, Ticket } from 'lucide-react';
import { calculateParlay } from '@/lib/parlay';
import { useToast } from '@/hooks/use-toast';

export function BetSlip() {
  const { picks, removePick, clearPicks } = useBetSlip();
  const [stake, setStake] = useState('');
  const { toast } = useToast();

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

  const handlePlaceBet = () => {
    // This is where we would eventually write to Firestore
    toast({
      title: 'Bet Placed (Simulated)',
      description: `You wagered ${stake} coins. Good luck!`,
    });
    setStake('');
    clearPicks();
  };

  if (picks.length === 0) {
    return null; // Don't show the bet slip if it's empty
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-2xl z-50">
      <CardHeader className="flex flex-row items-center justify-between p-4">
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
                    <span className="text-muted-foreground">{picks.length}-Team Parlay</span>
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
                <span className="text-muted-foreground">Potential Payout</span>
                <span className="font-bold text-green-600">{potentialPayout.toFixed(2)} coins</span>
            </div>
            <Button 
              className="w-full"
              disabled={!stake || parseFloat(stake) <= 0}
              onClick={handlePlaceBet}
            >
                Place Bet
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
