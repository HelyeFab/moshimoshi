'use client'

import { useI18n } from '@/i18n/I18nContext'
import Dropdown from '@/components/ui/Dropdown'

interface KanaFiltersProps {
  filterType: string
  onFilterChange: (type: any) => void
  showLearned: boolean
  onShowLearnedChange: (show: boolean) => void
  showNotStarted: boolean
  onShowNotStartedChange: (show: boolean) => void
  showBothKana: boolean
  onShowBothKanaChange: (show: boolean) => void
  displayScript?: 'hiragana' | 'katakana'
  onDisplayScriptChange?: (script: 'hiragana' | 'katakana') => void
}

export default function KanaFilters({
  filterType,
  onFilterChange,
  showLearned,
  onShowLearnedChange,
  showNotStarted,
  onShowNotStartedChange,
  showBothKana,
  onShowBothKanaChange,
  displayScript = 'hiragana',
  onDisplayScriptChange
}: KanaFiltersProps) {
  const { t } = useI18n()
  
  const filterOptions = [
    { 
      value: 'all', 
      label: t('kana.categories.all'),
      icon: '📚',
      description: '106 characters'
    },
    { 
      value: 'vowel', 
      label: t('kana.categories.vowels'),
      icon: '🔤',
      description: 'あ い う え お'
    },
    { 
      value: 'consonant', 
      label: t('kana.categories.basic'),
      icon: '✏️',
      description: 'Basic kana set'
    },
    { 
      value: 'dakuten', 
      label: t('kana.categories.dakuten'),
      icon: '゛',
      description: 'が ざ だ ば'
    },
    { 
      value: 'handakuten', 
      label: t('kana.categories.handakuten'),
      icon: '゜',
      description: 'ぱ ぴ ぷ ぺ ぽ'
    },
    { 
      value: 'digraph', 
      label: t('kana.categories.digraphs'),
      icon: '🎌',
      description: 'きゃ しゃ ちゃ...'
    },
  ]
  
  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-4 mb-6 max-w-5xl mx-auto">
      {/* Mobile Layout - Stack vertically */}
      <div className="sm:hidden space-y-4">
        {/* Category Filter - Full width on mobile */}
        <div className="w-full">
          <Dropdown
            options={filterOptions}
            value={filterType}
            onChange={onFilterChange}
            label={t('kana.filters.filterByType')}
            size="small"
            variant="default"
          />
        </div>

        {/* Kana Type Toggle - Full width on mobile */}
        <div className="w-full">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
            {t('kana.filters.display')}:
          </label>
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-dark-600">
            <button
              onClick={() => {
                if (onDisplayScriptChange) {
                  onDisplayScriptChange(displayScript === 'hiragana' ? 'katakana' : 'hiragana')
                }
                onShowBothKanaChange(false)
              }}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                !showBothKana
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-600'
              }`}
            >
              {displayScript === 'hiragana' ? t('kana.hiragana') : t('kana.katakana')}
            </button>
            <button
              onClick={() => onShowBothKanaChange(true)}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                showBothKana
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-600'
              }`}
            >
              {t('kana.combined')}
            </button>
          </div>
        </div>

        {/* Progress Filters - Stack on mobile */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg">
            <input
              type="checkbox"
              checked={showLearned}
              onChange={(e) => onShowLearnedChange(e.target.checked)}
              className="w-4 h-4 rounded text-green-500 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('kana.filters.showLearned')}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg">
            <input
              type="checkbox"
              checked={showNotStarted}
              onChange={(e) => onShowNotStartedChange(e.target.checked)}
              className="w-4 h-4 rounded text-gray-500 focus:ring-gray-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('kana.filters.showNotStarted')}
            </span>
          </label>
        </div>
      </div>

      {/* Desktop Layout - Horizontal flex */}
      <div className="hidden sm:flex flex-wrap items-center justify-center gap-4">
        {/* Category Filter */}
        <div className="flex-1 min-w-[200px]">
          <Dropdown
            options={filterOptions}
            value={filterType}
            onChange={onFilterChange}
            label={t('kana.filters.filterByType')}
            size="small"
            variant="default"
          />
        </div>

        {/* Progress Filters */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLearned}
              onChange={(e) => onShowLearnedChange(e.target.checked)}
              className="w-4 h-4 rounded text-green-500 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('kana.filters.showLearned')}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showNotStarted}
              onChange={(e) => onShowNotStartedChange(e.target.checked)}
              className="w-4 h-4 rounded text-gray-500 focus:ring-gray-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('kana.filters.showNotStarted')}
            </span>
          </label>
        </div>

        {/* Kana Type Toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('kana.filters.display')}:
          </label>
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-dark-600">
            <button
              onClick={() => {
                if (onDisplayScriptChange) {
                  onDisplayScriptChange(displayScript === 'hiragana' ? 'katakana' : 'hiragana')
                }
                onShowBothKanaChange(false)
              }}
              className={`px-3 py-1 text-sm transition-colors ${
                !showBothKana
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-600'
              }`}
            >
              {displayScript === 'hiragana' ? t('kana.hiragana') : t('kana.katakana')}
            </button>
            <button
              onClick={() => onShowBothKanaChange(true)}
              className={`px-3 py-1 text-sm transition-colors ${
                showBothKana
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-600'
              }`}
            >
              {t('kana.combined')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}