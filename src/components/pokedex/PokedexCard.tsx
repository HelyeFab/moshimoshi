'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { pokemonManager } from '@/utils/pokemonManager';
import { getPokemonSmallSpriteUrl, getPokemonName } from '@/data/pokemonData';
import { useAuth } from '@/hooks/useAuth';
import Modal from '@/components/ui/Modal';
import PokedexContent from './PokedexContent';

interface PokedexCardProps {
  isPremium?: boolean;
}

export default function PokedexCard({ isPremium = false }: PokedexCardProps) {
  const { user, loading: authLoading } = useAuth();
  const [caughtCount, setCaughtCount] = useState(0);
  const [recentCatch, setRecentCatch] = useState<number | null>(null);
  const [showPokedex, setShowPokedex] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const loadPokedexStats = async () => {
      // Skip if auth is still loading
      if (authLoading) {
        return;
      }

      try {
        setDataLoading(true);
        // Fetching caught Pokemon
        const caughtPokemon = await pokemonManager.getCaughtPokemon(user, isPremium);
        // Caught Pokemon loaded
        setCaughtCount(caughtPokemon.length);

        // Only show card if at least 1 Pokemon caught
        setIsVisible(caughtPokemon.length > 0);
        // Set visibility based on caught Pokemon

        // Get most recent catch
        if (caughtPokemon.length > 0) {
          setRecentCatch(caughtPokemon[caughtPokemon.length - 1]);
        }
      } catch (error) {
        console.error('[PokedexCard] Error loading Pokedex stats:', error);
        setIsVisible(false);
      } finally {
        setDataLoading(false);
      }
    };

    loadPokedexStats();

    // Subscribe to catch events
    const unsubscribe = pokemonManager.onPokemonCaught((pokemonId) => {
      setCaughtCount(prev => prev + 1);
      setRecentCatch(pokemonId);
      setIsVisible(true);
    });

    return () => unsubscribe();
  }, [user, isPremium, authLoading]);

  // Don't render anything while loading
  if (authLoading || dataLoading) {
    return null;
  }

  // Don't render if no Pokemon caught
  if (!isVisible) {
    return null;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-3 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
        onClick={() => setShowPokedex(true)}
      >

        {/* Content */}
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📱</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Pokédex
              </h3>
            </div>
            <span className="text-xs px-2 py-1 bg-primary-200 dark:bg-primary-800/50 text-primary-700 dark:text-primary-300 rounded-full">
              {isPremium ? 'Cloud Sync' : 'Local'}
            </span>
          </div>

          {/* Stats */}
          <div className="space-y-3">
            {/* Caught count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Pokémon Caught
              </span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {caughtCount}
              </span>
            </div>

            {/* Recent catch preview */}
            {recentCatch && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  Latest Catch
                </span>
                <div className="flex items-center gap-2">
                  <img
                    src={getPokemonSmallSpriteUrl(recentCatch)}
                    alt={getPokemonName(recentCatch)}
                    className="w-8 h-8"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getPokemonName(recentCatch)}
                  </span>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="pt-2">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mb-1">
                <span>Progress</span>
                <span>{Math.round((caughtCount / 151) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-gradient-to-r from-primary-400 to-primary-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((caughtCount / 151) * 100, 100)}%` }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                />
              </div>
            </div>
          </div>

          {/* Hover indicator */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
        </div>

        {/* Floating animation for Pokemon sprites */}
        {caughtCount > 0 && (
          <motion.div
            className="absolute -top-2 -right-2 w-12 h-12"
            animate={{
              y: [0, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-white dark:bg-dark-800 rounded-full shadow-lg" />
              <img
                src={getPokemonSmallSpriteUrl(recentCatch || 25)} // Pikachu as default
                alt="Pokemon"
                className="relative w-full h-full p-1"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Pokedex Modal */}
      <Modal
        isOpen={showPokedex}
        onClose={() => setShowPokedex(false)}
        title=""
        size="xl"
        showCloseButton={false}
        noPadding={true}
      >
        <PokedexContent
          userId={user?.uid}
          onClose={() => setShowPokedex(false)}
          isPremium={isPremium}
        />
      </Modal>
    </>
  );
}