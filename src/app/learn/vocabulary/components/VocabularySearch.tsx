'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

interface VocabularySearchProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  onSearch: (term: string) => void
  searching: boolean
}

export default function VocabularySearch({
  searchTerm,
  setSearchTerm,
  onSearch,
  searching
}: VocabularySearchProps) {
  const [inputValue, setInputValue] = useState(searchTerm)
  const { strings } = useI18n()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      setSearchTerm(inputValue)
      onSearch(inputValue)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
    >
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={strings.reviewPrompts?.vocabulary?.searchPlaceholder || 'Search by kanji, kana, romaji, or English meaning...'}
            className="w-full px-4 py-3 pl-12 bg-gray-50 dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            disabled={searching}
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          
          <button
            type="submit"
            disabled={searching || !inputValue.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {searching ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{strings.reviewPrompts?.vocabulary?.searching || 'Searching...'}</span>
              </div>
            ) : (
              strings.reviewPrompts?.vocabulary?.searchButton || 'Search'
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="text-xs text-gray-600 dark:text-gray-400">{strings.reviewPrompts?.vocabulary?.searchQuickSearch || 'Quick search:'}</span>
        {['食べる', '飲む', '行く', '見る', '話す', 'water', 'eat', 'study'].map((term) => (
          <button
            key={term}
            onClick={() => {
              setInputValue(term)
              setSearchTerm(term)
              onSearch(term)
            }}
            className="px-3 py-1 text-xs bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
          >
            {term}
          </button>
        ))}
      </div>
    </motion.div>
  )
}