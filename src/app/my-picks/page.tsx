'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBet, Game } from '@/lib/types';
import { getGames } from '@/lib/mock-data';

// Mock data for user's bets
const mockUserBets: UserBet[] = [
  {
    id: 'b1',
    gameId: 'g1',
    userId: 'u1',
    sport: 'NBA',
    betType: 'moneyline',
    pick: 'Golden State Warriors',
    stake: 5,
    odds: -140,
    potentialWinnings: 8.57,
    status: 'pending',
    placedAt: new Date().toISOString(),
  },
  {
    id: 'b2',
    gameId: 'g2',
    userId: 'u1',
    sport: 'NFL',
    betType: 'total',
    pick: 'Over 51.5',
    stake: 2,
    odds: -110,
    potentialWinnings: 3.82,
    status: 'pending',
    placedAt: new Date().toISOString(),
  },
];

const getBetStatusBadge = (status: UserBet['status'], isWinning: boolean | null) => {
  if (status === 'pending') {
    if (isWinning === true) return <Badge className="bg-green-500 text-white">Winning</Badge>;
    if (isWinning === false) return <Badge variant="destructive">Losing</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  }
  if (status === 'won') return <Badge className="bg-green-500 text-white">Won</Badge>;
  if (status === 'lost') return <Badge variant="destructive">Lost</Badge>;
  if (status === 'push') return <Badge>Push</Badge>;
};

export default function MyPicksPage() {
  const [bets, setBets] = useState<UserBet[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulate live score updates
  useEffect(() => {
    const interval = setInterval(() => {
      setGames(prevGames =>
        prevGames.map(game => {
          if (!game.startTime || new Date(game.startTime) > new Date()) {
            return game;
          }
          return {
            ...game,
            liveScore: {
              home: (game.liveScore?.home || 0) + Math.floor(Math.random() * 3),
              away: (game.liveScore?.away || 0) + Math.floor(Math.random() * 3),
            },
          };
        })
      );
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // In a real app, fetch from Firestore
      setBets(mockUserBets);
      const gamesData = await getGames();
      setGames(gamesData.map(g => ({...g, liveScore: { home: 0, away: 0 }})));
      setLoading(false);
    };
    fetchData();
  }, []);

  const getGameForBet = (gameId: string) => games.find(g => g.id === gameId);

  const getIsWinning = (bet: UserBet, game?: Game): boolean | null => {
    if (!game || !game.liveScore || bet.status !== 'pending') return null;

    if (bet.betType === 'moneyline') {
      const isHomePick = bet.pick === game.homeTeam.name;
      if (isHomePick) return game.liveScore.home > game.liveScore.away;
      return game.liveScore.away > game.liveScore.home;
    }
    
    if (bet.betType === 'total') {
        const totalPoints = game.liveScore.home + game.liveScore.away;
        const betPoints = parseFloat(bet.pick.split(' ')[1]);
        if(bet.pick.startsWith('Over')) {
            return totalPoints > betPoints;
        }
        return totalPoints < betPoints;
    }

    // Add logic for other bet types like spread
    return null;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold tracking-tight mb-4">My Picks</h1>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          My Picks
        </h1>
        <p className="text-muted-foreground">
          Track your active and settled bets here.
        </p>
      </header>
      <div className="space-y-4">
        {bets.map(bet => {
          const game = getGameForBet(bet.gameId);
          const isWinning = getIsWinning(bet, game);
          return (
            <Card key={bet.id} className="shadow-md">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex-grow">
                  <p className="font-semibold text-lg">{bet.pick} <span className="text-muted-foreground font-normal">({bet.odds > 0 ? `+${bet.odds}`: bet.odds})</span></p>
                  <p className="text-sm text-muted-foreground">{game ? `${game.awayTeam.name} @ ${game.homeTeam.name}` : 'Loading game...'}</p>
                   {game?.liveScore && bet.status === 'pending' && <p className="text-sm font-bold text-primary">{game.awayTeam.name.split(' ').pop()}: {game.liveScore.away} - {game.homeTeam.name.split(' ').pop()}: {game.liveScore.home}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  {getBetStatusBadge(bet.status, isWinning)}
                  <p className="text-sm">Stake: {bet.stake} coins</p>
                  <p className="text-sm">To Win: {bet.potentialWinnings.toFixed(2)} coins</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
