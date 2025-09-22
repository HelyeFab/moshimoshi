// Hook for keyboard shortcuts in Review Engine

import { useEffect, useCallback } from 'react';

type KeyboardShortcuts = Record<string, () => void>;

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts, enabled = true) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true') {
      // Allow Escape and Enter in some cases
      if (event.key !== 'Escape' && event.key !== 'Enter') {
        return;
      }
    }
    
    // Build key combination string
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Meta');
    
    const key = event.key;
    const combination = modifiers.length > 0 
      ? `${modifiers.join('+')}+${key}`
      : key;
    
    // Check if we have a handler for this combination
    if (shortcuts[combination]) {
      event.preventDefault();
      shortcuts[combination]();
    } else if (shortcuts[key]) {
      event.preventDefault();
      shortcuts[key]();
    }
  }, [shortcuts, enabled]);
  
  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, enabled]);
  
  return {
    isEnabled: enabled
  };
}