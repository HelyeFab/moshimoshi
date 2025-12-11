'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { kanaData, KanaCharacter } from '@/data/kanaData';
import { KanaChar } from '../types';
import { useI18n } from '@/i18n/I18nContext';

interface KanaSelectionProps {
  onStartGame: (selectedKana: KanaChar[]) => void;
  onCancel: () => void;
}

export default function KanaSelection({ onStartGame, onCancel }: KanaSelectionProps) {
  const [chartType, setChartType] = useState<'hiragana' | 'katakana'>('hiragana');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showRomaji, setShowRomaji] = useState(true);
  const { t } = useI18n();

  // Get basic kana (no digraphs or special characters)
  const basicKana = kanaData.filter(k =>
    k.type !== 'digraph' &&
    !['wi', 'we', 'wo'].includes(k.id)
  );

  const handleToggleKana = (kanaId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(`${kanaId}-${chartType}`)) {
      newSelection.delete(`${kanaId}-${chartType}`);
    } else {
      // Check if adding this would exceed the limit
      if (newSelection.size >= 10) {
        return; // Silently prevent adding more than 10
      }
      newSelection.add(`${kanaId}-${chartType}`);
    }
    setSelectedIds(newSelection);
  };

  const handleStartGame = () => {
    const selectedKanaData: KanaChar[] = [];

    selectedIds.forEach(fullId => {
      const [id, type] = fullId.split('-');
      const kana = kanaData.find(k => k.id === id);
      if (kana) {
        selectedKanaData.push({
          id: fullId,
          kana: type === 'hiragana' ? kana.hiragana : kana.katakana,
          romaji: kana.romaji,
          type: type as 'hiragana' | 'katakana'
        });
      }
    });

    if (selectedKanaData.length === 0) {
      // Use default set if nothing selected
      const defaultKana = basicKana.slice(0, 5).map(k => ({
        id: `${k.id}-hiragana`,
        kana: k.hiragana,
        romaji: k.romaji,
        type: 'hiragana' as const
      }));
      onStartGame(defaultKana);
    } else {
      onStartGame(selectedKanaData);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Group kana by row
  const kanaByRow: { [key: string]: KanaCharacter[] } = {};
  basicKana.forEach(k => {
    const row = k.row;
    if (!kanaByRow[row]) kanaByRow[row] = [];
    kanaByRow[row].push(k);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="text-center py-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('games.selectKana')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('games.selectKanaDescription')}
        </p>
      </div>

      {/* Chart Type Toggle */}
      <div className="flex justify-center gap-2 mb-4">
        <button
          onClick={() => setChartType('hiragana')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            chartType === 'hiragana'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-700'
          }`}
        >
          ひらがな Hiragana
        </button>
        <button
          onClick={() => setChartType('katakana')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            chartType === 'katakana'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-700'
          }`}
        >
          カタカナ Katakana
        </button>
      </div>

      {/* Options */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showRomaji}
            onChange={(e) => setShowRomaji(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('games.showRomaji')}
          </span>
        </label>

        {selectedIds.size > 0 && (
          <button
            onClick={clearSelection}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {t('games.clearSelection')} ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Kana Grid */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="w-full space-y-4 flex flex-col items-center">
          {Object.entries(kanaByRow).map(([rowName, rowKana]) => (
            <div key={rowName} className="flex flex-wrap justify-center gap-2 max-w-full">
              {rowKana.map(kana => {
                  const isSelected = selectedIds.has(`${kana.id}-${chartType}`);
                  return (
                    <motion.button
                      key={kana.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleToggleKana(kana.id)}
                      disabled={!isSelected && selectedIds.size >= 10}
                      className={`
                        relative p-3 rounded-lg border-2 transition-all
                        ${isSelected
                          ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 dark:border-primary-400'
                          : 'bg-white dark:bg-dark-800 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }
                        ${!isSelected && selectedIds.size >= 10 ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {chartType === 'hiragana' ? kana.hiragana : kana.katakana}
                      </div>
                      {showRomaji && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {kana.romaji}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-primary-500 dark:bg-primary-400 rounded-full" />
                      )}
                    </motion.button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-850">
        <div className="text-center space-y-4">
          <div className={`text-sm ${
            selectedIds.size > 10
              ? 'text-red-600 dark:text-red-400 font-medium'
              : 'text-gray-600 dark:text-gray-400'
          }`}>
            {selectedIds.size} {t('games.charactersSelected')}
            {selectedIds.size > 10
              ? ` (${t('games.tooMany')})`
              : selectedIds.size === 0
              ? ` (${t('games.defaultWillBeUsed')})`
              : ' (1-10)'}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleStartGame}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              {t('games.startGame')} {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}