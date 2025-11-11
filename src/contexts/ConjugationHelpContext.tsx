'use client';

/**
 * Conjugation Help Context
 *
 * Provides global state management for the conjugation help system.
 * Supports both smart mode (auto-triggered on errors) and manual mode (user-initiated).
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { HelpContent } from '@/data/conjugation-help/help-content';
import type { ConjugationErrorReport } from '@/lib/conjugation-help';

interface ConjugationHelpState {
  /** Currently displayed help content */
  currentHelp: HelpContent | null;

  /** Queue of help items to display (for multi-help navigation) */
  helpQueue: HelpContent[];

  /** Current index in help queue */
  currentHelpIndex: number;

  /** Whether the help modal is open */
  isModalOpen: boolean;

  /** Error report context (for smart mode) */
  errorReport: ConjugationErrorReport | null;

  /** Display mode: manual (user clicked) or smart (auto-shown on error) */
  mode: 'manual' | 'smart';
}

interface ConjugationHelpActions {
  /** Show a single help item */
  showHelp: (help: HelpContent, mode?: 'manual' | 'smart') => void;

  /** Show multiple helps with navigation (for smart mode) */
  showMultipleHelps: (helps: HelpContent[], errorReport?: ConjugationErrorReport) => void;

  /** Navigate to next help in queue */
  nextHelp: () => void;

  /** Navigate to previous help in queue */
  prevHelp: () => void;

  /** Close the help modal */
  closeHelp: () => void;

  /** Reset all state */
  reset: () => void;
}

interface ConjugationHelpContextValue extends ConjugationHelpState, ConjugationHelpActions {}

const ConjugationHelpContext = createContext<ConjugationHelpContextValue | null>(null);

export function ConjugationHelpProvider({ children }: { children: ReactNode }) {
  // State
  const [currentHelp, setCurrentHelp] = useState<HelpContent | null>(null);
  const [helpQueue, setHelpQueue] = useState<HelpContent[]>([]);
  const [currentHelpIndex, setCurrentHelpIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorReport, setErrorReport] = useState<ConjugationErrorReport | null>(null);
  const [mode, setMode] = useState<'manual' | 'smart'>('manual');

  // Actions
  const showHelp = useCallback((help: HelpContent, displayMode: 'manual' | 'smart' = 'manual') => {
    setCurrentHelp(help);
    setHelpQueue([help]);
    setCurrentHelpIndex(0);
    setMode(displayMode);
    setIsModalOpen(true);
    setErrorReport(null);
  }, []);

  const showMultipleHelps = useCallback((
    helps: HelpContent[],
    report?: ConjugationErrorReport
  ) => {
    if (helps.length === 0) return;

    setHelpQueue(helps);
    setCurrentHelp(helps[0]);
    setCurrentHelpIndex(0);
    setMode('smart');
    setIsModalOpen(true);
    setErrorReport(report || null);
  }, []);

  const nextHelp = useCallback(() => {
    if (currentHelpIndex < helpQueue.length - 1) {
      const newIndex = currentHelpIndex + 1;
      setCurrentHelpIndex(newIndex);
      setCurrentHelp(helpQueue[newIndex]);
    }
  }, [currentHelpIndex, helpQueue]);

  const prevHelp = useCallback(() => {
    if (currentHelpIndex > 0) {
      const newIndex = currentHelpIndex - 1;
      setCurrentHelpIndex(newIndex);
      setCurrentHelp(helpQueue[newIndex]);
    }
  }, [currentHelpIndex, helpQueue]);

  const closeHelp = useCallback(() => {
    setIsModalOpen(false);
    // Don't clear state immediately to allow for exit animation
    setTimeout(() => {
      setCurrentHelp(null);
      setHelpQueue([]);
      setCurrentHelpIndex(0);
      setErrorReport(null);
    }, 200);
  }, []);

  const reset = useCallback(() => {
    setCurrentHelp(null);
    setHelpQueue([]);
    setCurrentHelpIndex(0);
    setIsModalOpen(false);
    setErrorReport(null);
    setMode('manual');
  }, []);

  const value: ConjugationHelpContextValue = {
    // State
    currentHelp,
    helpQueue,
    currentHelpIndex,
    isModalOpen,
    errorReport,
    mode,

    // Actions
    showHelp,
    showMultipleHelps,
    nextHelp,
    prevHelp,
    closeHelp,
    reset,
  };

  return (
    <ConjugationHelpContext.Provider value={value}>
      {children}
    </ConjugationHelpContext.Provider>
  );
}

/**
 * Hook to access conjugation help context
 * @throws Error if used outside ConjugationHelpProvider
 */
export function useConjugationHelp() {
  const context = useContext(ConjugationHelpContext);
  if (!context) {
    throw new Error('useConjugationHelp must be used within ConjugationHelpProvider');
  }
  return context;
}
