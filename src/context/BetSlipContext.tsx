'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import type { Game } from '@/lib/types';

export interface BetSlipPick {
  id: string;
  game: Game;
  pick: string;
  odds: number;
  betType: 'moneyline' | 'spread' | 'total' | 'player_prop';
  marketId: string; // Unique ID for the market (e.g., gameId-moneyline or propId)
  
  // Player Prop specific fields
  playerId?: string;
  market?: string;
  line?: number;
}

interface BetSlipContextType {
  picks: BetSlipPick[];
  addPick: (pick: Omit<BetSlipPick, 'id'> & { overUnder?: 'Over' | 'Under' }) => void;
  removePick: (pickId: string) => void;
  clearPicks: () => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export const BetSlipProvider = ({ children }: { children: ReactNode }) => {
  const [picks, setPicks] = useState<BetSlipPick[]>([]);

  const addPick = (newPick: Omit<BetSlipPick, 'id'> & { overUnder?: 'Over' | 'Under' }) => {
    setPicks(currentPicks => {
      // For player props, the ID depends on the market and the over/under choice.
      // For game lines, it depends on the market and the specific pick (e.g. team name).
      const pickId = newPick.betType === 'player_prop' 
        ? `${newPick.marketId}-${newPick.overUnder}`
        : `${newPick.marketId}-${newPick.pick.replace(/\s/g, '')}`;

      // If the exact same pick is already in the slip, remove it (toggle off).
      if (currentPicks.some(p => p.id === pickId)) {
        return currentPicks.filter(p => p.id !== pickId);
      }

      // If a different pick for the same market is in the slip, replace it.
      // (e.g., changing from Over to Under, or from Team A spread to Team B spread).
      const filteredPicks = currentPicks.filter(p => p.marketId !== newPick.marketId);

      // Add the new pick.
      return [...filteredPicks, { ...newPick, id: pickId }];
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
