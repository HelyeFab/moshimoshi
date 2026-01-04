'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Modal from '@/components/ui/Modal'

// Dynamically import DrawingSearchCanvas to avoid SSR issues
const DrawingSearchCanvas = dynamic(() => import('./DrawingSearchCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-[280px] h-[280px] bg-gray-100 dark:bg-dark-800 rounded-xl flex items-center justify-center">
      <span className="text-gray-400">Loading...</span>
    </div>
  ),
})

interface DrawingSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCharacter: (character: string) => void
}

export default function DrawingSearchModal({
  isOpen,
  onClose,
  onSelectCharacter,
}: DrawingSearchModalProps) {
  const [candidates, setCandidates] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleCandidatesChange = useCallback((newCandidates: string[]) => {
    setCandidates(newCandidates)
  }, [])

  const handleSelectCharacter = useCallback(
    (char: string) => {
      onSelectCharacter(char)
      onClose()
    },
    [onSelectCharacter, onClose]
  )

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setCandidates([])
    setIsSearching(false)
    onClose()
  }, [onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Draw to Search"
      size="sm"
      className="!max-w-[360px]"
    >
      <div className="flex flex-col items-center gap-4">
        {/* Drawing Canvas - larger size for better recognition */}
        <DrawingSearchCanvas
          onCandidatesChange={handleCandidatesChange}
          onSearching={setIsSearching}
          width={280}
          height={280}
          debounceMs={300}
          strokeColor="#6366f1"
          strokeWidth={4}
        />

        {/* Recognition Results */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Recognized characters:
            </p>
            {isSearching && (
              <span className="text-xs text-primary-500 animate-pulse">
                Recognizing...
              </span>
            )}
          </div>

          {candidates.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {candidates.slice(0, 10).map((char, index) => (
                <button
                  key={`${char}-${index}`}
                  onClick={() => handleSelectCharacter(char)}
                  className={`w-12 h-12 flex items-center justify-center text-2xl rounded-xl transition-all duration-200 ${
                    index === 0
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold ring-2 ring-primary-500 scale-110'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 hover:scale-105'
                  }`}
                  title={`Select ${char}`}
                >
                  {char}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
              Draw a character above to see results
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
