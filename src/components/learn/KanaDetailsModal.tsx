'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import StrokeOrderModal from '@/components/kanji/StrokeOrderModal'
import DrawingPracticeModal from '@/components/drawing-practice/DrawingPracticeModal'
import { KanaCharacter, playKanaAudio } from '@/data/kanaData'
import { kanjiService } from '@/services/kanjiService'
import { LoadingSpinner } from '@/components/ui/Loading'
import { motion } from 'framer-motion'

interface KanaDetailsModalProps {
  character: KanaCharacter | null
  isOpen: boolean
  onClose: () => void
  displayScript?: 'hiragana' | 'katakana'
}

export default function KanaDetailsModal({
  character,
  isOpen,
  onClose,
  displayScript = 'hiragana'
}: KanaDetailsModalProps) {
  const [showStrokeOrder, setShowStrokeOrder] = useState(false)
  const [showDrawingPractice, setShowDrawingPractice] = useState(false)
  const [strokeCount, setStrokeCount] = useState<number | null>(null)
  const [loadingStrokes, setLoadingStrokes] = useState(false)

  const currentChar = character ? (displayScript === 'hiragana' ? character.hiragana : character.katakana) : ''
  const alternateChar = character ? (displayScript === 'hiragana' ? character.katakana : character.hiragana) : ''

  // Fetch stroke count when modal opens
  useEffect(() => {
    if (isOpen && currentChar) {
      fetchStrokeCount(currentChar)
    }
  }, [isOpen, currentChar])

  const fetchStrokeCount = async (char: string) => {
    setLoadingStrokes(true)
    try {
      const svgText = await kanjiService.getStrokeOrderSVG(char)
      if (svgText) {
        const count = kanjiService.getStrokeCount(svgText)
        setStrokeCount(count)
      } else {
        setStrokeCount(null)
      }
    } catch (error) {
      console.error('Error fetching stroke count:', error)
      setStrokeCount(null)
    } finally {
      setLoadingStrokes(false)
    }
  }

  const handlePlayAudio = () => {
    if (character?.id) {
      playKanaAudio(character.id, displayScript)
    }
  }

  if (!character) return null

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        size="lg"
        showCloseButton={true}
      >
        <div className="p-6">
          {/* Large Kana Display */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, type: 'spring' }}
              className="inline-block"
            >
              <div
                className="text-8xl sm:text-9xl font-bold text-gray-900 dark:text-gray-100 mb-4 font-japanese"
              >
                {currentChar}
              </div>
            </motion.div>

            {/* Alternate Script and Stroke Count */}
            <div className="flex items-center justify-center gap-3">
              <span className="px-3 py-1.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg">
                {alternateChar}
              </span>
              {loadingStrokes ? (
                <div className="px-3 py-1.5 bg-gray-100 dark:bg-dark-700 rounded-lg">
                  <LoadingSpinner size="xsmall" />
                </div>
              ) : strokeCount !== null ? (
                <button
                  onClick={() => setShowStrokeOrder(true)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {strokeCount} strokes
                </button>
              ) : null}
              <button
                onClick={() => setShowDrawingPractice(true)}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                title="Practice drawing"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Practice
              </button>
              <button
                onClick={handlePlayAudio}
                className="px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
                title="Play audio"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
                Audio
              </button>
            </div>
          </div>

          {/* Character Information */}
          <div className="space-y-6">
            {/* Romaji */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Romaji
              </h3>
              <div className="text-xl font-medium text-gray-900 dark:text-gray-100">
                {character.romaji}
              </div>
            </div>

            {/* Type Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Type
                </h3>
                <div className="px-3 py-1 inline-block bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg">
                  {character.type === 'vowel' && 'Vowel'}
                  {character.type === 'consonant' && 'Consonant'}
                  {character.type === 'dakuten' && 'Dakuten'}
                  {character.type === 'handakuten' && 'Handakuten'}
                  {character.type === 'digraph' && 'Digraph'}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Position
                </h3>
                <div className="text-base text-gray-700 dark:text-gray-300">
                  {character.row} row ({character.column} column)
                </div>
              </div>
            </div>

            {/* Pronunciation Note */}
            {character.pronunciation && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Pronunciation Note
                </h3>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    {character.pronunciation}
                  </p>
                </div>
              </div>
            )}

            {/* Common Words */}
            {character.mnemonicWord && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Mnemonic Helper
                </h3>
                <div className="text-base text-gray-700 dark:text-gray-300">
                  {character.mnemonicWord}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Stroke Order Modal */}
      {showStrokeOrder && (
        <StrokeOrderModal
          character={currentChar}
          isOpen={showStrokeOrder}
          onClose={() => setShowStrokeOrder(false)}
        />
      )}

      {/* Drawing Practice Modal */}
      {showDrawingPractice && (
        <DrawingPracticeModal
          character={currentChar}
          isOpen={showDrawingPractice}
          onClose={() => setShowDrawingPractice(false)}
          characterType="kana"
        />
      )}
    </>
  )
}