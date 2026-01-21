'use client';

import { useMemo } from 'react';
import { GameCard } from './game-card';
import type { Game } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { power4TeamNames } from '@/lib/power-4-teams';

type GameFeedProps = {
  games: Game[];
  isLoading: boolean;
  selectedSport: string;
  selectedConference: string;
  onGameClick: (game: Game) => void;
  activeBetGameIds: Set<string>;
};

export function GameFeed({ games, isLoading, selectedSport, selectedConference, onGameClick, activeBetGameIds }: GameFeedProps) {

  const filteredAndSortedGames = useMemo(() => {
    const now = new Date();
    // Finished games will be shown for 4 hours after their start time (approx. 1 hr after they end)
    const finishedGameCutoff = 4 * 60 * 60 * 1000; 

    return games.filter(game => {
        // 1. Sport Filter
        const sportMatch = selectedSport === 'All' || game.sport === selectedSport;
        if (!sportMatch) return false;

        // 2. Hide old finished games
        if (game.statusState === 'post') {
            const gameTime = new Date(game.startTime).getTime();
            if (now.getTime() - gameTime > finishedGameCutoff) {
                return false;
            }
        }

        const ncaaSports = ['NCAAF', 'NCAAM'];
        const isNCAAGame = ncaaSports.includes(game.sport as any);
        
        // 3. NCAA-specific filters
        if (isNCAAGame) {
            const isConferenceFilterActive = selectedConference !== 'All';

            // A) Conference Filter (if active)
            if (isConferenceFilterActive) {
                const homeConference = game.homeTeam.conference;
                const awayConference = game.awayTeam.conference;
                return homeConference === selectedConference || awayConference === selectedConference;
            }
            
            // B) Power 4 Filter (if no conference is selected)
            // Show game if at least one team is in the Power 4 list.
            return power4TeamNames.has(game.homeTeam.name) || power4TeamNames.has(game.awayTeam.name);
        }

        // 4. Show all non-NCAA games that match the sport filter
        return true;
    })
    .sort((a, b) => {
        const aHasBet = activeBetGameIds.has(a.oddsApiId || '');
        const bHasBet = activeBetGameIds.has(b.oddsApiId || '');

        // Primary sort: games with active bets on top
        if (aHasBet !== bHasBet) {
            return aHasBet ? -1 : 1;
        }

        const statusOrder = {
            'in': 1,   // Then live games
            'pre': 2,  // Then upcoming games
            'post': 3, // Finally, finished games
        };

        const aStatus = a.statusState ?? 'pre';
        const bStatus = b.statusState ?? 'pre';

        const aOrder = statusOrder[aStatus as keyof typeof statusOrder] || 4;
        const bOrder = statusOrder[bStatus as keyof typeof statusOrder] || 4;
        
        // Secondary sort: by game state
        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        // Tertiary sort: by time
        // For finished games, sort descending to show most recent first.
        if (aStatus === 'post') {
            return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        }
        
        // For live and upcoming, sort ascending to show soonest first.
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [games, selectedSport, selectedConference, activeBetGameIds]);

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
            <GameCard 
              key={`${game.id}-${game.homeTeam.name}`} 
              game={game} 
              onGameClick={onGameClick}
              hasActiveBet={activeBetGameIds.has(game.oddsApiId || '')}
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
