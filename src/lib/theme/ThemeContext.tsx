'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { preferencesManager } from '@/utils/preferencesManager';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'moshimoshi-theme';
const USER_THEME_STORAGE_KEY = 'moshimoshi-user-theme';

// Helper to get current user ID from auth state
const getCurrentUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  // Try to get user ID from session or auth state
  const authData = localStorage.getItem('auth-user');
  if (authData) {
    try {
      const user = JSON.parse(authData);
      return user?.uid || null;
    } catch {
      return null;
    }
  }
  return null;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const { isPremium } = useSubscription();

  // Get system preference
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Resolve the actual theme to apply
  const resolveTheme = (selectedTheme: Theme): ResolvedTheme => {
    if (selectedTheme === 'system') {
      return getSystemTheme();
    }
    return selectedTheme as ResolvedTheme;
  };

  // Apply theme to document
  const applyTheme = (resolvedTheme: ResolvedTheme) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  };

  // Initialize theme and palette on mount
  useEffect(() => {
    const initializeThemeAndPalette = async () => {
      // Initialize theme first (synchronous)
      const userId = getCurrentUserId();
      let savedTheme: Theme | null = null;

      if (userId) {
        const userKey = `${USER_THEME_STORAGE_KEY}-${userId}`;
        savedTheme = localStorage.getItem(userKey) as Theme | null;
      }

      // Fall back to global theme if no user-specific theme
      if (!savedTheme) {
        savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      }

      // Default to 'dark' on first visit instead of 'system'
      const initialTheme = savedTheme || 'dark';
      const resolved = resolveTheme(initialTheme);

      setThemeState(initialTheme);
      setResolvedTheme(resolved);
      applyTheme(resolved);

      // Load palette using preferencesManager (respects user tier)
      try {
        const preferences = await preferencesManager.getPreferences(user, isPremium);
        if (preferences.palette) {
          document.documentElement.setAttribute('data-palette', preferences.palette);
          console.log('[ThemeContext] Applied palette from preferences:', preferences.palette);
        } else {
          // Fallback to default palette
          document.documentElement.setAttribute('data-palette', 'sakura');
          console.log('[ThemeContext] Applied default palette: sakura');
        }
      } catch (error) {
        console.error('[ThemeContext] Failed to load palette from preferences:', error);
        // Fallback to localStorage for backward compatibility
        const loadPaletteFallback = () => {
          if (userId) {
            const userPrefs = localStorage.getItem(`user-preferences-${userId}`);
            if (userPrefs) {
              try {
                const prefs = JSON.parse(userPrefs);
                if (prefs.palette) {
                  document.documentElement.setAttribute('data-palette', prefs.palette);
                  return;
                }
              } catch (e) {
                console.error('Failed to load user palette preference:', e);
              }
            }
          }

          // Fall back to global preferences
          const savedPrefs = localStorage.getItem('user-preferences');
          if (savedPrefs) {
            try {
              const prefs = JSON.parse(savedPrefs);
              if (prefs.palette) {
                document.documentElement.setAttribute('data-palette', prefs.palette);
              }
            } catch (e) {
              console.error('Failed to load palette preference:', e);
            }
          }
        };

        loadPaletteFallback();
      }

      setMounted(true);
    };

    initializeThemeAndPalette();
  }, [user, isPremium]); // Re-run when user or premium status changes

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyTheme(newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  // Handle theme change
  const setTheme = (newTheme: Theme) => {
    const resolved = resolveTheme(newTheme);

    setThemeState(newTheme);
    setResolvedTheme(resolved);

    // Save both globally and user-specific if user is logged in
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    const userId = getCurrentUserId();
    if (userId) {
      const userKey = `${USER_THEME_STORAGE_KEY}-${userId}`;
      localStorage.setItem(userKey, newTheme);
    }

    applyTheme(resolved);
  };

  // Prevent flash of unstyled content
  useEffect(() => {
    if (!mounted) return;
    applyTheme(resolvedTheme);
  }, [resolvedTheme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}