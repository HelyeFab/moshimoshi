'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getPokemonSpriteUrl,
  getPokemonSilhouetteStyle,
  getPokemonName,
  getPokemonRarity,
  getRarityColorClasses,
  POKEMON_NAMES,
  PokemonInfo
} from '@/data/pokemonData';
import { pokemonManager } from '@/utils/pokemonManager';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface PokedexContentProps {
  userId?: string;
  onClose?: () => void;
  isPremium?: boolean;
}

export default function PokedexContent({ userId, onClose, isPremium = false }: PokedexContentProps) {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const { theme } = useTheme();
  const [caughtPokemonIds, setCaughtPokemonIds] = useState<number[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'caught' | 'all'>('caught');
  const [loadedPokemonCount, setLoadedPokemonCount] = useState(151); // Start with Gen 1
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCaughtPokemon = async () => {
      // Skip if auth is still loading
      if (authLoading) {
        return;
      }

      try {
        setIsLoading(true);
        // Pass user (can be null for guests) and premium status
        const caughtIds = await pokemonManager.getCaughtPokemon(user, isPremium);
        setCaughtPokemonIds(caughtIds);
      } catch (error) {
        console.error('Error loading caught Pokemon:', error);
        setCaughtPokemonIds([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCaughtPokemon();

    // Subscribe to catch events
    const unsubscribe = pokemonManager.onPokemonCaught((pokemonId) => {
      setCaughtPokemonIds(prev => {
        if (!prev.includes(pokemonId)) {
          return [...prev, pokemonId].sort((a, b) => a - b);
        }
        return prev;
      });
    });

    return () => unsubscribe();
  }, [user, isPremium, authLoading]);

  const getAllPokemon = (): PokemonInfo[] => {
    const allPokemon: PokemonInfo[] = [];

    // Generate based on loaded count (only Pokemon we have names for)
    const availableIds = Object.keys(POKEMON_NAMES).map(id => parseInt(id));
    const maxId = Math.min(loadedPokemonCount, Math.max(...availableIds));

    for (const idStr of Object.keys(POKEMON_NAMES)) {
      const id = parseInt(idStr);
      if (id <= maxId) {
        const isCaught = caughtPokemonIds.includes(id);
        allPokemon.push({
          id,
          name: getPokemonName(id),
          caught: isCaught,
          rarity: getPokemonRarity(id)
        });
      }
    }

    return allPokemon.sort((a, b) => a.id - b.id);
  };

  const getCaughtPokemon = (): PokemonInfo[] => {
    return caughtPokemonIds
      .filter(id => POKEMON_NAMES[id]) // Only show Pokemon we have names for
      .sort((a, b) => a - b)
      .map(id => ({
        id,
        name: getPokemonName(id),
        caught: true,
        rarity: getPokemonRarity(id)
      }));
  };

  const renderPokemonGrid = () => {
    const pokemonList = activeTab === 'caught' ? getCaughtPokemon() : getAllPokemon();

    if (activeTab === 'caught' && pokemonList.length === 0 && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <DoshiMascot size="large" mood="thinking" />
          <p className="text-gray-500 dark:text-gray-400 text-center mt-4">
            No Pokémon caught yet!<br />
            Keep playing to catch them all!
          </p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <DoshiMascot size="medium" mood="thinking" />
          <p className="text-gray-500 dark:text-gray-400 mt-4">Loading Pokédex...</p>
        </div>
      );
    }

    return (
      <div className="px-2 md:px-3 py-2 md:py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {pokemonList.map((pokemon) => (
            <motion.div
              key={pokemon.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              onClick={() => pokemon.caught && setSelectedPokemon(pokemon.id)}
              className={`relative rounded-xl p-2 transition-all cursor-pointer ${
                pokemon.caught
                  ? 'bg-white dark:bg-dark-800 border-2 border-gray-200 dark:border-dark-600 hover:border-primary-400 hover:shadow-lg transform hover:scale-105'
                  : 'bg-gray-100 dark:bg-dark-900 border-2 border-gray-200 dark:border-dark-700 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex flex-col items-center justify-between" style={{ minHeight: '120px' }}>
                <div className="flex-1 flex items-center justify-center w-full" style={{ height: '80px' }}>
                  <img
                    src={getPokemonSpriteUrl(pokemon.id)}
                    alt={pokemon.name}
                    className="w-full h-full object-contain p-1"
                    style={pokemon.caught ? {} : getPokemonSilhouetteStyle()}
                    onError={(e) => {
                      // Fallback for missing sprites
                      e.currentTarget.src = '/images/pokeball.png';
                    }}
                  />
                </div>
                <div className="text-center mt-2 pb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    pokemon.caught
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-500 dark:text-gray-500'
                  }`}>
                    #{pokemon.id.toString().padStart(3, '0')}
                  </span>
                </div>
              </div>

              {/* Caught indicator with rarity */}
              {pokemon.caught && (
                <div className="absolute top-1 right-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${getRarityColorClasses(pokemon.rarity)}`}>
                    {pokemon.rarity[0].toUpperCase()}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Load More Button */}
        {activeTab === 'all' && loadedPokemonCount < 251 && (
          <div className="flex justify-center p-2 pb-16 md:pb-4">
            <button
              onClick={() => {
                const nextCount = Math.min(loadedPokemonCount + 50, 251);
                setLoadedPokemonCount(nextCount);
              }}
              className="flex items-center gap-3 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-semibold transition-all transform hover:scale-105 shadow-lg"
            >
              <DoshiMascot size="xsmall" mood="excited" />
              <span>Load More Pokémon ({loadedPokemonCount} / 251)</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden">
      {/* Header with Pokemon theme using moshimoshi colors */}
      <div className="relative bg-gradient-to-r from-primary-500 to-primary-600 px-2 py-3 sm:p-3 rounded-t-2xl">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden rounded-t-2xl">
          <div className="absolute inset-0 bg-repeat" style={{
            backgroundImage: `radial-gradient(circle, white 2px, transparent 2px)`,
            backgroundSize: '30px 30px'
          }} />
        </div>

        <div className="relative flex items-center justify-between px-2 sm:px-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl sm:text-2xl">📱</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Pokédex</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm sm:text-base text-white/90">
                  {caughtPokemonIds.length} Pokémon Caught
                </span>
                {isPremium && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                    Premium
                  </span>
                )}
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors mr-2 sm:mr-0"
              aria-label="Close Pokédex"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-6 relative z-10">
          <button
            type="button"
            onClick={() => setActiveTab('caught')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'caught'
                ? 'bg-white text-primary-600 shadow-lg'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span>🎯</span>
            Caught ({caughtPokemonIds.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setLoadedPokemonCount(151); // Reset when switching tabs
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-white text-primary-600 shadow-lg'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span>📋</span>
            All Pokémon
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-900">
        {renderPokemonGrid()}
      </div>

      {/* Selected Pokemon Detail */}
      <AnimatePresence>
        {selectedPokemon && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-dark-800 rounded-t-3xl shadow-2xl p-3 z-50"
            onClick={() => setSelectedPokemon(null)}
          >
            <div className="flex items-center gap-4">
              <img
                src={getPokemonSpriteUrl(selectedPokemon)}
                alt={getPokemonName(selectedPokemon)}
                className="w-32 h-32 object-contain"
              />
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {getPokemonName(selectedPokemon)}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  #{selectedPokemon.toString().padStart(3, '0')}
                </p>
                <div className="mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    getRarityColorClasses(getPokemonRarity(selectedPokemon))
                  }`}>
                    {getPokemonRarity(selectedPokemon)} Pokémon
                  </span>
                </div>
              </div>
              <DoshiMascot size="small" mood="happy" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}