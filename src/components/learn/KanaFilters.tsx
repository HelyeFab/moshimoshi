'use client'

import { useI18n } from '@/i18n/I18nContext'
import Dropdown from '@/components/ui/Dropdown'
import SettingsDropdown, { SettingsSection } from '@/components/ui/SettingsDropdown'
import { Settings } from 'lucide-react'

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
  
  // Build settings sections for mobile dropdown
  const settingsSections: SettingsSection[] = [
    {
      id: 'filter-type',
      title: t('kana.filters.filterByType'),
      items: filterOptions.map(option => ({
        id: option.value,
        label: option.label,
        icon: <span>{option.icon}</span>,
        description: option.description,
        active: filterType === option.value,
        onClick: () => onFilterChange(option.value)
      }))
    },
    {
      id: 'display-options',
      title: t('kana.filters.display'),
      items: [
        {
          id: 'show-learned',
          label: t('kana.filters.showLearned'),
          type: 'toggle',
          value: showLearned,
          onClick: () => onShowLearnedChange(!showLearned)
        },
        {
          id: 'show-not-started',
          label: t('kana.filters.showNotStarted'),
          type: 'toggle',
          value: showNotStarted,
          onClick: () => onShowNotStartedChange(!showNotStarted)
        }
      ]
    },
    {
      id: 'script-type',
      title: t('kana.filters.scriptType'),
      items: [
        {
          id: 'single-script',
          label: displayScript === 'hiragana' ? t('kana.hiragana') : t('kana.katakana'),
          active: !showBothKana,
          onClick: () => {
            if (onDisplayScriptChange) {
              onDisplayScriptChange(displayScript === 'hiragana' ? 'katakana' : 'hiragana')
            }
            onShowBothKanaChange(false)
          }
        },
        {
          id: 'combined',
          label: t('kana.combinedPractice'),
          active: showBothKana,
          onClick: () => onShowBothKanaChange(true)
        }
      ]
    }
  ]

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-4 mb-6 max-w-5xl mx-auto">
      {/* Mobile Layout - Compact Settings Dropdown */}
      <div className="sm:hidden flex items-center justify-between">
        {/* Current Status Display */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">{filterOptions.find(o => o.value === filterType)?.label}</span>
          {showBothKana && (
            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
              {t('kana.combinedPractice')}
            </span>
          )}
        </div>

        {/* Settings Dropdown */}
        <SettingsDropdown
          sections={settingsSections}
          buttonLabel={t('common.filters')}
          buttonIcon={<Settings className="w-4 h-4" />}
          buttonClassName="px-3 py-2 text-sm bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors flex items-center gap-2"
          position="right"
          showDividers={true}
        />
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