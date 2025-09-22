'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import AudioButton from '@/components/ui/AudioButton'
import { useTTS } from '@/hooks/useTTS'
import { useI18n } from '@/i18n/I18nContext'

interface Example {
  word: string
  reading: string
  meaning: string
}

interface ExamplesModalProps {
  kanji: string
  examples: Example[]
  isOpen: boolean
  onClose: () => void
}

export default function ExamplesModal({
  kanji,
  examples,
  isOpen,
  onClose
}: ExamplesModalProps) {
  const { strings } = useI18n()
  const { play } = useTTS({ cacheFirst: true })

  const handlePlayAudio = async (text: string) => {
    try {
      await play(text, {
        voice: 'ja-JP',
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0
      })
    } catch (error) {
      console.error('TTS playback failed:', error)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${strings?.review?.kanji?.study?.examples || 'Examples'}: ${kanji}`}
      size="lg"
    >
      <div className="p-6">
        {examples && examples.length > 0 ? (
          <div className="space-y-4">
            {examples.map((example, idx) => (
              <div
                key={idx}
                className="p-4 bg-gray-50 dark:bg-dark-800 rounded-xl
                         border border-gray-200 dark:border-dark-600
                         hover:border-primary-300 dark:hover:border-primary-700
                         transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    {/* Japanese word with reading */}
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100"
                            style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                        {example.word}
                      </span>
                      <AudioButton
                        size="sm"
                        onPlay={() => handlePlayAudio(example.word)}
                      />
                    </div>

                    {/* Reading (furigana) */}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {example.reading}
                    </div>

                    {/* English meaning */}
                    <div className="text-base text-gray-700 dark:text-gray-300">
                      {example.meaning}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {strings?.review?.kanji?.study?.noExamples || 'No examples available'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}