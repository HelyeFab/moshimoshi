'use client';

import React from 'react';
import { usePokemonCatch } from '@/hooks/usePokemonCatch';
import { getRandomPokemon, getPokemonName, getPokemonSmallSpriteUrl } from '@/data/pokemonData';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface TestPokemonCatchProps {
  isPremium?: boolean;
}

export default function TestPokemonCatch({ isPremium = false }: TestPokemonCatchProps) {
  const { catchPokemon, catchRandomPokemon, isLoading, lastCaughtPokemon } = usePokemonCatch({
    isPremium,
    source: 'reward'
  });

  const handleCatchSpecific = async () => {
    // Catch Pikachu as a test
    await catchPokemon(25);
  };

  const handleCatchRandom = async () => {
    await catchRandomPokemon();
  };

  const handleCatchStarter = async () => {
    // Catch a random starter Pokemon
    const starters = [1, 4, 7, 25, 133]; // Bulbasaur, Charmander, Squirtle, Pikachu, Eevee
    const randomStarter = starters[Math.floor(Math.random() * starters.length)];
    await catchPokemon(randomStarter);
  };

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <DoshiMascot size="small" mood="excited" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Test Pokemon Catching
        </h3>
      </div>

      <div className="space-y-4">
        {/* Buttons to test catching */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCatchSpecific}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>⚡</span>
            Catch Pikachu
          </button>

          <button
            onClick={handleCatchRandom}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>🎲</span>
            Catch Random
          </button>

          <button
            onClick={handleCatchStarter}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>🌟</span>
            Catch Starter
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent" />
            <span>Catching Pokemon...</span>
          </div>
        )}

        {/* Last caught display */}
        {lastCaughtPokemon && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Last Caught:</p>
            <div className="flex items-center gap-3">
              <img
                src={getPokemonSmallSpriteUrl(lastCaughtPokemon)}
                alt={getPokemonName(lastCaughtPokemon)}
                className="w-16 h-16"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {getPokemonName(lastCaughtPokemon)}
                </p>
                <p className="text-sm text-gray-500">
                  #{lastCaughtPokemon.toString().padStart(3, '0')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
          <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
            Testing Instructions:
          </p>
          <ul className="space-y-1 text-blue-700 dark:text-blue-400">
            <li>• Click any button to catch a Pokemon</li>
            <li>• Caught Pokemon will be saved to {isPremium ? 'Firebase & IndexedDB' : 'IndexedDB only'}</li>
            <li>• Check the Pokedex card on the homepage to see your collection</li>
            <li>• You can also run <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded">testCatchPokemon()</code> in the console</li>
          </ul>
        </div>
      </div>
    </div>
  );
}