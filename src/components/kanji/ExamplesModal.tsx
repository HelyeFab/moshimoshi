'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import AudioButton from '@/components/ui/AudioButton'
import { LoadingSpinner } from '@/components/ui/Loading'
import { useTTS } from '@/hooks/useTTS'
import { useI18n } from '@/i18n/I18nContext'
import AddToListButton from '@/components/lists/AddToListButton'
import { TatoebaSentence } from '@/utils/tatoeba-client'

interface ExamplesModalProps {
  kanji: string
  sentences: TatoebaSentence[]
  furiganaTexts: Record<string, string>
  isOpen: boolean
  onClose: () => void
  loading?: boolean
}

export default function ExamplesModal({
  kanji,
  sentences,
  furiganaTexts,
  isOpen,
  onClose,
  loading = false,
}: ExamplesModalProps) {
  const { strings } = useI18n()
  const { play, preload, loading: ttsLoading, playing, currentText } = useTTS({ cacheFirst: true })
  const [showFurigana, setShowFurigana] = useState(true)

  useEffect(() => {
    if (!isOpen || sentences.length === 0) return
    const texts = sentences
      .map(sentence => sentence.japanese)
      .filter(Boolean)
      .slice(0, 5)
    if (texts.length > 0) {
      preload(texts, { voice: '23', speed: 0.85 })
    }
  }, [isOpen, sentences, preload])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${strings?.kanji?.examples || 'Examples'}: ${kanji}`}
      size="lg"
    >
      <div className="p-6">
        {/* Furigana Toggle */}
        {sentences.length > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowFurigana(!showFurigana)}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {showFurigana ? 'Hide' : 'Show'} Furigana
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="small" />
          </div>
        ) : sentences.length > 0 ? (
          <div className="space-y-3">
            {sentences.map((sentence, index) => (
              <div
                key={sentence.id || index}
                className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-4"
              >
                <div className="space-y-3">
                  {/* Japanese with furigana */}
                  <div className="text-lg text-gray-900 dark:text-gray-100 font-medium leading-relaxed">
                    {showFurigana && furiganaTexts[sentence.japanese] ? (
                      <span
                        dangerouslySetInnerHTML={{
                          __html: furiganaTexts[sentence.japanese].replace(
                            new RegExp(`(${kanji})`, 'g'),
                            '<span class="text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-900/20 px-1 rounded">$1</span>'
                          ),
                        }}
                      />
                    ) : (
                      sentence.japanese.split(kanji).map((part, i, arr) => (
                        <span key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <span className="text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-900/20 px-1 rounded">
                              {kanji}
                            </span>
                          )}
                        </span>
                      ))
                    )}
                  </div>

                  {/* English translation */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {sentence.english}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <AudioButton
                      size="sm"
                      onPlay={() => play(sentence.japanese, { voice: '23', speed: 0.85 })}
                      loading={ttsLoading && currentText === sentence.japanese}
                      playing={playing && currentText === sentence.japanese}
                    />
                    <AddToListButton
                      content={sentence.japanese}
                      type="sentence"
                      metadata={{
                        meaning: sentence.english,
                        notes: `Contains ${kanji}`,
                      }}
                      variant="bookmark"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No sentences found in Tatoeba for this kanji.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
