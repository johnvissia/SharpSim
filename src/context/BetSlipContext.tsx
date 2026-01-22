'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import type { Game } from '@/lib/types';

export interface BetSlipPick {
  id: string;
  game: Game;
  pick: string;
  odds: number;
  betType: 'moneyline' | 'spread' | 'total' | 'player_prop';
  marketId: string;
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
      const pickId = `${newPick.marketId}-${newPick.pick.replace(/\s/g, '')}`;

      if (currentPicks.some(p => p.id === pickId)) {
        return currentPicks.filter(p => p.id !== pickId);
      }

      const filteredPicks = currentPicks.filter(p => p.marketId !== newPick.marketId);

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
