'use client'

import { memo } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { Settings, Pause, Play, Repeat, RotateCw, Lock } from 'lucide-react'
import { ReadingSettings, TranslationMode } from '@/types/story'
import Modal from '@/components/ui/Modal'

interface CompactSettingsToolbarProps {
  settings: ReadingSettings
  onSettingsChange: (settings: ReadingSettings) => void
  isScrolled: boolean
  isOpen: boolean
  onOpen: () => void
  onClose: () => void

  // Audio controls
  isPlayingAudio?: boolean
  isArticleLoopEnabled?: boolean
  isStoryLoopEnabled?: boolean
  isScreenLocked?: boolean
  repeatCount?: number
  currentRepeat?: number
  onPlayPause?: () => void
  onRestart?: () => void
  onToggleArticleLoop?: () => void
  onToggleStoryLoop?: () => void
  onToggleLock?: () => void
  onRepeatCountChange?: (count: number) => void
  showAudioControls?: boolean
}

const CompactSettingsToolbar = memo(function CompactSettingsToolbar({
  settings,
  onSettingsChange,
  isScrolled,
  isOpen,
  onOpen,
  onClose,
  // Audio controls
  isPlayingAudio = false,
  isArticleLoopEnabled = false,
  isStoryLoopEnabled = false,
  isScreenLocked = false,
  repeatCount = 1,
  currentRepeat = 1,
  onPlayPause,
  onRestart,
  onToggleArticleLoop,
  onToggleStoryLoop,
  onToggleLock,
  onRepeatCountChange,
  showAudioControls = false,
}: CompactSettingsToolbarProps) {
  const { t } = useI18n()

  return (
    <>
      {/* Settings Button - Top-left on mobile, bottom-right on desktop */}
      <div
        className={`fixed top-10 left-6 md:top-auto md:left-auto md:bottom-10 md:right-6 z-40 transition-all duration-300 ${
          isScrolled ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-90'
        }`}
      >
        <button
          onClick={onOpen}
          className="w-14 h-14 rounded-full shadow-2xl backdrop-blur-xl flex items-center justify-center hover:scale-110 active:scale-95"
          style={{
            backgroundColor: 'var(--article-bg)',
            border: '1px solid var(--article-border)',
            boxShadow:
              '0 20px 25px -5px var(--article-shadow), 0 10px 10px -5px var(--article-shadow)',
            transition: 'transform 0.2s ease',
          }}
          title={t('news.reader.settings')}
        >
          <Settings className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </button>
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('news.reader.settings')}
        size="md"
        closeOnOverlayClick={true}
        closeOnEsc={true}
        showCloseButton={true}
      >
        <div className="space-y-6">
              {/* Font Size */}
              <div>
                <label
                  className="text-sm font-medium block mb-3"
                  style={{ color: 'var(--article-text)' }}
                >
                  {t('news.reader.fontSize')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => onSettingsChange({ ...settings, fontSize: size })}
                      className="px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor:
                          settings.fontSize === size
                            ? 'rgb(var(--palette-primary-500))'
                            : 'var(--article-accent-bg)',
                        color: settings.fontSize === size ? 'white' : 'var(--article-text)',
                      }}
                    >
                      {size[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Furigana Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--article-text)' }}>
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
                      : 'rgb(156 163 175)', // gray-400
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
                  <span className="text-sm font-medium" style={{ color: 'var(--article-text)' }}>
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
                        <span
                          className="text-sm"
                          style={{ color: 'var(--article-text-secondary)' }}
                        >
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Shadowing Mode */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--article-text)' }}>
                  {t('news.reader.shadowingMode')}
                </span>
                <button
                  onClick={() =>
                    onSettingsChange({ ...settings, shadowingMode: !settings.shadowingMode })
                  }
                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                  style={{
                    backgroundColor: settings.shadowingMode
                      ? 'rgb(var(--palette-primary-500))'
                      : 'rgb(156 163 175)',
                  }}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 shadow-md ${
                      settings.shadowingMode ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Audio Controls Section */}
              {showAudioControls && (
                <>
                  <div className="border-t pt-4" style={{ borderColor: 'var(--article-border)' }}>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--article-text)' }}>
                      {t('common.audioControls')}
                    </h4>

                    {/* Pause/Resume */}
                    {onPlayPause && (
                      <button
                        onClick={onPlayPause}
                        className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center gap-3"
                        style={{
                          backgroundColor: isPlayingAudio
                            ? 'var(--article-hover-bg)'
                            : 'rgb(var(--palette-primary-500))',
                          color: isPlayingAudio ? 'var(--article-text)' : 'white',
                        }}
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                        <span>{isPlayingAudio ? t('common.pause') : t('common.play')}</span>
                      </button>
                    )}

                    {/* Restart */}
                    {onRestart && (
                      <button
                        onClick={onRestart}
                        className="w-full mt-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center gap-3"
                        style={{
                          backgroundColor: 'rgb(59 130 246)', // blue-500
                          color: 'white',
                        }}
                      >
                        <RotateCw className="w-5 h-5" />
                        <span>{t('common.restart')}</span>
                      </button>
                    )}

                    {/* Loop Toggle */}
                    {onToggleArticleLoop && (
                      <div className="mt-3">
                        <button
                          onClick={onToggleArticleLoop}
                          className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center gap-3"
                          style={{
                            backgroundColor: isArticleLoopEnabled
                              ? 'rgb(var(--palette-primary-500))'
                              : 'var(--article-hover-bg)',
                            color: isArticleLoopEnabled ? 'white' : 'var(--article-text)',
                          }}
                        >
                          <Repeat className="w-5 h-5" />
                          <span>{t('story.loop', 'Loop Audio')}</span>
                        </button>

                        {/* Repeat Count Stepper */}
                        {isArticleLoopEnabled && onRepeatCountChange && (
                          <div className="mt-3">
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--article-text)' }}>
                              {t('youtubeShadowing.form.repeatLabel', 'Repeat count (1-10)')}
                            </label>

                            <div className="flex items-center justify-center gap-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--article-hover-bg)' }}>
                              <button
                                onClick={() => onRepeatCountChange(Math.max(1, repeatCount - 1))}
                                className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors active:scale-95"
                                style={{
                                  backgroundColor: 'var(--article-bg)',
                                  border: '1px solid var(--article-border)',
                                  color: 'var(--article-text)',
                                }}
                                disabled={repeatCount <= 1}
                              >
                                <span className="text-xl font-semibold">−</span>
                              </button>

                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={repeatCount}
                                  onChange={(e) => {
                                    const value = Math.max(1, Math.min(10, Number(e.target.value)));
                                    onRepeatCountChange(value);
                                  }}
                                  className="w-16 px-2 py-2 text-center text-lg font-semibold rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                  style={{
                                    backgroundColor: 'var(--article-bg)',
                                    border: '1px solid var(--article-border)',
                                    color: 'var(--article-text)',
                                  }}
                                />
                                <span className="text-xs" style={{ color: 'var(--article-text-secondary)' }}>
                                  {currentRepeat}/{repeatCount}
                                </span>
                              </div>

                              <button
                                onClick={() => onRepeatCountChange(Math.min(10, repeatCount + 1))}
                                className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors active:scale-95"
                                style={{
                                  backgroundColor: 'var(--article-bg)',
                                  border: '1px solid var(--article-border)',
                                  color: 'var(--article-text)',
                                }}
                                disabled={repeatCount >= 10}
                              >
                                <span className="text-xl font-semibold">+</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Lock Screen */}
                    {onToggleLock && isArticleLoopEnabled && !isScreenLocked && (
                      <button
                        onClick={() => {
                          onToggleLock()
                          onClose()
                        }}
                        className="w-full mt-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center gap-3"
                        style={{
                          backgroundColor: isScreenLocked
                            ? 'rgb(var(--palette-primary-500))'
                            : 'var(--article-hover-bg)',
                          color: isScreenLocked ? 'white' : 'var(--article-text)',
                        }}
                      >
                        <Lock className="w-5 h-5" />
                        <span>{isScreenLocked ? t('story.unlock', 'Unlock Screen') : t('story.lock', 'Lock Screen')}</span>
                      </button>
                    )}
                  </div>
                </>
              )}
        </div>
      </Modal>
    </>
  )
})

export default CompactSettingsToolbar
