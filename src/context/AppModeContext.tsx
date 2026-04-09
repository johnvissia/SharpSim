'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface AppModeContextType {
  isRealMoneyMode: boolean;
  toggleRealMoneyMode: () => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [isRealMoneyMode, setIsRealMoneyMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('realMoneyMode');
    if (savedMode === 'true') {
      setIsRealMoneyMode(true);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('realMoneyMode', isRealMoneyMode.toString());
      if (isRealMoneyMode) {
        document.documentElement.classList.add('real-money-mode');
      } else {
        document.documentElement.classList.remove('real-money-mode');
      }
    }
  }, [isRealMoneyMode, isInitialized]);

  const toggleRealMoneyMode = () => {
    setIsRealMoneyMode((prev) => !prev);
  };

  return (
    <AppModeContext.Provider value={{ isRealMoneyMode, toggleRealMoneyMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
