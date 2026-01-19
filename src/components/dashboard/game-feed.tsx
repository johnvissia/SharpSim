'use client';

import { useMemo, useState } from 'react';
import { GameCard } from './game-card';
import type { Game } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

type GameFeedProps = {
  games: Game[];
  isLoading: boolean;
  selectedSport: string;
  selectedConference: string;
  onGameClick: (game: Game) => void;
};

export function GameFeed({ games, isLoading, selectedSport, selectedConference, onGameClick }: GameFeedProps) {
  const [favoriteSports, setFavoriteSports] = useState<string[]>(['NFL', 'NBA']);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(['Golden State Warriors', 'Kansas City Chiefs']);

  const filteredAndSortedGames = useMemo(() => {
    return games.filter(game => {
        // 1. Sport Filter (always applied)
        const sportMatch = selectedSport === 'All' || game.sport === selectedSport;
        if (!sportMatch) return false;

        const ncaaSports = ['NCAAF', 'NCAAM'];
        const isNCAAGame = ncaaSports.includes(game.sport as any);
        const isConferenceFilterActive = selectedConference !== 'All';

        // 2. Conference Filter (takes precedence for NCAA games)
        if (isNCAAGame && isConferenceFilterActive) {
            const homeConference = game.homeTeam.conference;
            const awayConference = game.awayTeam.conference;
            // A game is in the conference if at least one team is in it
            return homeConference === selectedConference || awayConference === selectedConference;
        }

        // 3. Clutter-reduction Filter for "All Sports" view (only if conference filter is not active)
        if (selectedSport === 'All' && isNCAAGame && !isConferenceFilterActive) {
            // Only show ranked NCAA teams to reduce clutter in the main view
            return !!game.homeTeam.rank || !!game.awayTeam.rank;
        }
        
        // 4. If none of the specific filters above apply, show the game
        return true;
    })
    .sort((a, b) => {
        // Favorite sorting comes first
        const aIsFavSport = favoriteSports.includes(a.sport);
        const bIsFavSport = favoriteSports.includes(b.sport);
        if (aIsFavSport && !bIsFavSport) return -1;
        if (!aIsFavSport && bIsFavSport) return 1;
        
        const aIsFavTeam = favoriteTeams.includes(a.homeTeam.name) || favoriteTeams.includes(a.awayTeam.name);
        const bIsFavTeam = favoriteTeams.includes(b.homeTeam.name) || favoriteTeams.includes(b.awayTeam.name);
        if (aIsFavTeam && !bIsFavTeam) return -1;
        if (!aIsFavTeam && bIsFavTeam) return 1;

        // Fallback to time sort
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [games, selectedSport, selectedConference, favoriteSports, favoriteTeams]);

  if (isLoading && games.length === 0) {
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
            <GameCard key={game.id} game={game} onGameClick={onGameClick} />
        ))
      ) : (
        <p className="text-muted-foreground md:col-span-2 lg:col-span-3 xl:col-span-4">
            Loading today's lines or no games match your filter...
        </p>
      )}
    </div>
  );
}
