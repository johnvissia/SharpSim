'use client';

import { GameCard } from './game-card';
import type { Game } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

type GameFeedProps = {
  games: Game[];
  isLoading: boolean;
  onGameClick: (game: Game) => void;
  activeBetGameIds: Set<string>;
};

export function GameFeed({ games, isLoading, onGameClick, activeBetGameIds }: GameFeedProps) {
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
      {games.length > 0 ? (
        games.map((game) => (
            <GameCard 
              key={`${game.id}-${game.homeTeam.name}`} 
              game={game} 
              onGameClick={onGameClick}
              hasActiveBet={!!game.oddsApiId && activeBetGameIds.has(game.oddsApiId)}
            />
        ))
      ) : (
        <p className="text-muted-foreground md:col-span-2 lg:col-span-3 xl:col-span-4">
            Loading today's lines or no games match your filter...
        </p>
      )}
    </div>
  );
}
