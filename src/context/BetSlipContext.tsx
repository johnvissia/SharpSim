'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import type { Game } from '@/lib/types';

export interface BetSlipPick {
  id: string; // A unique identifier for this pick, e.g., `${game.id}-${betType}-${pick}`
  game: Game;
  pick: string;
  odds: number;
  betType: 'moneyline' | 'spread' | 'total' | 'player_prop';
}

interface BetSlipContextType {
  picks: BetSlipPick[];
  addPick: (pick: Omit<BetSlipPick, 'id'>) => void;
  removePick: (pickId: string) => void;
  clearPicks: () => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export const BetSlipProvider = ({ children }: { children: ReactNode }) => {
  const [picks, setPicks] = useState<BetSlipPick[]>([]);

  const addPick = (newPick: Omit<BetSlipPick, 'id'>) => {
    setPicks(currentPicks => {
      // Create a unique ID for the pick
      const pickId = `${newPick.game.id}-${newPick.betType}-${newPick.pick.replace(/\s/g, '')}`;

      // Prevent adding the exact same pick twice
      if (currentPicks.some(p => p.id === pickId)) {
        return currentPicks;
      }
      
      // Prevent adding conflicting picks from the same game (e.g., both sides of a moneyline)
      const picksForSameGame = currentPicks.filter(p => p.game.id === newPick.game.id);
      if(picksForSameGame.length > 0) {
        // Simple rule for now: only one pick per game in a parlay.
        // Replace the existing pick for this game.
        const otherPicks = currentPicks.filter(p => p.game.id !== newPick.game.id);
        return [...otherPicks, { ...newPick, id: pickId }];
      }

      return [...currentPicks, { ...newPick, id: pickId }];
    });
  };

  const removePick = (pickId: string) => {
    setPicks(currentPicks => currentPicks.filter(p => p.id !== pickId));
  };

  const clearPicks = () => {
    setPicks([]);
  };

  const value = useMemo(() => ({
    picks,
    addPick,
    removePick,
    clearPicks,
  }), [picks]);

  return (
    <BetSlipContext.Provider value={value}>
      {children}
    </BetSlipContext.Provider>
  );
};

export const useBetSlip = () => {
  const context = useContext(BetSlipContext);
  if (context === undefined) {
    throw new Error('useBetSlip must be used within a BetSlipProvider');
  }
  return context;
};
