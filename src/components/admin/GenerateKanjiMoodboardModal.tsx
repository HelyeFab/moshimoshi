'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useI18n } from '@/i18n/I18nContext';

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

interface GenerateKanjiMoodboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (moodboardData: any) => void;
}

export default function GenerateKanjiMoodboardModal({
  isOpen,
  onClose,
  onGenerated
}: GenerateKanjiMoodboardModalProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();

  const [theme, setTheme] = useState('');
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [kanjiCount, setKanjiCount] = useState(15);
  const [customTags, setCustomTags] = useState('');
  const [generateStory, setGenerateStory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!theme.trim()) {
      showToast(t('admin.moodboard.themeRequired'), 'error');
      return;
    }

    if (!user) return;

    setIsGenerating(true);

    try {
      const response = await fetch('/api/admin/generate-kanji-moodboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          theme,
          jlptLevel,
          kanjiCount,
          tags: customTags ? customTags.split(',').map(t => t.trim()).filter(Boolean) : [],
          generateStory
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate moodboard');
      }

      const moodboardData = await response.json();

      if (!moodboardData.kanjiList || !Array.isArray(moodboardData.kanjiList)) {
        throw new Error('Invalid response format');
      }

      showToast(`Generated ${moodboardData.kanjiList.length} kanji for "${theme}"`, 'success');

      // Pass both moodboard data and story preference
      onGenerated({ ...moodboardData, generateStory });
      onClose();

      // Reset form
      setTheme('');
      setCustomTags('');
      setKanjiCount(15);
      setGenerateStory(false);

    } catch (error) {
      console.error('Error generating moodboard:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to generate moodboard',
        'error'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground dark:text-dark-100">
            {t('admin.moodboard.generateWithAI')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            disabled={isGenerating}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Theme Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('admin.moodboard.theme')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g., family members, colors, emotions, nature..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground dark:text-dark-400 mt-1">
              {t('admin.moodboard.themeHint')}
            </p>
          </div>

          {/* JLPT Level */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('admin.moodboard.jlptLevel')}
            </label>
            <select
              value={jlptLevel}
              onChange={(e) => setJlptLevel(e.target.value as JLPTLevel)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
              disabled={isGenerating}
            >
              <option value="N5">N5 - Beginner</option>
              <option value="N4">N4 - Elementary</option>
              <option value="N3">N3 - Intermediate</option>
              <option value="N2">N2 - Upper Intermediate</option>
              <option value="N1">N1 - Advanced</option>
            </select>
            <p className="text-xs text-muted-foreground dark:text-dark-400 mt-1">
              {t('admin.moodboard.jlptHint')}
            </p>
          </div>

          {/* Kanji Count */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('admin.moodboard.kanjiCount')}: {kanjiCount}
            </label>
            <input
              type="range"
              min="10"
              max="20"
              value={kanjiCount}
              onChange={(e) => setKanjiCount(Number(e.target.value))}
              className="w-full"
              disabled={isGenerating}
            />
            <div className="flex justify-between text-xs text-muted-foreground dark:text-dark-400">
              <span>10</span>
              <span>20</span>
            </div>
          </div>

          {/* Custom Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('admin.moodboard.tags')} ({t('common.optional')})
            </label>
            <input
              type="text"
              value={customTags}
              onChange={(e) => setCustomTags(e.target.value)}
              placeholder="e.g., formal, informal, common, business"
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground dark:text-dark-400 mt-1">
              {t('admin.moodboard.tagsHint')}
            </p>
          </div>

          {/* Generate Story Checkbox */}
          <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <input
              type="checkbox"
              id="generateStory"
              checked={generateStory}
              onChange={(e) => setGenerateStory(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              disabled={isGenerating}
            />
            <label htmlFor="generateStory" className="flex-1 cursor-pointer">
              <div className="text-sm font-medium text-purple-900 dark:text-purple-100">
                {t('admin.moodboard.generateStoryToo') || 'Also generate a story with these kanji'}
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                {t('admin.moodboard.generateStoryHint') || 'Creates an interactive story using the same kanji for practice'}
              </div>
            </label>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              {t('admin.moodboard.howItWorks')}
            </h3>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• AI will generate relevant kanji based on your theme</li>
              <li>• Each kanji includes readings, meanings, and examples</li>
              <li>• You can edit the generated moodboard after creation</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
              disabled={isGenerating}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !theme.trim()}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('common.generating')}
                </span>
              ) : (
                t('admin.moodboard.generate')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}