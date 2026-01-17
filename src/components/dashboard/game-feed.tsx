'use client';

import { useState, useEffect, useMemo } from 'react';
import { GameCard } from './game-card';
import type { Game } from '@/lib/types';
import { getGames } from '@/lib/mock-data';
import { Skeleton } from '@/components/ui/skeleton';

type GameFeedProps = {
  selectedSport: string;
};

export function GameFeed({ selectedSport }: GameFeedProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Mock user favorites
  const [favoriteSports, setFavoriteSports] = useState<string[]>(['NFL', 'NBA']);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(['Golden State Warriors', 'Kansas City Chiefs']);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Simulate API call
      const gamesData = await getGames();
      setGames(gamesData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredAndSortedGames = useMemo(() => {
    const filteredGames = games.filter(game => 
      selectedSport === 'All' || game.sport === selectedSport
    );

    return [...filteredGames].sort((a, b) => {
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
  }, [games, selectedSport, favoriteSports, favoriteTeams]);

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
      {filteredAndSortedGames.length > 0 ? (
        filteredAndSortedGames.map((game) => (
            <GameCard key={game.id} game={game} />
        ))
      ) : (
        <p className="text-muted-foreground md:col-span-2 lg:col-span-3 xl:col-span-4">
            No games found for the selected sport today.
        </p>
      )}
    </div>
  );
}
