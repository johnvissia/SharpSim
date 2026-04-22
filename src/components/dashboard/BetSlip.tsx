'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useBetSlip } from '@/context/BetSlipContext';
import { useAppMode } from '@/context/AppModeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Ticket, BookOpen } from 'lucide-react';
import { calculateParlay } from '@/lib/parlay';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, writeBatch, increment } from 'firebase/firestore';
import type { UserBet, ParlayLeg, SportName } from '@/lib/types';
import { cn } from '@/lib/utils';

export function BetSlip() {
  const { picks, removePick, clearPicks, updatePickOdds } = useBetSlip();
  const { isRealMoneyMode } = useAppMode();
  const [stake, setStake] = useState('');
  const [sportsbook, setSportsbook] = useState('');
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

    if (picks.some(p =>
      (p.betType === 'player_prop' && !p.game.id) ||
      (p.betType !== 'player_prop' && !p.game.oddsApiId)
    )) {
      toast({
        variant: 'destructive',
        title: 'Bet Incomplete',
        description: 'One or more selections on your slip are missing a required game ID for grading. Try syncing game data.',
      });
      return;
    }

    const timeLimitMS = 15 * 60 * 1000;
    const now = new Date().getTime();

    // Check if any game starts in 15 minutes or less
    const invalidPick = picks.find(p => {
      if (!p.game.startTime) return false;
      const gameStart = new Date(p.game.startTime).getTime();
      return now >= gameStart - timeLimitMS;
    });

    if (invalidPick) {
      toast({
        variant: 'destructive',
        title: 'Bet Unavailable',
        description: `The game (${invalidPick.game.awayTeam?.name} @ ${invalidPick.game.homeTeam?.name}) starts in less than 15 minutes. Betting is frozen.`,
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

        let gameIdForGrading: string;
        if (pick.betType === 'player_prop') {
          // Player props are graded against ESPN stats, which use the ESPN game ID.
          gameIdForGrading = pick.game.id!;
        } else {
          // Game lines are graded against Odds API data, which uses the Odds API game ID.
          gameIdForGrading = pick.game.oddsApiId || pick.game.id!;
        }

        const baseBet: Omit<UserBet, 'id'> = {
          gameId: gameIdForGrading,
          userId: user.uid,
          sport: pick.game.sport as SportName,
          betType: pick.betType,
          pick: pick.pick,
          matchup: pick.game.homeTeam && pick.game.awayTeam ? `${pick.game.awayTeam.name} @ ${pick.game.homeTeam.name}` : pick.pick,
          commenceTime: pick.game.startTime,
          stake: stakeNum,
          odds: pick.odds,
          potentialWinnings: potentialPayout,
          status: 'pending' as const,
          placedAt: new Date().toISOString(),
          ...(isRealMoneyMode && sportsbook ? { sportsbook } : {}),
        };

        if (pick.betType === 'player_prop') {
          newBet = {
            ...baseBet,
            playerId: pick.playerId,
            market: pick.market,
            line: pick.line,
          };
        } else {
          newBet = baseBet;
        }

      } else { // Parlay
        const parlayLegs: ParlayLeg[] = picks.map(p => {

          let gameIdForGrading: string;
          if (p.betType === 'player_prop') {
            // Player props use ESPN game ID for grading
            gameIdForGrading = p.game.id!;
          } else {
            // Other bets use Odds API game ID
            gameIdForGrading = p.game.oddsApiId || p.game.id!;
          }

          const leg: Partial<ParlayLeg> = {
            gameId: gameIdForGrading,
            matchup: p.game.homeTeam && p.game.awayTeam ? `${p.game.awayTeam.name} @ ${p.game.homeTeam.name}` : p.pick,
            commenceTime: p.game.startTime,
            pick: p.pick,
            betType: p.betType,
            odds: p.odds,
            status: 'pending',
            sport: p.game.sport,
          };

          if (p.betType === 'player_prop') {
            leg.playerId = p.playerId;
            leg.market = p.market;
            leg.line = p.line;
          }

          return leg as ParlayLeg;
        });

        newBet = {
          gameId: picks.map(p => {
            if (p.betType === 'player_prop') {
              return p.game.id!;
            }
            return p.game.oddsApiId || p.game.id!;
          }).join(','),
          userId: user.uid,
          sport: picks[0].game.sport!,
          betType: 'parlay',
          pick: `${picks.length}-Leg Parlay`,
          stake: stakeNum,
          odds: combinedOdds,
          potentialWinnings: potentialPayout,
          status: 'pending',
          placedAt: new Date().toISOString(),
          legs: parlayLegs,
          ...(isRealMoneyMode && sportsbook ? { sportsbook } : {}),
        };
      }

      const newBetRef = doc(betsCollectionRef);
      batch.set(newBetRef, newBet);
      
      const userUpdate: any = { balance: increment(-stakeNum) };

      // Update preferences based on picks
      picks.forEach(p => {
        if (p.game.sport) {
          userUpdate[`preferences.sports.${p.game.sport}`] = increment(1);
        }
        if (p.betType) {
          userUpdate[`preferences.betTypes.${p.betType}`] = increment(1);
        }
        
        if (p.betType === 'player_prop') {
          // Extract player name from pick (e.g., "LeBron James Over 22.5 Points" -> "LeBron James")
          const playerNameMatch = p.pick.match(/^(.*?)\s+(Over|Under)/i);
          if (playerNameMatch && playerNameMatch[1]) {
            userUpdate[`preferences.players.${playerNameMatch[1].trim()}`] = increment(1);
          } else {
             userUpdate[`preferences.players.${p.pick}`] = increment(1);
          }
        } else {
          // Team bets
          if (p.game.homeTeam && p.pick.includes(p.game.homeTeam.name)) {
             userUpdate[`preferences.teams.${p.game.homeTeam.name}`] = increment(1);
             if (p.game.sport === 'NCAAM' && p.game.homeTeam.conference) {
               userUpdate[`preferences.conferences.${p.game.homeTeam.conference}`] = increment(1);
             }
          } else if (p.game.awayTeam && p.pick.includes(p.game.awayTeam.name)) {
             userUpdate[`preferences.teams.${p.game.awayTeam.name}`] = increment(1);
             if (p.game.sport === 'NCAAM' && p.game.awayTeam.conference) {
               userUpdate[`preferences.conferences.${p.game.awayTeam.conference}`] = increment(1);
             }
          }
        }
      });

      batch.update(userDocRef, userUpdate);

      await batch.commit();

      toast({
        title: 'Bet Placed!',
        description: `You wagered ${stakeNum.toFixed(2)} coins. Good luck!`,
      });
      setStake('');
      setSportsbook('');
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
        "fixed w-80 z-[90]",
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
                  <p className="text-xs text-muted-foreground">{pick.game.awayTeam?.name} @ {pick.game.homeTeam?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isRealMoneyMode ? (
                    <Input
                      type="number"
                      className="h-7 w-[76px] px-2 py-0 text-right font-bold text-sm bg-slate-900 border-slate-700/50 focus-visible:ring-1 focus-visible:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      defaultValue={pick.odds}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val !== 0) {
                          updatePickOdds(pick.id, val);
                        } else {
                          e.target.value = pick.odds.toString();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (!isNaN(val) && val !== 0) {
                            updatePickOdds(pick.id, val);
                            (e.target as HTMLInputElement).blur();
                          }
                        }
                      }}
                    />
                  ) : (
                    <p className="font-bold">{pick.odds > 0 ? `+${pick.odds}` : pick.odds}</p>
                  )}
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
          {isRealMoneyMode && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                Sportsbook
              </Label>
              <Select value={sportsbook} onValueChange={setSportsbook}>
                <SelectTrigger id="sportsbook" className="bg-slate-900 border-slate-700/50 focus:ring-1 focus:ring-emerald-500 text-sm">
                  <SelectValue placeholder="Select a sportsbook…" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  sideOffset={4} 
                  className="bg-slate-900 border-slate-700 max-h-[200px] overflow-y-auto z-[100]"
                >
                  {[
                    'bet365',
                    'BetMGM',
                    'BetRivers',
                    'Bovada',
                    'Caesars Sportsbook',
                    'DraftKings',
                    'ESPN Bet',
                    'Fanatics Sportsbook',
                    'FanDuel',
                    'Hard Rock Bet',
                    'MyBookie',
                    'PointsBet',
                  ].map(book => (
                    <SelectItem key={book} value={book} className="text-sm cursor-pointer hover:bg-slate-800">
                      {book}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-muted-foreground">To Win</span>
            <span className="font-bold text-brand-400">{potentialPayout.toFixed(2)} coins</span>
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
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
