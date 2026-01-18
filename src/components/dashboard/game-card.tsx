'use client';

import { useState, useEffect } from 'react';
import type { Game, SportName, Team } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Star, Coins, Calculator } from 'lucide-react';
import Image from 'next/image';
import { sportIconMap } from '@/lib/team-logos';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const InjuryIndicator = ({ team }: { team: Team }) => {
  const outPlayers = team.players.filter((p) => p.injuryStatus === 'Out');
  const questionablePlayers = team.players.filter(
    (p) => p.injuryStatus === 'Questionable'
  );

  if (outPlayers.length === 0 && questionablePlayers.length === 0) {
    return null;
  }

  const tooltipContent = (
    <div>
      {outPlayers.length > 0 && (
        <div className="mb-2">
          <p className="font-semibold">Out:</p>
          <ul className="list-disc list-inside">
            {outPlayers.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}
      {questionablePlayers.length > 0 && (
        <div>
          <p className="font-semibold">Questionable:</p>
          <ul className="list-disc list-inside">
            {questionablePlayers.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex gap-1">
            {outPlayers.length > 0 && (
              <Badge variant="destructive" className="cursor-pointer">
                O
              </Badge>
            )}
            {questionablePlayers.length > 0 && (
              <Badge className="bg-accent text-accent-foreground hover:bg-accent/80 cursor-pointer">
                Q
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TeamDisplay = ({ team, sport }: { team: Team; sport: SportName }) => {
  const FallbackIcon = sportIconMap[sport] || sportIconMap.Default;

  return (
    <div className="flex flex-col items-center text-center gap-2 w-28">
      {team.logo ? (
        <Image
          src={team.logo}
          alt={`${team.name} logo`}
          width={40}
          height={40}
          className="object-contain h-10 w-10"
        />
      ) : (
        <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full">
          <FallbackIcon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <div className="text-sm font-semibold h-10 flex items-center justify-center">
        {team.rank && (
          <span className="font-bold mr-1.5 text-primary">#{team.rank}</span>
        )}
        {team.name}
      </div>
      <div className="text-xs text-muted-foreground">({team.record})</div>
      <InjuryIndicator team={team} />
    </div>
  );
};

type SelectedBet = {
  pick: string;
  odds: number;
  betType: string;
  game: Game;
};

export function GameCard({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<SelectedBet | null>(null);
  const [stake, setStake] = useState('');
  const [potentialWinnings, setPotentialWinnings] = useState(0);
  const { toast } = useToast();

  const gameDate = new Date(game.startTime);
  const now = new Date();
  const isToday =
    now.getFullYear() === gameDate.getFullYear() &&
    now.getMonth() === gameDate.getMonth() &&
    now.getDate() === gameDate.getDate();

  const gameTime = isToday
    ? gameDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : gameDate.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

  const handleBetSelection = (
    pick: string,
    odds: number,
    betType: string
  ) => {
    setSelectedBet({ pick, odds, betType, game });
  };

  useEffect(() => {
    if (!open) {
      // Reset state when dialog is closed for a clean slate next time
      setSelectedBet(null);
      setStake('');
      setPotentialWinnings(0);
    }
  }, [open]);

  useEffect(() => {
    const stakeNum = parseFloat(stake);
    if (!stakeNum || !selectedBet || stakeNum <= 0) {
      setPotentialWinnings(0);
      return;
    }

    const odds = selectedBet.odds;
    let profit = 0;
    if (odds > 0) {
      // For positive odds, profit = stake * (odds / 100)
      profit = stakeNum * (odds / 100);
    } else {
      // For negative odds, profit = stake / (abs(odds) / 100)
      profit = stakeNum / (Math.abs(odds) / 100);
    }
    setPotentialWinnings(stakeNum + profit);
  }, [stake, selectedBet]);

  const handlePlaceBet = () => {
    // In a real app, this would write to Firestore.
    // For now, we'll just show a confirmation toast.
    toast({
      title: 'Bet Placed (Simulated)',
      description: `You wagered ${stake} coins on ${selectedBet?.pick}. Good luck!`,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Card className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="flex-row items-center justify-between bg-card-foreground/5 p-3">
          <div className="text-sm font-medium">{game.sport}</div>
          <div className="text-sm text-muted-foreground">{gameTime}</div>
          <button className="text-muted-foreground hover:text-accent transition-colors">
            <Star className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="flex-grow p-4 flex flex-col justify-between">
          <div className="flex items-start justify-around text-center mb-4">
            <TeamDisplay team={game.awayTeam} sport={game.sport} />
            <div className="flex flex-col items-center self-center px-2">
              <span className="text-lg font-bold text-muted-foreground">@</span>
            </div>
            <TeamDisplay team={game.homeTeam} sport={game.sport} />
          </div>

          {game.odds && (
            <div className="space-y-2">
              <p className="text-center text-xs text-muted-foreground mb-2">
                Quick Bets
              </p>
              <div className="grid grid-cols-2 gap-2">
                <DialogTrigger
                  asChild
                  onClick={() =>
                    handleBetSelection(
                      game.awayTeam.name,
                      game.odds!.moneyline.away,
                      'moneyline'
                    )
                  }
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-col h-auto py-2"
                  >
                    <span>
                      {game.awayTeam.name.split(' ').pop()}{' '}
                      {game.odds.moneyline.away > 0
                        ? `+${game.odds.moneyline.away}`
                        : game.odds.moneyline.away}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Moneyline
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogTrigger
                  asChild
                  onClick={() =>
                    handleBetSelection(
                      game.homeTeam.name,
                      game.odds!.moneyline.home,
                      'moneyline'
                    )
                  }
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-col h-auto py-2"
                  >
                    <span>
                      {game.homeTeam.name.split(' ').pop()}{' '}
                      {game.odds.moneyline.home > 0
                        ? `+${game.odds.moneyline.home}`
                        : game.odds.moneyline.home}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Moneyline
                    </span>
                  </Button>
                </DialogTrigger>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DialogTrigger
                  asChild
                  onClick={() =>
                    handleBetSelection(
                      `Over ${game.odds!.total.points}`,
                      game.odds!.total.over,
                      'total'
                    )
                  }
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-col h-auto py-2"
                  >
                    <span>Over {game.odds.total.points}</span>
                    <span className="text-xs text-muted-foreground">
                      (
                      {game.odds.total.over > 0
                        ? `+${game.odds.total.over}`
                        : game.odds.total.over}
                      )
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogTrigger
                  asChild
                  onClick={() =>
                    handleBetSelection(
                      `Under ${game.odds!.total.points}`,
                      game.odds!.total.under,
                      'total'
                    )
                  }
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-col h-auto py-2"
                  >
                    <span>Under {game.odds.total.points}</span>
                    <span className="text-xs text-muted-foreground">
                      (
                      {game.odds.total.under > 0
                        ? `+${game.odds.total.under}`
                        : game.odds.total.under}
                      )
                    </span>
                  </Button>
                </DialogTrigger>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <DialogContent className="sm:max-w-[425px]">
        {selectedBet && (
          <>
            <DialogHeader>
              <DialogTitle>{selectedBet.pick}</DialogTitle>
              <DialogDescription>
                {selectedBet.game.awayTeam.name} @{' '}
                {selectedBet.game.homeTeam.name}
                <br />
                <span className="capitalize">{selectedBet.betType}</span> @{' '}
                <span className="font-bold">
                  {selectedBet.odds > 0
                    ? `+${selectedBet.odds}`
                    : selectedBet.odds}
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stake" className="text-right">
                  <Coins className="inline-block mr-1 h-4 w-4 text-muted-foreground" />
                  Stake
                </Label>
                <Input
                  id="stake"
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="col-span-3"
                  placeholder="0.00 coins"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="winnings" className="text-right">
                  <Calculator className="inline-block mr-1 h-4 w-4 text-muted-foreground" />
                  Return
                </Label>
                <p
                  id="winnings"
                  className="col-span-3 text-sm font-semibold text-foreground"
                >
                  {potentialWinnings.toFixed(2)} coins
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handlePlaceBet}
                disabled={!stake || parseFloat(stake) <= 0}
              >
                Place Bet
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
