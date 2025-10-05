'use client'

import { useState, memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KanaCharacter, playKanaAudio } from '@/data/kanaData'
import { useI18n } from '@/i18n/I18nContext'
import Checkbox from '@/components/ui/Checkbox'
import { LoadingSpinner } from '@/components/ui/Loading'

interface KanaGridProps {
  characters: KanaCharacter[]
  progress: Record<string, any>
  selectedCharacters?: KanaCharacter[]
  onCharacterSelect: (character: KanaCharacter) => void
  onTogglePin: (characterId: string) => void
  onTogglePinBatch?: (characterIds: string[], pinned: boolean) => void
  onToggleSelection?: (character: KanaCharacter) => void
  showBothKana: boolean
  displayScript?: 'hiragana' | 'katakana'
  viewMode?: 'browse' | 'study' | 'review'
  getCharacterId?: (charId: string) => string
}

const KanaGrid = memo(function KanaGrid({
  characters,
  progress,
  selectedCharacters = [],
  onCharacterSelect,
  onTogglePin,
  onTogglePinBatch,
  onToggleSelection,
  showBothKana,
  displayScript = 'hiragana',
  viewMode = 'browse',
  getCharacterId = (id) => id
}: KanaGridProps) {
  const { t } = useI18n()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(['vowel', 'k'])) // Start with vowels and k-row expanded
  
  // Group characters by row
  const charactersByRow = useMemo(() => {
    const rows = new Map<string, KanaCharacter[]>()
    
    characters.forEach(char => {
      let rowKey = char.row
      // Special grouping for digraphs
      if (char.type === 'digraph') {
        const baseRow = char.id.slice(0, -1) // Get base consonant (k from kya, s from sha, etc.)
        rowKey = `${baseRow}-digraph`
      }
      
      if (!rows.has(rowKey)) {
        rows.set(rowKey, [])
      }
      rows.get(rowKey)!.push(char)
    })
    
    // Sort characters within each row by column order
    rows.forEach((chars, key) => {
      chars.sort((a, b) => {
        const columnOrder = ['a', 'i', 'u', 'e', 'o']
        return columnOrder.indexOf(a.column) - columnOrder.indexOf(b.column)
      })
    })
    
    return rows
  }, [characters])
  
  // Get row labels and info
  const getRowInfo = (rowKey: string) => {
    const info: Record<string, { name: string; color: string; description: string }> = {
      'vowel': { name: 'Vowels', color: 'bg-purple-500', description: 'あ い う え お' },
      'k': { name: 'K-row', color: 'bg-blue-500', description: 'か き く け こ' },
      'g': { name: 'G-row', color: 'bg-indigo-500', description: 'が ぎ ぐ げ ご' },
      's': { name: 'S-row', color: 'bg-cyan-500', description: 'さ し す せ そ' },
      'z': { name: 'Z-row', color: 'bg-teal-500', description: 'ざ じ ず ぜ ぞ' },
      't': { name: 'T-row', color: 'bg-green-500', description: 'た ち つ て と' },
      'd': { name: 'D-row', color: 'bg-lime-500', description: 'だ ぢ づ で ど' },
      'n': { name: 'N-row', color: 'bg-yellow-500', description: 'な に ぬ ね の' },
      'h': { name: 'H-row', color: 'bg-amber-500', description: 'は ひ ふ へ ほ' },
      'b': { name: 'B-row', color: 'bg-orange-500', description: 'ば び ぶ べ ぼ' },
      'p': { name: 'P-row', color: 'bg-red-500', description: 'ぱ ぴ ぷ ぺ ぽ' },
      'm': { name: 'M-row', color: 'bg-pink-500', description: 'ま み む め も' },
      'y': { name: 'Y-row', color: 'bg-rose-500', description: 'や ゆ よ' },
      'r': { name: 'R-row', color: 'bg-fuchsia-500', description: 'ら り る れ ろ' },
      'w': { name: 'W-row', color: 'bg-violet-500', description: 'わ を' },
      'n-single': { name: 'N', color: 'bg-slate-500', description: 'ん' },
      'k-digraph': { name: 'KY-digraphs', color: 'bg-blue-600', description: 'きゃ きゅ きょ' },
      's-digraph': { name: 'SH-digraphs', color: 'bg-cyan-600', description: 'しゃ しゅ しょ' },
      'c-digraph': { name: 'CH-digraphs', color: 'bg-green-600', description: 'ちゃ ちゅ ちょ' },
      'n-digraph': { name: 'NY-digraphs', color: 'bg-yellow-600', description: 'にゃ にゅ にょ' },
      'h-digraph': { name: 'HY-digraphs', color: 'bg-amber-600', description: 'ひゃ ひゅ ひょ' },
      'm-digraph': { name: 'MY-digraphs', color: 'bg-pink-600', description: 'みゃ みゅ みょ' },
      'r-digraph': { name: 'RY-digraphs', color: 'bg-fuchsia-600', description: 'りゃ りゅ りょ' },
      'g-digraph': { name: 'GY-digraphs', color: 'bg-indigo-600', description: 'ぎゃ ぎゅ ぎょ' },
      'j-digraph': { name: 'J-digraphs', color: 'bg-teal-600', description: 'じゃ じゅ じょ' },
      'b-digraph': { name: 'BY-digraphs', color: 'bg-orange-600', description: 'びゃ びゅ びょ' },
      'p-digraph': { name: 'PY-digraphs', color: 'bg-red-600', description: 'ぴゃ ぴゅ ぴょ' },
    }
    return info[rowKey] || { name: rowKey.toUpperCase(), color: 'bg-gray-500', description: '' }
  }

  const toggleRow = (rowKey: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey)
      } else {
        newSet.add(rowKey)
      }
      return newSet
    })
  }
  
  const handleRowSelect = (rowKey: string, checked: boolean) => {
    const newSelectedRows = new Set(selectedRows)
    const rowChars = charactersByRow.get(rowKey) || []

    // In study/review modes, toggle selection instead of pinning
    if (viewMode === 'study' || viewMode === 'review') {
      if (onToggleSelection) {
        // Toggle selection for all characters in the row
        rowChars.forEach(char => {
          const isSelected = selectedCharacters.some(c => c.id === char.id)
          if (checked && !isSelected) {
            onToggleSelection(char)
          } else if (!checked && isSelected) {
            onToggleSelection(char)
          }
        })
      }
    } else {
      // In browse mode, toggle pinning
      if (onTogglePinBatch) {
        // Use batch operation if available
        const characterIds = rowChars
          .filter(char => checked ? !progress[getCharacterId(char.id)]?.pinned : progress[getCharacterId(char.id)]?.pinned)
          .map(char => char.id)

        if (characterIds.length > 0) {
          onTogglePinBatch(characterIds, checked)
        }
      } else {
        // Fallback to individual operations
        if (checked) {
          newSelectedRows.add(rowKey)
          // Pin all characters in this row
          rowChars.forEach(char => {
            if (!progress[getCharacterId(char.id)]?.pinned) {
              onTogglePin(char.id)
            }
          })
        } else {
          newSelectedRows.delete(rowKey)
          // Unpin all characters in this row
          rowChars.forEach(char => {
            if (progress[getCharacterId(char.id)]?.pinned) {
              onTogglePin(char.id)
            }
          })
        }
      }
    }

    if (checked) {
      newSelectedRows.add(rowKey)
    } else {
      newSelectedRows.delete(rowKey)
    }

    setSelectedRows(newSelectedRows)
  }
  
  const getCharacterStyles = (characterId: string) => {
    // Simple styling - no special selection state since we use pin emoji
    // Match KanjiBrowser approach for consistency
    const borderStyle = 'border-2 border-gray-200 dark:border-gray-600'
    const bgStyle = 'bg-white dark:bg-dark-800'
    return `${borderStyle} ${bgStyle}`
  }
  
  // Remove progress icons - we only use pin emoji for selection like KanjiBrowser
  // This keeps the UI consistent across the app
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from(charactersByRow.entries()).map(([rowKey, rowChars]) => {
        // In study/review modes, check selection status; in browse mode, check pinned status
        const isSelectionMode = viewMode === 'study' || viewMode === 'review'
        const isExpanded = expandedRows.has(rowKey)
        const rowInfo = getRowInfo(rowKey)

        const allSelected = isSelectionMode
          ? rowChars.every(char => selectedCharacters.some(c => c.id === char.id))
          : rowChars.every(char => progress[getCharacterId(char.id)]?.pinned)

        const someSelected = isSelectionMode
          ? rowChars.some(char => selectedCharacters.some(c => c.id === char.id)) && !allSelected
          : rowChars.some(char => progress[getCharacterId(char.id)]?.pinned) && !allSelected

        return (
          <motion.div
            key={rowKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg"
          >
            <button
              onClick={() => toggleRow(rowKey)}
              className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${rowInfo.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                    {rowChars[0]?.[displayScript].charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {rowInfo.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {rowInfo.description} • {rowChars.length} characters
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="px-6 pb-6">
                {/* Row checkbox for selection - always show in study/review modes */}
                {(viewMode === 'study' || viewMode === 'review') && (
                  <div className="mb-4 mt-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={(checked) => handleRowSelect(rowKey, checked)}
                      label={t('kana.selectAllInRow', { count: rowChars.length })}
                      size="small"
                    />
                  </div>
                )}

                {/* Characters grid - Kanji browser style */}
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 mt-4">
                  {rowChars.map((char, index) => {
                    const isSelected = selectedCharacters.some(c => c.id === char.id)
                    const charProgress = progress[getCharacterId(char.id)]
                    const isLearned = charProgress?.status === 'learned'
                    const isLearning = charProgress?.status === 'learning'

                    // Simple styling - matching Kanji browser
                    const borderStyle = 'border-2 border-gray-200 dark:border-dark-700'
                    const bgStyle = 'bg-white dark:bg-dark-800'

                    return (
                      <motion.div
                        key={char.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.01 }}
                        whileHover={{ scale: 1.1, zIndex: 10 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative"
                      >
                        <div
                          onClick={() => onCharacterSelect(char)}
                          onMouseEnter={() => setHoveredId(char.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          className={`
                            relative w-full aspect-square flex items-center justify-center text-2xl font-medium
                            rounded-lg transition-all cursor-pointer
                            ${borderStyle} ${bgStyle}
                            hover:shadow-lg
                          `}
                          style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                        >
                          {/* Pin emoji for selection in study/review modes */}
                          {(viewMode === 'study' || viewMode === 'review') && (
                            <button
                              className="absolute -top-2 right-0.5 z-50 text-sm sm:text-base md:text-xl transition-all hover:scale-110"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onToggleSelection) {
                                  onToggleSelection(char)
                                }
                              }}
                              aria-label={isSelected ? "Unpin" : "Pin"}
                            >
                              <span className={isSelected ? "" : "opacity-30 grayscale"}>
                                📌
                              </span>
                            </button>
                          )}

                          <span className="text-gray-900 dark:text-gray-100">
                            {displayScript === 'hiragana' ? char.hiragana : char.katakana}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
})

export default KanaGrid