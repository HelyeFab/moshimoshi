'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

interface SearchBarProps {
  value?: string
  onSearch: (term: string) => void
  onClear?: () => void
  onChange?: (value: string) => void
  placeholder?: string
  searching?: boolean
  autoFocus?: boolean
  showQuickSearch?: boolean
  quickSearchTerms?: string[]
  className?: string
  inputClassName?: string
  buttonClassName?: string
}

export default function SearchBar({
  value: externalValue,
  onSearch,
  onClear,
  onChange,
  placeholder,
  searching = false,
  autoFocus = false,
  showQuickSearch = false,
  quickSearchTerms = ['食べる', '飲む', '行く', '見る', 'water', 'eat', 'study'],
  className = '',
  inputClassName = '',
  buttonClassName = ''
}: SearchBarProps) {
  const { t } = useI18n()
  const [internalValue, setInternalValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Use external value if provided (controlled), otherwise use internal state
  const isControlled = externalValue !== undefined
  const value = isControlled ? externalValue : internalValue

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSearch(value.trim())
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue('')
    }
    onChange?.('')
    onClear?.()
    inputRef.current?.focus()
  }

  const handleQuickSearch = (term: string) => {
    if (!isControlled) {
      setInternalValue(term)
    }
    onChange?.(term)
    onSearch(term)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder || t('common.search')}
            disabled={searching}
            className={`
              w-full px-4 py-2.5 pr-10 rounded-lg
              bg-white dark:bg-dark-800
              border border-gray-200 dark:border-dark-700
              text-gray-900 dark:text-gray-100
              placeholder-gray-500 dark:placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
              ${inputClassName}
            `}
          />

          {/* Clear button */}
          <AnimatePresence>
            {value && !searching && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                aria-label={t('common.clear')}
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Search button - responsive */}
        <button
          type="submit"
          disabled={searching || !value.trim()}
          className={`
            px-4 py-2.5 rounded-lg
            bg-primary-500 text-white
            hover:bg-primary-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            flex items-center gap-2
            ${buttonClassName}
          `}
          aria-label={t('common.search')}
        >
          <Search className="w-4 h-4" />
          {/* Hide text on mobile, show only icon */}
          <span className="hidden sm:inline">
            {searching ? t('common.searching') : t('common.search')}
          </span>
          {/* Show loading spinner when searching */}
          {searching && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
        </button>
      </form>

      {/* Quick search suggestions */}
      {showQuickSearch && quickSearchTerms.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2"
        >
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {t('vocabulary.quickSearch')}:
          </span>
          {quickSearchTerms.map((term) => (
            <button
              key={term}
              onClick={() => handleQuickSearch(term)}
              disabled={searching}
              className="
                px-3 py-1 text-xs
                bg-gray-100 dark:bg-dark-700
                text-gray-700 dark:text-gray-300
                rounded-full
                hover:bg-gray-200 dark:hover:bg-dark-600
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {term}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}