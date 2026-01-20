'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import MoodBoardManager from '@/components/admin/MoodBoardManager'
import GenerateKanjiMoodboardModal from '@/components/admin/GenerateKanjiMoodboardModal'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useMoodBoards } from '@/hooks/useMoodBoards'

// Helper function to adjust color brightness with better color preservation
function adjustColor(color: string, amount: number): string {
  // If it's already a color function like rgb() or hsl(), return as-is
  if (color.includes('(')) return color

  // Convert hex to RGB
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Use percentage-based darkening to preserve color vibrancy
  const factor = amount < 0 ? 1 + (amount / 100) : 1 + (amount / 100)

  const newR = Math.max(0, Math.min(255, Math.round(r * factor)))
  const newG = Math.max(0, Math.min(255, Math.round(g * factor)))
  const newB = Math.max(0, Math.min(255, Math.round(b * factor)))

  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`
}

export default function AdminMoodboardsPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const { showToast } = useToast()

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const { createMoodBoard } = useMoodBoards()

  const handleMoodboardGenerated = async (data: any) => {
    console.log('📥 handleMoodboardGenerated called with:', {
      generateStory: data.generateStory,
      hasKanjiList: !!data.kanjiList,
      kanjiCount: data.kanjiList?.length,
    })

    try {
      // Transform the generated data into moodboard format
      const moodboard = {
        title: data.category || data.title,
        description: data.description,
        emoji: data.emoji,
        jlpt: data.jlptLevel || 'N5',
        background: data.themeColor
          ? `linear-gradient(135deg, ${data.themeColor} 0%, ${adjustColor(data.themeColor, -25)} 100%)`
          : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        kanji: data.kanjiList.map((item: any) => ({
          char: item.kanji,
          meaning: item.meaning,
          onyomi: item.onyomi || [],
          kunyomi: item.kunyomi || [],
          jlpt: item.jlptLevel,
          strokeCount: item.strokeCount,
          examples: item.examples || [],
          tags: item.tags || [],
        })),
        isActive: true,
        sortOrder: 0,
      }

      // Create the moodboard
      const moodboardId = await createMoodBoard(moodboard)
      console.log('✅ Moodboard created with ID:', moodboardId)

      // If user also wanted to generate a story
      if (data.generateStory && moodboardId) {
        console.log('🎯 Starting story generation for moodboard:', moodboardId)
        showToast(t('admin.moodboard.success.storyGenerating'), 'info')

        try {
          const storyResponse = await fetch('/api/admin/generate-story-from-moodboard', {
            method: 'POST',
            credentials: 'include', // Send session cookie
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              moodboardId: moodboardId,
            }),
          })

          const storyData = await storyResponse.json()
          console.log('📖 Story generation response:', storyResponse.status, storyData)

          if (storyResponse.ok && storyData.success) {
            showToast(
              t('admin.moodboard.success.storyCreated', {
                title: storyData.story?.title || 'Story',
              }),
              'success'
            )
          } else {
            console.error('❌ Story generation failed:', storyData.error || 'Unknown error')
            showToast(storyData.error || t('admin.moodboard.errors.storyFailed'), 'error')
          }
        } catch (storyError) {
          console.error('❌ Error generating story:', storyError)
          showToast(t('admin.moodboard.errors.storyFailed'), 'warning')
        }
      } else {
        console.log('⏭️ Story generation skipped:', {
          generateStory: data.generateStory,
          moodboardId,
        })
      }

      setShowGenerateModal(false)
    } catch (error) {
      console.error('Error creating moodboard:', error)
      showToast(t('admin.moodboard.errors.createFailed'), 'error')
    }
  }

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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
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
  )
}
