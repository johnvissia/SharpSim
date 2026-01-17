'use client';

import { useState, useEffect } from 'react';
import { GameCard } from './game-card';
import type { Game, Sport } from '@/lib/types';
import { getGames, getSports } from '@/lib/mock-data';
import { Skeleton } from '@/components/ui/skeleton';

export function GameFeed() {
  const [games, setGames] = useState<Game[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Mock user favorites
  const [favoriteSports, setFavoriteSports] = useState<string[]>(['NFL', 'NBA']);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(['Golden State Warriors', 'Kansas City Chiefs']);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Simulate API call
      const gamesData = await getGames();
      const sportsData = await getSports();
      setGames(gamesData);
      setSports(sportsData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const sortedGames = [...games].sort((a, b) => {
    const aIsFavSport = favoriteSports.includes(a.sport);
    const bIsFavSport = favoriteSports.includes(b.sport);
    const aIsFavTeam = favoriteTeams.includes(a.homeTeam.name) || favoriteTeams.includes(a.awayTeam.name);
    const bIsFavTeam = favoriteTeams.includes(b.homeTeam.name) || favoriteTeams.includes(b.awayTeam.name);

    if (aIsFavSport && !bIsFavSport) return -1;
    if (!aIsFavSport && bIsFavSport) return 1;
    if (aIsFavTeam && !bIsFavTeam) return -1;
    if (!aIsFavTeam && bIsFavTeam) return 1;

    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sortedGames.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
