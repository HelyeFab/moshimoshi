'use client'

import { memo } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { X } from 'lucide-react'
import { ReadingSettings } from '@/types/story'

interface ComicSettingsModalProps {
  settings: ReadingSettings
  onSettingsChange: (settings: ReadingSettings) => void
  isOpen: boolean
  onClose: () => void
}

const ComicSettingsModal = memo(function ComicSettingsModal({
  settings,
  onSettingsChange,
  isOpen,
  onClose,
}: ComicSettingsModalProps) {
  const { t } = useI18n()

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 transition-opacity duration-200"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      >
        {/* Settings Panel */}
        <div
          className="w-full max-w-md transition-transform duration-300"
          style={{
            transform: isOpen ? 'scale(1)' : 'scale(0.95)',
            opacity: isOpen ? 1 : 0,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="rounded-3xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto scrollbar-hide bg-dark-800 border border-dark-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {t('news.reader.settings')}
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-xl transition-all duration-200 hover:scale-110 bg-dark-700 hover:bg-dark-600 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Content */}
            <div className="space-y-6">
              {/* Furigana Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">
                  {t('news.reader.showFurigana')}
                </span>
                <button
                  onClick={() =>
                    onSettingsChange({ ...settings, showFurigana: !settings.showFurigana })
                  }
                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                  style={{
                    backgroundColor: settings.showFurigana
                      ? 'rgb(var(--palette-primary-500))'
                      : 'rgb(156 163 175)',
                  }}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                      settings.showFurigana ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Grammar Highlighting */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">
                    {t('news.reader.highlightGrammar')}
                  </span>
                  <button
                    onClick={() =>
                      onSettingsChange({
                        ...settings,
                        highlightGrammar: !settings.highlightGrammar,
                      })
                    }
                    className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                    style={{
                      backgroundColor: settings.highlightGrammar
                        ? 'rgb(var(--palette-primary-500))'
                        : 'rgb(156 163 175)',
                    }}
                  >
                    <span
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                        settings.highlightGrammar ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {settings.highlightGrammar && (
                  <div className="space-y-2 ml-2">
                    {[
                      { value: 'all', label: t('news.reader.highlightAll') },
                      { value: 'content', label: t('news.reader.highlightContent') },
                      { value: 'grammar', label: t('news.reader.highlightGrammarOnly') },
                    ].map(option => (
                      <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="highlightMode"
                          checked={settings.highlightMode === option.value}
                          onChange={() =>
                            onSettingsChange({ ...settings, highlightMode: option.value as any })
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-400">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
})

export default ComicSettingsModal
