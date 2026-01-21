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
      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
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
        <p className="text-muted-foreground">
            Loading today's lines or no games match your filter...
        </p>
      )}
    </div>
  );
}
