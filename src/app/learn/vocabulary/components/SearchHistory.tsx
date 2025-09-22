'use client'

import { Clock, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

interface SearchHistoryProps {
  history: Array<{
    term: string
    timestamp: Date
    resultCount: number
  }>
  onHistoryClick: (term: string) => void
  onClear: () => void
}

export default function SearchHistory({ history, onHistoryClick, onClear }: SearchHistoryProps) {
  const { strings } = useI18n()
  if (history.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {strings.reviewPrompts?.vocabulary?.searchHistory || 'Search History'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {strings.reviewPrompts?.vocabulary?.searchHistoryEmpty || 'Your search history will appear here'}
        </p>
      </motion.div>
    )
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const timestamp = new Date(date)
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return strings.reviewPrompts?.vocabulary?.searchJustNow || 'Just now'
    if (minutes < 60) return (strings.reviewPrompts?.vocabulary?.searchMinutesAgo || '{{minutes}}m ago').replace('{{minutes}}', minutes.toString())
    if (hours < 24) return (strings.reviewPrompts?.vocabulary?.searchHoursAgo || '{{hours}}h ago').replace('{{hours}}', hours.toString())
    return (strings.reviewPrompts?.vocabulary?.searchDaysAgo || '{{days}}d ago').replace('{{days}}', days.toString())
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {strings.reviewPrompts?.vocabulary?.searchHistory || 'Search History'}
        </h3>
        <button
          onClick={onClear}
          className="text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
        >
          {strings.reviewPrompts?.vocabulary?.searchHistoryClear || 'Clear'}
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {history.map((item, index) => (
          <motion.button
            key={`${item.term}-${index}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.02 }}
            onClick={() => onHistoryClick(item.term)}
            className="w-full p-3 bg-gray-50 dark:bg-dark-700 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {item.term}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(strings.reviewPrompts?.vocabulary?.searchHistoryResults || '{{count}} results').replace('{{count}}', item.resultCount.toString())} • {formatTime(item.timestamp)}
                </p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}