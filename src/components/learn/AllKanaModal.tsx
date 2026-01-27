'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Modal from '@/components/ui/Modal'
import { kanaData, KanaCharacter, playKanaAudio } from '@/data/kanaData'
import { useI18n } from '@/i18n/I18nContext'

interface AllKanaModalProps {
  isOpen: boolean
  onClose: () => void
  displayScript: 'hiragana' | 'katakana'
  showBothKana?: boolean
  onCharacterSelect?: (character: KanaCharacter) => void
}

// Row order for display
const ROW_ORDER = [
  'vowel',
  'k',
  's',
  't',
  'n',
  'h',
  'm',
  'y',
  'r',
  'w', // Basic rows
  'g',
  'z',
  'd',
  'b',
  'p', // Dakuten/Handakuten rows
  'k-digraph',
  's-digraph',
  'c-digraph',
  'n-digraph',
  'h-digraph',
  'm-digraph',
  'r-digraph', // Basic digraphs
  'g-digraph',
  'j-digraph',
  'b-digraph',
  'p-digraph', // Dakuten digraphs
]

// Row metadata
const ROW_INFO: Record<string, { name: string; color: string; emoji: string }> = {
  vowel: { name: 'Vowels', color: 'bg-purple-500', emoji: 'あ' },
  k: { name: 'K-row', color: 'bg-blue-500', emoji: 'か' },
  s: { name: 'S-row', color: 'bg-cyan-500', emoji: 'さ' },
  t: { name: 'T-row', color: 'bg-green-500', emoji: 'た' },
  n: { name: 'N-row', color: 'bg-yellow-500', emoji: 'な' },
  h: { name: 'H-row', color: 'bg-amber-500', emoji: 'は' },
  m: { name: 'M-row', color: 'bg-pink-500', emoji: 'ま' },
  y: { name: 'Y-row', color: 'bg-rose-500', emoji: 'や' },
  r: { name: 'R-row', color: 'bg-fuchsia-500', emoji: 'ら' },
  w: { name: 'W-row', color: 'bg-violet-500', emoji: 'わ' },
  g: { name: 'G-row (Dakuten)', color: 'bg-indigo-500', emoji: 'が' },
  z: { name: 'Z-row (Dakuten)', color: 'bg-teal-500', emoji: 'ざ' },
  d: { name: 'D-row (Dakuten)', color: 'bg-lime-500', emoji: 'だ' },
  b: { name: 'B-row (Dakuten)', color: 'bg-orange-500', emoji: 'ば' },
  p: { name: 'P-row (Handakuten)', color: 'bg-red-500', emoji: 'ぱ' },
  'k-digraph': { name: 'KY-digraphs', color: 'bg-blue-600', emoji: 'きゃ' },
  's-digraph': { name: 'SH-digraphs', color: 'bg-cyan-600', emoji: 'しゃ' },
  'c-digraph': { name: 'CH-digraphs', color: 'bg-green-600', emoji: 'ちゃ' },
  'n-digraph': { name: 'NY-digraphs', color: 'bg-yellow-600', emoji: 'にゃ' },
  'h-digraph': { name: 'HY-digraphs', color: 'bg-amber-600', emoji: 'ひゃ' },
  'm-digraph': { name: 'MY-digraphs', color: 'bg-pink-600', emoji: 'みゃ' },
  'r-digraph': { name: 'RY-digraphs', color: 'bg-fuchsia-600', emoji: 'りゃ' },
  'g-digraph': { name: 'GY-digraphs', color: 'bg-indigo-600', emoji: 'ぎゃ' },
  'j-digraph': { name: 'J-digraphs', color: 'bg-teal-600', emoji: 'じゃ' },
  'b-digraph': { name: 'BY-digraphs', color: 'bg-orange-600', emoji: 'びゃ' },
  'p-digraph': { name: 'PY-digraphs', color: 'bg-red-600', emoji: 'ぴゃ' },
}

