'use client'

import { useState, memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KanaCharacter, playKanaAudio } from '@/data/kanaData'
import { useI18n } from '@/i18n/I18nContext'
import Checkbox from '@/components/ui/Checkbox'

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
  viewMode = 'browse'
}: KanaGridProps) {
  const { t } = useI18n()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  
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
  
  // Get row labels
  const getRowLabel = (rowKey: string): string => {
    const labels: Record<string, string> = {
      'vowel': 'Vowels (あ row)',
      'k': 'K-row (か row)',
      'g': 'G-row (が row)',
      's': 'S-row (さ row)',
      'z': 'Z-row (ざ row)',
      't': 'T-row (た row)',
      'd': 'D-row (だ row)',
      'n': 'N-row (な row)',
      'h': 'H-row (は row)',
      'b': 'B-row (ば row)',
      'p': 'P-row (ぱ row)',
      'm': 'M-row (ま row)',
      'y': 'Y-row (や row)',
      'r': 'R-row (ら row)',
      'w': 'W-row (わ row)',
      'n-single': 'N (ん)',
      'k-digraph': 'KY-digraphs (きゃ)',
      's-digraph': 'SH-digraphs (しゃ)',
      'c-digraph': 'CH-digraphs (ちゃ)',
      'n-digraph': 'NY-digraphs (にゃ)',
      'h-digraph': 'HY-digraphs (ひゃ)',
      'm-digraph': 'MY-digraphs (みゃ)',
      'r-digraph': 'RY-digraphs (りゃ)',
      'g-digraph': 'GY-digraphs (ぎゃ)',
      'j-digraph': 'J-digraphs (じゃ)',
      'b-digraph': 'BY-digraphs (びゃ)',
      'p-digraph': 'PY-digraphs (ぴゃ)',
    }
    return labels[rowKey] || rowKey.toUpperCase()
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
          .filter(char => checked ? !progress[char.id]?.pinned : progress[char.id]?.pinned)
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
            if (!progress[char.id]?.pinned) {
              onTogglePin(char.id)
            }
          })
        } else {
          newSelectedRows.delete(rowKey)
          // Unpin all characters in this row
          rowChars.forEach(char => {
            if (progress[char.id]?.pinned) {
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
    <div className="space-y-6">
      {Array.from(charactersByRow.entries()).map(([rowKey, rowChars]) => {
        // In study/review modes, check selection status; in browse mode, check pinned status
        const isSelectionMode = viewMode === 'study' || viewMode === 'review'

        const allSelected = isSelectionMode
          ? rowChars.every(char => selectedCharacters.some(c => c.id === char.id))
          : rowChars.every(char => progress[char.id]?.pinned)

        const someSelected = isSelectionMode
          ? rowChars.some(char => selectedCharacters.some(c => c.id === char.id)) && !allSelected
          : rowChars.some(char => progress[char.id]?.pinned) && !allSelected

        return (
          <motion.div
            key={rowKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 dark:bg-dark-800/70 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg"
          >
            {/* Row Header with Checkbox (only in study/review modes) */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-dark-700">
              {isSelectionMode ? (
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={(checked) => handleRowSelect(rowKey, checked)}
                    label={getRowLabel(rowKey)}
                    description={`${rowChars.length} characters`}
                    size="medium"
                  />
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {getRowLabel(rowKey)}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {rowChars.length} characters
                  </p>
                </div>
              )}
              {allSelected && isSelectionMode && (
                <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  ✓ Selected
                </span>
              )}
            </div>

            {/* Characters in this row - centered grid with 5 columns */}
            <div className="px-6 pb-6 pt-4 flex justify-center">
              <div className="grid grid-cols-5 gap-2 w-fit">
                {rowChars.map((char, index) => {
                  const isSelected = selectedCharacters.some(c => c.id === char.id)
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
                        style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif', minWidth: '64px' }}
                      >
                        {/* Pin emoji for selection in study/review modes */}
                        {(viewMode === 'study' || viewMode === 'review') && (
                          <button
                            type="button"
                            className="absolute -top-2 right-1.5 z-20 text-base sm:text-xl transition-all hover:scale-110"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (onToggleSelection) {
                                onToggleSelection(char)
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            aria-label={isSelected ? "Unpin" : "Pin"}
                          >
                            <span className={isSelected ? "" : "opacity-30 grayscale"}>
                              📌
                            </span>
                          </button>
                        )}

                        <span className="text-gray-900 dark:text-gray-100">
                          {showBothKana ? (
                            <div className="flex flex-col items-center">
                              <span>{displayScript === 'hiragana' ? char.hiragana : char.katakana}</span>
                              <span className="text-sm opacity-70">
                                {displayScript === 'hiragana' ? char.katakana : char.hiragana}
                              </span>
                            </div>
                          ) : (
                            displayScript === 'hiragana' ? char.hiragana : char.katakana
                          )}
                        </span>

                        {/* Show romaji on hover - positioned at bottom */}
                        <AnimatePresence>
                          {hoveredId === char.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="absolute bottom-1 left-0 right-0 text-xs font-medium text-primary-600 dark:text-primary-400"
                            >
                              {char.romaji}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
})

export default KanaGrid