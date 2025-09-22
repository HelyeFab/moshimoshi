'use client';

import { useState, useEffect } from 'react';
import { MoodBoard, KanjiItem } from '@/types/moodboard';
import { useI18n } from '@/i18n/I18nContext';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface MoodBoardEditorProps {
  board: MoodBoard | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (board: Partial<MoodBoard>) => Promise<void>;
}

const THEME_COLORS = [
  { name: 'Sakura Pink', value: '#FFB6C1' },
  { name: 'Ocean Blue', value: '#87CEEB' },
  { name: 'Matcha Green', value: '#98D98E' },
  { name: 'Sunset Orange', value: '#FFA07A' },
  { name: 'Lavender', value: '#E6E6FA' },
  { name: 'Golden', value: '#FFD700' },
  { name: 'Mint', value: '#98FB98' },
  { name: 'Coral', value: '#FF7F50' }
];

const EMOJI_OPTIONS = ['📚', '🌸', '🎌', '🗾', '🍵', '🏯', '⛩️', '🌊', '🎎', '🍜', '🍱', '🎋', '🏔️', '🌅'];

export default function MoodBoardEditor({
  board,
  isOpen,
  onClose,
  onSave
}: MoodBoardEditorProps) {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    emoji: '📚',
    jlpt: 'N5' as 'N5' | 'N4' | 'N3' | 'N2' | 'N1',
    background: '#FFB6C1',
    kanji: [] as KanjiItem[]
  });

  const [newKanjiText, setNewKanjiText] = useState('');
  const [editingKanjiIndex, setEditingKanjiIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (board) {
      setFormData({
        title: board.title,
        description: board.description,
        emoji: board.emoji,
        jlpt: board.jlpt,
        background: board.background,
        kanji: [...board.kanji]
      });
    } else {
      setFormData({
        title: '',
        description: '',
        emoji: '📚',
        jlpt: 'N5',
        background: '#FFB6C1',
        kanji: []
      });
    }
  }, [board]);

  const handleAddKanji = () => {
    if (!newKanjiText.trim()) return;

    const lines = newKanjiText.split('\n').filter(line => line.trim());
    const newKanjiItems: KanjiItem[] = [];

    lines.forEach(line => {
      // Parse format: 漢|カン|から|Chinese|13
      // Or simple format: 漢,Chinese
      const parts = line.split(/[|,]/).map(p => p.trim());

      if (parts.length >= 2) {
        const char = parts[0];
        const meaning = parts[parts.length - 2] || parts[1];
        const strokeCount = parseInt(parts[parts.length - 1]) || 0;

        // Extract readings
        const onyomi: string[] = [];
        const kunyomi: string[] = [];

        for (let i = 1; i < parts.length - 2; i++) {
          const reading = parts[i];
          // If katakana, it's onyomi
          if (/[\u30A0-\u30FF]/.test(reading)) {
            onyomi.push(reading);
          } else if (/[\u3040-\u309F]/.test(reading)) {
            // If hiragana, it's kunyomi
            kunyomi.push(reading);
          }
        }

        newKanjiItems.push({
          char,
          meaning,
          readings: {
            on: onyomi,
            kun: kunyomi
          },
          jlpt: formData.jlpt,
          strokeCount,
          examples: []
        });
      }
    });

    if (newKanjiItems.length > 0) {
      setFormData(prev => ({
        ...prev,
        kanji: [...prev.kanji, ...newKanjiItems]
      }));
      setNewKanjiText('');
      showToast(`Added ${newKanjiItems.length} kanji`, 'success');
    }
  };

  const handleEditKanji = (index: number) => {
    setEditingKanjiIndex(index);
  };

  const handleSaveKanjiEdit = (index: number, updatedKanji: KanjiItem) => {
    setFormData(prev => ({
      ...prev,
      kanji: prev.kanji.map((k, i) => i === index ? updatedKanji : k)
    }));
    setEditingKanjiIndex(null);
  };

  const handleDeleteKanji = (index: number) => {
    setFormData(prev => ({
      ...prev,
      kanji: prev.kanji.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showToast(t('admin.moodboards.titleRequired'), 'error');
      return;
    }

    if (formData.kanji.length === 0) {
      showToast(t('admin.moodboards.kanjiRequired'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving moodboard:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground dark:text-dark-100">
            {board ? t('admin.moodboards.editBoard') : t('admin.moodboards.createBoard')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            disabled={isSaving}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('common.title')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
                disabled={isSaving}
              />
            </div>

            {/* JLPT Level */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('admin.moodboards.jlptLevel')}
              </label>
              <select
                value={formData.jlpt}
                onChange={(e) => setFormData(prev => ({ ...prev, jlpt: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
                disabled={isSaving}
              >
                <option value="N5">N5 - Beginner</option>
                <option value="N4">N4 - Elementary</option>
                <option value="N3">N3 - Intermediate</option>
                <option value="N2">N2 - Upper Intermediate</option>
                <option value="N1">N1 - Advanced</option>
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                {t('common.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-foreground dark:text-dark-100"
                disabled={isSaving}
              />
            </div>

            {/* Emoji */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('admin.moodboards.emoji')}
              </label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setFormData(prev => ({ ...prev, emoji }))}
                    className={`text-2xl p-2 rounded-lg border-2 transition-all ${
                      formData.emoji === emoji
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-dark-600 hover:border-gray-400'
                    }`}
                    disabled={isSaving}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Color */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('admin.moodboards.themeColor')}
              </label>
              <div className="flex flex-wrap gap-2">
                {THEME_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setFormData(prev => ({ ...prev, background: color.value }))}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      formData.background === color.value
                        ? 'border-gray-800 dark:border-white scale-110'
                        : 'border-gray-300 dark:border-dark-600'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    disabled={isSaving}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Kanji Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('admin.moodboards.kanjiList')}</h3>

            {/* Add Kanji */}
            <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium mb-2">
                {t('admin.moodboards.addKanji')}
              </label>
              <textarea
                value={newKanjiText}
                onChange={(e) => setNewKanjiText(e.target.value)}
                placeholder="Format: 漢|カン|から|Chinese|13
Or simple: 漢,Chinese"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-foreground dark:text-dark-100 font-mono text-sm"
                disabled={isSaving}
              />
              <button
                onClick={handleAddKanji}
                className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                disabled={isSaving}
              >
                {t('common.add')}
              </button>
            </div>

            {/* Kanji List */}
            <div className="space-y-2">
              {formData.kanji.map((kanji, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg p-3"
                >
                  {editingKanjiIndex === index ? (
                    // Edit mode
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2">
                        <input
                          value={kanji.char}
                          onChange={(e) => {
                            const updated = { ...kanji, char: e.target.value };
                            handleSaveKanjiEdit(index, updated);
                          }}
                          className="px-2 py-1 border border-gray-300 dark:border-dark-600 rounded bg-white dark:bg-dark-700"
                          placeholder="Kanji"
                        />
                        <input
                          value={kanji.meaning}
                          onChange={(e) => {
                            const updated = { ...kanji, meaning: e.target.value };
                            handleSaveKanjiEdit(index, updated);
                          }}
                          className="px-2 py-1 border border-gray-300 dark:border-dark-600 rounded bg-white dark:bg-dark-700"
                          placeholder="Meaning"
                        />
                        <input
                          value={kanji.readings.on.join(', ')}
                          onChange={(e) => {
                            const updated = {
                              ...kanji,
                              readings: {
                                ...kanji.readings,
                                on: e.target.value.split(',').map(r => r.trim()).filter(Boolean)
                              }
                            };
                            handleSaveKanjiEdit(index, updated);
                          }}
                          className="px-2 py-1 border border-gray-300 dark:border-dark-600 rounded bg-white dark:bg-dark-700"
                          placeholder="On readings"
                        />
                        <input
                          value={kanji.readings.kun.join(', ')}
                          onChange={(e) => {
                            const updated = {
                              ...kanji,
                              readings: {
                                ...kanji.readings,
                                kun: e.target.value.split(',').map(r => r.trim()).filter(Boolean)
                              }
                            };
                            handleSaveKanjiEdit(index, updated);
                          }}
                          className="px-2 py-1 border border-gray-300 dark:border-dark-600 rounded bg-white dark:bg-dark-700"
                          placeholder="Kun readings"
                        />
                      </div>
                      <button
                        onClick={() => setEditingKanjiIndex(null)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
                      >
                        {t('common.done')}
                      </button>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold font-japanese">{kanji.char}</span>
                        <div>
                          <div className="font-medium">{kanji.meaning}</div>
                          <div className="text-sm text-muted-foreground dark:text-dark-400">
                            {kanji.readings.on.length > 0 && (
                              <span>On: {kanji.readings.on.join('、')}</span>
                            )}
                            {kanji.readings.on.length > 0 && kanji.readings.kun.length > 0 && ' | '}
                            {kanji.readings.kun.length > 0 && (
                              <span>Kun: {kanji.readings.kun.join('、')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditKanji(index)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteKanji(index)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {formData.kanji.length === 0 && (
                <div className="text-center py-8 text-muted-foreground dark:text-dark-400">
                  {t('admin.moodboards.noKanjiAdded')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
            disabled={isSaving}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !formData.title.trim() || formData.kanji.length === 0}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('common.saving')}
              </span>
            ) : (
              t('common.save')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}