export default function AllKanaModal({
  isOpen,
  onClose,
  displayScript,
  showBothKana = false,
  onCharacterSelect,
}: AllKanaModalProps) {
  const { t } = useI18n()
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Group characters by row
  const charactersByRow = useMemo(() => {
    const rows = new Map<string, KanaCharacter[]>()

    kanaData.forEach(char => {
      let rowKey = char.row
      // Special handling for digraphs
      if (char.type === 'digraph') {
        const baseRow = char.id.slice(0, -1)
        rowKey = `${baseRow}-digraph`
      }
      // Special handling for single 'n'
      if (char.id === 'n' && char.row === 'n') {
        // This is the standalone 'n' (ん), keep it with n-row
        rowKey = 'n'
      }

      if (!rows.has(rowKey)) {
        rows.set(rowKey, [])
      }
      rows.get(rowKey)!.push(char)
    })

    // Sort characters within each row
    rows.forEach(chars => {
      chars.sort((a, b) => {
        const columnOrder = ['a', 'i', 'u', 'e', 'o']
        return columnOrder.indexOf(a.column) - columnOrder.indexOf(b.column)
      })
    })

    return rows
  }, [])

  // Get ordered rows
  const orderedRows = useMemo(() => {
    return ROW_ORDER.filter(key => charactersByRow.has(key))
  }, [charactersByRow])

  const handlePlayAudio = async (char: KanaCharacter) => {
    setPlayingId(char.id)
    try {
      await playKanaAudio(char.id, displayScript)
    } catch (error) {
      console.error('Failed to play audio:', error)
    } finally {
      setPlayingId(null)
    }
  }

  const handleCharacterClick = (char: KanaCharacter) => {
    if (onCharacterSelect) {
      onCharacterSelect(char)
    } else {
      handlePlayAudio(char)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span className="text-2xl">{displayScript === 'hiragana' ? 'あ' : 'ア'}</span>
          <span>{t('kana.browse.allCharacters')}</span>
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            ({kanaData.length})
          </span>
        </div>
      }
      size="lg"
      noPadding
    >
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {orderedRows.map(rowKey => {
          const chars = charactersByRow.get(rowKey) || []
          const info = ROW_INFO[rowKey] || { name: rowKey, color: 'bg-gray-500', emoji: '?' }

          return (
            <div key={rowKey} className="py-4 px-4 sm:px-6">
              {/* Row Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-8 h-8 ${info.color} rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0`}
                >
                  {displayScript === 'hiragana'
                    ? info.emoji.charAt(0)
                    : chars[0]?.katakana.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{info.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {chars.length} characters
                  </p>
                </div>
              </div>

              {/* Characters */}
              <div className="flex flex-wrap gap-2">
                {chars.map(char => (
                  <motion.button
                    key={char.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCharacterClick(char)}
                    className={`
                      flex flex-col items-center justify-center
                      w-16 h-20 rounded-lg
                      bg-gray-50 dark:bg-dark-700
                      border-2 border-gray-200 dark:border-dark-600
                      hover:border-primary-400 dark:hover:border-primary-500
                      hover:bg-primary-50 dark:hover:bg-primary-900/20
                      transition-colors cursor-pointer
                      ${playingId === char.id ? 'ring-2 ring-primary-500 animate-pulse' : ''}
                    `}
                  >
                    {/* Main character */}
                    <span
                      className="text-2xl font-medium text-gray-900 dark:text-gray-100"
                      style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
                    >
                      {displayScript === 'hiragana' ? char.hiragana : char.katakana}
                    </span>

                    {/* Secondary script (if showing both) */}
                    {showBothKana && (
                      <span
                        className="text-xs text-gray-400 dark:text-gray-500"
                        style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
                      >
                        {displayScript === 'hiragana' ? char.katakana : char.hiragana}
                      </span>
                    )}

                    {/* Romaji */}
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {char.romaji}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
