import { useState, useEffect, useCallback } from 'react';
import { pokemonManager } from '@/utils/pokemonManager';
import { getRandomPokemon, getPokemonName } from '@/data/pokemonData';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface UsePokemonCatchOptions {
  isPremium?: boolean;
  source?: 'game' | 'reward' | 'achievement';
}

export function usePokemonCatch(options: UsePokemonCatchOptions = {}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lastCaughtPokemon, setLastCaughtPokemon] = useState<number | null>(null);

  const { isPremium = false, source = 'game' } = options;

  // Catch a specific Pokemon
  const catchPokemon = useCallback(async (
    pokemonId: number,
    jlptLevel?: number,
    kanjiIds?: string[]
  ) => {
    if (isLoading) return false;

    setIsLoading(true);
    try {
      // Check if already caught
      const alreadyCaught = await pokemonManager.isPokemonCaught(pokemonId, user, isPremium);

      if (alreadyCaught) {
        showToast(`You already caught ${getPokemonName(pokemonId)}!`, 'info');
        return false;
      }

      // Catch the Pokemon
      await pokemonManager.catchPokemon(
        pokemonId,
        user,
        isPremium,
        source,
        jlptLevel,
        kanjiIds
      );

      setLastCaughtPokemon(pokemonId);

      // Show success toast with Pokemon name
      showToast(
        `🎉 You caught ${getPokemonName(pokemonId)}!`,
        'success',
        5000
      );

      return true;
    } catch (error) {
      console.error('Error catching Pokemon:', error);
      showToast('Failed to catch Pokemon', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isPremium, source, isLoading, showToast]);

  // Catch a random Pokemon (for rewards)
  const catchRandomPokemon = useCallback(async (
    jlptLevel?: number,
    kanjiIds?: string[]
  ) => {
    const randomId = getRandomPokemon();
    return await catchPokemon(randomId, jlptLevel, kanjiIds);
  }, [catchPokemon]);

  // Subscribe to catch events
  useEffect(() => {
    const unsubscribe = pokemonManager.onPokemonCaught((pokemonId) => {
      setLastCaughtPokemon(pokemonId);
    });

    return () => unsubscribe();
  }, []);

  return {
    catchPokemon,
    catchRandomPokemon,
    isLoading,
    lastCaughtPokemon
  };
}

// Global function for testing (can be called from console)
if (typeof window !== 'undefined') {
  (window as any).testCatchPokemon = async (pokemonId?: number) => {
    const id = pokemonId || getRandomPokemon();
    // Testing catch for Pokemon

    // This will only work if there's a component using the hook
    // For direct testing, we'll use the manager directly
    try {
      // Get current user from localStorage/session
      const user = null; // Would need to get from auth context
      await pokemonManager.catchPokemon(id, user, false, 'game');
      // Successfully caught Pokemon
      return id;
    } catch (error) {
      console.error('Failed to catch Pokemon:', error);
      return null;
    }
  };
}