
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import type { Game } from '@/lib/types';

export interface BetSlipPick {
  id: string; // A unique ID for the pick itself, combining market and selection
  game: Partial<Game>; // Game can be partial for props
  pick: string; // The user's selection text, e.g., "Over 22.5" or "Team A -5.5"
  odds: number;
  betType: 'moneyline' | 'spread' | 'total' | 'player_prop';
  marketId: string; // Unique ID for the market, to prevent multiple picks in same market
  // Optional fields for player props
  playerId?: string;
  market?: string;
  line?: number;
}


interface BetSlipContextType {
  picks: BetSlipPick[];
  addPick: (pick: Omit<BetSlipPick, 'id'>) => void;
  removePick: (pickId: string) => void;
  updatePickOdds: (pickId: string, odds: number) => void;
  clearPicks: () => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export const BetSlipProvider = ({ children }: { children: ReactNode }) => {
  const [picks, setPicks] = useState<BetSlipPick[]>([]);

  const addPick = (newPick: Omit<BetSlipPick, 'id'>) => {
    setPicks(currentPicks => {
      // The unique ID for a pick is its market plus the specific thing chosen
      const pickId = `${newPick.marketId}-${newPick.pick.replace(/\s/g, '')}`;

      // If the exact same pick is already in the slip, remove it (toggle off).
      if (currentPicks.some(p => p.id === pickId)) {
        return currentPicks.filter(p => p.id !== pickId);
      }

      // If a different pick for the same market is in the slip, replace it.
      const filteredPicks = currentPicks.filter(p => p.marketId !== newPick.marketId);

      // Add the new pick.
      return [...filteredPicks, { ...newPick, id: pickId }];
    });
  };

  const removePick = (pickId: string) => {
    setPicks(currentPicks => currentPicks.filter(p => p.id !== pickId));
  };

  const updatePickOdds = (pickId: string, odds: number) => {
    setPicks(currentPicks =>
      currentPicks.map(p => (p.id === pickId ? { ...p, odds } : p))
    );
  };

  const clearPicks = () => {
    setPicks([]);
  };

  const value = useMemo(() => ({
    picks,
    addPick,
    removePick,
    updatePickOdds,
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
