/**
 * useKeyboardShortcuts Hook
 *
 * Provides configurable keyboard shortcut management with:
 * - Modifier key support (Ctrl, Shift, Alt, Meta)
 * - Input field exclusion (don't trigger in forms)
 * - Event delegation for performance
 * - Help text generation for UI
 * - Backward compatible simple API
 */

import { useEffect, useCallback, useRef } from 'react';

// Simple API (backward compatible)
type KeyboardShortcuts = Record<string, () => void>;

// Advanced API
export interface KeyBinding {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  ignoreInputFields?: boolean;
  bindings: KeyBinding[];
}

export interface ShortcutHelp {
  keys: string;
  description: string;
}

/**
 * Simple overload (backward compatible)
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts, enabled?: boolean): {
  isEnabled: boolean;
};

/**
 * Advanced overload with KeyBinding array
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): {
  getShortcutsHelp: () => ShortcutHelp[];
};

/**
 * Implementation
 */
export function useKeyboardShortcuts(
  shortcutsOrOptions: KeyboardShortcuts | UseKeyboardShortcutsOptions,
  enabledParam = true
): any {
  // Detect which API is being used
  const isAdvancedAPI = 'bindings' in shortcutsOrOptions;

  if (isAdvancedAPI) {
    return useAdvancedKeyboardShortcuts(shortcutsOrOptions);
  } else {
    return useSimpleKeyboardShortcuts(shortcutsOrOptions, enabledParam);
  }
}

/**
 * Simple API implementation (backward compatible)
 */
function useSimpleKeyboardShortcuts(shortcuts: KeyboardShortcuts, enabled: boolean) {
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

/**
 * Advanced API implementation with KeyBinding array
 */
function useAdvancedKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { enabled = true, ignoreInputFields = true, bindings } = options;
  const bindingsRef = useRef(bindings);

  // Update ref when bindings change (avoid stale closures)
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore shortcuts when typing in input fields
    if (ignoreInputFields) {
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isEditable = target.isContentEditable;

      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        isEditable
      ) {
        return;
      }
    }

    // Find matching binding
    const binding = bindingsRef.current.find(b => {
      const keyMatches = b.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatches = b.ctrlKey === undefined || b.ctrlKey === event.ctrlKey;
      const shiftMatches = b.shiftKey === undefined || b.shiftKey === event.shiftKey;
      const altMatches = b.altKey === undefined || b.altKey === event.altKey;
      const metaMatches = b.metaKey === undefined || b.metaKey === event.metaKey;

      return keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches;
    });

    if (binding) {
      if (binding.preventDefault !== false) {
        event.preventDefault();
        event.stopPropagation();
      }
      binding.handler(event);
    }
  }, [enabled, ignoreInputFields]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return help text for UI
  const getShortcutsHelp = useCallback((): ShortcutHelp[] => {
    return bindingsRef.current.map(b => ({
      keys: [
        b.ctrlKey && 'Ctrl',
        b.shiftKey && 'Shift',
        b.altKey && 'Alt',
        b.metaKey && 'Cmd',
        formatKeyName(b.key)
      ].filter(Boolean).join(' + '),
      description: b.description
    }));
  }, []);

  return { getShortcutsHelp };
}

/**
 * Format key name for display in UI.
 */
function formatKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'Enter': 'Enter',
    'Escape': 'Esc',
  };

  return keyMap[key] || key.toUpperCase();
}
