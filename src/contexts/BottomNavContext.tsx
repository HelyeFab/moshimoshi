'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { NavItem } from '@/components/layout/BottomNav';

interface BottomNavContextValue {
  extraItem: NavItem | null;
  setExtraItem: (item: NavItem | null) => void;
}

const BottomNavContext = createContext<BottomNavContextValue | undefined>(undefined);

export function BottomNavProvider({ children }: { children: React.ReactNode }) {
  const [extraItem, setExtraItemState] = useState<NavItem | null>(null);

  const setExtraItem = useCallback((item: NavItem | null) => {
    setExtraItemState(item);
  }, []);

  return (
    <BottomNavContext.Provider value={{ extraItem, setExtraItem }}>
      {children}
    </BottomNavContext.Provider>
  );
}

export function useBottomNav() {
  const context = useContext(BottomNavContext);
  if (!context) {
    throw new Error('useBottomNav must be used within BottomNavProvider');
  }
  return context;
}
