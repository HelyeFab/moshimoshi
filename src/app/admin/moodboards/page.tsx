'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import MoodBoardManager from '@/components/admin/MoodBoardManager';
import GenerateKanjiMoodboardModal from '@/components/admin/GenerateKanjiMoodboardModal';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useMoodBoards } from '@/hooks/useMoodBoards';

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
  // If it's already a color function like rgb() or hsl(), return as-is
  if (color.includes('(')) return color;

  // Convert hex to RGB, adjust, and return hex
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = Math.max(0, Math.min(255, r + amount));
  const newG = Math.max(0, Math.min(255, g + amount));
  const newB = Math.max(0, Math.min(255, b + amount));

  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

export default function AdminMoodboardsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const { createMoodBoard } = useMoodBoards();

  const handleMoodboardGenerated = async (data: any) => {
    try {
      // Transform the generated data into moodboard format
      const moodboard = {
        title: data.category || data.title,
        description: data.description,
        emoji: data.emoji,
        jlpt: data.jlptLevel || 'N5',
        background: data.themeColor ?
          `linear-gradient(135deg, ${data.themeColor} 0%, ${adjustColor(data.themeColor, -20)} 100%)` :
          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        kanji: data.kanjiList.map((item: any) => ({
          char: item.kanji,
          meaning: item.meaning,
          onyomi: item.onyomi || [],
          kunyomi: item.kunyomi || [],
          jlpt: item.jlptLevel,
          strokeCount: item.strokeCount,
          examples: item.examples || [],
          tags: item.tags || []
        })),
        isActive: true,
        sortOrder: 0
      };

      // Create the moodboard
      const moodboardId = await createMoodBoard(moodboard);

      // If user also wanted to generate a story
      if (data.generateStory && moodboardId) {
        showToast('Moodboard created! Generating story...', 'info');

        try {
          const storyResponse = await fetch('/api/admin/generate-story-from-moodboard', {
            method: 'POST',
            credentials: 'include', // Send session cookie
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              moodboardId: moodboardId
            })
          });

          if (storyResponse.ok) {
            const storyData = await storyResponse.json();
            showToast(`Story "${storyData.title}" created successfully!`, 'success');
            // Optionally navigate to the story
            // router.push(`/stories/${storyData.id}`);
          }
        } catch (storyError) {
          console.error('Error generating story:', storyError);
          showToast('Moodboard created but story generation failed', 'warning');
        }
      }

      setShowGenerateModal(false);
    } catch (error) {
      console.error('Error creating moodboard:', error);
      showToast('Failed to create moodboard', 'error');
    }
  };

  // The admin layout handles authentication and admin checks
  // No need to check again here

  return (
    <div className="space-y-6">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-foreground dark:text-dark-100">
              {t('admin.moodboards.title')}
            </h1>

            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              {t('admin.moodboards.generateWithAI')}
            </button>
          </div>

          <p className="text-muted-foreground dark:text-dark-400">
            {t('admin.moodboards.description')}
          </p>
        </div>

        {/* Moodboard Manager Component */}
        <MoodBoardManager />

        {/* Generate Modal */}
        <GenerateKanjiMoodboardModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={handleMoodboardGenerated}
        />
      </div>
    </div>
  );
}