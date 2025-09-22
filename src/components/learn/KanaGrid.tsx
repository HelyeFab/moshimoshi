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
  showBothKana: boolean
  displayScript?: 'hiragana' | 'katakana'
}

const KanaGrid = memo(function KanaGrid({
  characters,
  progress,
  selectedCharacters = [],
  onCharacterSelect,
  onTogglePin,
  onTogglePinBatch,
  showBothKana,
  displayScript = 'hiragana'
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
    
    if (checked) {
      newSelectedRows.add(rowKey)
    } else {
      newSelectedRows.delete(rowKey)
    }
    
    setSelectedRows(newSelectedRows)
  }
  
  const getCharacterStyles = (characterId: string) => {
    const charProgress = progress[characterId]
    const isSelected = selectedCharacters.some(c => c.id === characterId)

    // Start with base styles
    let borderStyle = ''
    let bgStyle = ''

    // Check if selected (highest priority for border)
    if (isSelected) {
      // Hard-coded blue border for selection - same in both themes
      borderStyle = 'border-[#2563EB] border-[3px]'
    } else {
      // Not selected, use progress-based border
      borderStyle = 'border-2 '
      if (charProgress?.status === 'learned') {
        borderStyle += 'border-green-400'
      } else if (charProgress?.status === 'learning') {
        borderStyle += 'border-yellow-400'
      } else {
        borderStyle += 'border-gray-200 dark:border-gray-600'
      }
    }

    // Background based on progress (independent of selection)
    if (charProgress?.status === 'learned') {
      bgStyle = 'bg-green-50 dark:bg-green-900/20'
    } else if (charProgress?.status === 'learning') {
      bgStyle = 'bg-yellow-50 dark:bg-yellow-900/20'
    }

    return `${borderStyle} ${bgStyle}`
  }
  
  const getProgressIcon = (characterId: string) => {
    const charProgress = progress[characterId]
    if (!charProgress) return null
    
    if (charProgress.status === 'learned') {
      return (
        <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
    
    if (charProgress.pinned) {
      return (
        <div className="absolute top-1 left-1 w-5 h-5 bg-[#EF4444] rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01-.553-.894V3a1 1 0 011-1h2zm-2 0a1 1 0 00-1 1v1.323L3.046 5.905l-1.599-.8a1 1 0 00-.894 1.79l1.233.616-1.738 5.42a1 1 0 00.285 1.05A3.989 3.989 0 005 15a3.989 3.989 0 002.667-1.019 1 1 0 00.285-1.05l-1.738-5.42 1.233-.617a1 1 0 00.553-.894V3a1 1 0 00-1-1H5z" />
          </svg>
        </div>
      )
    }
    
    return null
  }
  
  return (
    <div className="w-full flex justify-center">
      <div className="space-y-6 p-2 sm:p-4 max-w-5xl w-full mx-auto">
      {Array.from(charactersByRow.entries()).map(([rowKey, rowChars]) => {
        // Check if all characters in row are pinned
        const allPinned = rowChars.every(char => progress[char.id]?.pinned)
        const somePinned = rowChars.some(char => progress[char.id]?.pinned) && !allPinned
        
        return (
          <div key={rowKey} className="space-y-3">
            {/* Row Header with Checkbox */}
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allPinned}
                indeterminate={somePinned}
                onChange={(checked) => handleRowSelect(rowKey, checked)}
                label={getRowLabel(rowKey)}
                description={`${rowChars.length} characters`}
                size="medium"
              />
              {allPinned && (
                <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  📌 Pinned for review
                </span>
              )}
            </div>
            
            {/* Characters in this row */}
            <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5 gap-3 sm:gap-4 ml-0 sm:ml-8 justify-center">
              <AnimatePresence mode="popLayout">
                {rowChars.map((char, index) => (
          <motion.div
            key={char.id}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ 
              duration: 0.2,
              delay: index * 0.01,
              layout: { type: "spring", stiffness: 300, damping: 30 }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onHoverStart={() => setHoveredId(char.id)}
            onHoverEnd={() => setHoveredId(null)}
            className="relative"
          >
            <div
              onClick={() => onCharacterSelect(char)}
              className={`
                relative w-full aspect-square rounded-xl
                ${getCharacterStyles(char.id)}
                hover:shadow-lg dark:hover:shadow-dark-700/50
                transition-all duration-200 cursor-pointer
                flex flex-col items-center justify-center
                p-2 group
              `}
            >
              {getProgressIcon(char.id)}

              <div className="text-center">
                <div className="text-lg sm:text-2xl md:text-3xl font-japanese font-bold text-gray-800 dark:text-gray-200 mb-1">
                  {showBothKana ? (
                    <div className="flex flex-col">
                      <span>{displayScript === 'hiragana' ? char.hiragana : char.katakana}</span>
                      <span className="text-sm sm:text-lg md:text-xl opacity-70">
                        {displayScript === 'hiragana' ? char.katakana : char.hiragana}
                      </span>
                    </div>
                  ) : (
                    displayScript === 'hiragana' ? char.hiragana : char.katakana
                  )}
                </div>
                
                {/* Show romaji on hover */}
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
              
              
              {/* Pronunciation note */}
              {char.pronunciation && (
                <div className="absolute -top-2 -right-2 bg-yellow-400 dark:bg-yellow-600 text-xs px-1 rounded">
                  !
                </div>
              )}
            </div>
          </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
})

export default KanaGrid