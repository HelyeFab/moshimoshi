'use client'

import { memo } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { Settings, Pause, Play, Repeat, RotateCw, Lock, Mic } from 'lucide-react'
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
      {/* Settings Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('news.reader.settings')}
        size="sm"
        closeOnOverlayClick={true}
        closeOnEsc={true}
        showCloseButton={true}
      >
        <div className="space-y-3 text-xs">
              {/* Font Size */}
              <div>
                <label
                  className="text-xs font-medium block mb-1.5"
                  style={{ color: 'var(--article-text)' }}
                >
                  {t('news.reader.fontSize')}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => onSettingsChange({ ...settings, fontSize: size })}
                      className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95"
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

              {/* Toggles — compact rows */}
              <div className="space-y-1">
                {/* Furigana Toggle */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--article-text)' }}>
                    {t('news.reader.showFurigana')}
                  </span>
                  <button
                    onClick={() =>
                      onSettingsChange({ ...settings, showFurigana: !settings.showFurigana })
                    }
                    className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0"
                    style={{
                      backgroundColor: settings.showFurigana
                        ? 'rgb(var(--palette-primary-500))'
                        : 'rgb(156 163 175)',
                    }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                        settings.showFurigana ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Grammar Highlighting */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--article-text)' }}>
                    {t('news.reader.highlightGrammar')}
                  </span>
                  <button
                    onClick={() =>
                      onSettingsChange({
                        ...settings,
                        highlightGrammar: !settings.highlightGrammar,
                      })
                    }
                    className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0"
                    style={{
                      backgroundColor: settings.highlightGrammar
                        ? 'rgb(var(--palette-primary-500))'
                        : 'rgb(156 163 175)',
                    }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                        settings.highlightGrammar ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {settings.highlightGrammar && (
                  <div className="flex gap-2 ml-3 py-1 flex-wrap">
                    {[
                      { value: 'all', label: t('news.reader.highlightAll') },
                      { value: 'content', label: t('news.reader.highlightContent') },
                      { value: 'grammar', label: t('news.reader.highlightGrammarOnly') },
                    ].map(option => (
                      <label key={option.value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="highlightMode"
                          checked={settings.highlightMode === option.value}
                          onChange={() =>
                            onSettingsChange({ ...settings, highlightMode: option.value as any })
                          }
                          className="w-3 h-3"
                        />
                        <span
                          className="text-[11px]"
                          style={{ color: 'var(--article-text-secondary)' }}
                        >
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Shadowing Mode */}
                <div
                  className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg transition-all duration-200"
                  style={{
                    background: settings.shadowingMode
                      ? 'linear-gradient(135deg, rgba(var(--palette-primary-500), 0.15) 0%, rgba(var(--palette-primary-600), 0.1) 100%)'
                      : 'rgba(var(--palette-primary-500), 0.05)',
                    border: settings.shadowingMode
                      ? '1px solid rgba(var(--palette-primary-500), 0.3)'
                      : '1px solid rgba(var(--palette-primary-500), 0.1)',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <Mic
                      className="w-3.5 h-3.5"
                      style={{
                        color: settings.shadowingMode
                          ? 'rgb(var(--palette-primary-600))'
                          : 'rgb(var(--palette-primary-400))'
                      }}
                    />
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: settings.shadowingMode
                          ? 'rgb(var(--palette-primary-700))'
                          : 'var(--article-text)'
                      }}
                    >
                      {t('news.reader.shadowingMode')}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      onSettingsChange({ ...settings, shadowingMode: !settings.shadowingMode })
                    }
                    className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0"
                    style={{
                      backgroundColor: settings.shadowingMode
                        ? 'rgb(var(--palette-primary-500))'
                        : 'rgb(156 163 175)',
                    }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
                        settings.shadowingMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Playback Speed */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--article-text)' }}>
                    {t('news.reader.playbackSpeed')}
                  </span>
                  <span
                    className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgb(var(--palette-primary-500) / 0.1)',
                      color: 'rgb(var(--palette-primary-600))',
                    }}
                  >
                    {(settings.playbackSpeed || 1.0).toFixed(2)}x
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0.5, 0.75, 1.0, 1.25, 1.5].map(speed => (
                    <button
                      key={speed}
                      onClick={() => onSettingsChange({ ...settings, playbackSpeed: speed })}
                      className="px-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95"
                      style={{
                        backgroundColor:
                          (settings.playbackSpeed || 1.0) === speed
                            ? 'rgb(var(--palette-primary-500))'
                            : 'var(--article-accent-bg)',
                        color: (settings.playbackSpeed || 1.0) === speed ? 'white' : 'var(--article-text)',
                      }}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--article-text-secondary)' }}>
                  {t('news.reader.playbackSpeedHint')}
                </p>
              </div>

              {/* Audio Controls Section */}
              {showAudioControls && (
                <>
                  <div className="border-t pt-3" style={{ borderColor: 'var(--article-border)' }}>
                    <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--article-text)' }}>
                      {t('common.audioControls')}
                    </h4>

                    <div className="flex gap-1.5">
                      {/* Play/Pause */}
                      {onPlayPause && (
                        <button
                          onClick={onPlayPause}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5"
                          style={{
                            backgroundColor: isPlayingAudio
                              ? 'var(--article-hover-bg)'
                              : 'rgb(var(--palette-primary-500))',
                            color: isPlayingAudio ? 'var(--article-text)' : 'white',
                          }}
                        >
                          {isPlayingAudio ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>{isPlayingAudio ? t('common.pause') : t('common.play')}</span>
                        </button>
                      )}

                      {/* Restart */}
                      {onRestart && (
                        <button
                          onClick={onRestart}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5"
                          style={{
                            backgroundColor: 'rgb(59 130 246)',
                            color: 'white',
                          }}
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>{t('common.restart')}</span>
                        </button>
                      )}
                    </div>

                    {/* Loop + Lock row */}
                    <div className="flex gap-1.5 mt-1.5">
                      {onToggleArticleLoop && (
                        <button
                          onClick={onToggleArticleLoop}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5"
                          style={{
                            backgroundColor: isArticleLoopEnabled
                              ? 'rgb(var(--palette-primary-500))'
                              : 'var(--article-hover-bg)',
                            color: isArticleLoopEnabled ? 'white' : 'var(--article-text)',
                          }}
                        >
                          <Repeat className="w-3.5 h-3.5" />
                          <span>{t('story.loop', 'Loop')}</span>
                        </button>
                      )}

                      {onToggleLock && isArticleLoopEnabled && !isScreenLocked && (
                        <button
                          onClick={() => {
                            onToggleLock()
                            onClose()
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 flex items-center justify-center gap-1.5"
                          style={{
                            backgroundColor: isScreenLocked
                              ? 'rgb(var(--palette-primary-500))'
                              : 'var(--article-hover-bg)',
                            color: isScreenLocked ? 'white' : 'var(--article-text)',
                          }}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>{t('story.lock', 'Lock')}</span>
                        </button>
                      )}
                    </div>

                    {/* Repeat Count — compact inline */}
                    {onToggleArticleLoop && isArticleLoopEnabled && onRepeatCountChange && (
                      <div className="mt-2 flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--article-hover-bg)' }}>
                        <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--article-text)' }}>
                          {t('youtubeShadowing.form.repeatLabel', 'Repeats')}
                        </span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            onClick={() => onRepeatCountChange(Math.max(1, repeatCount - 1))}
                            className="w-6 h-6 flex items-center justify-center rounded text-sm font-semibold active:scale-95"
                            style={{
                              backgroundColor: 'var(--article-bg)',
                              border: '1px solid var(--article-border)',
                              color: 'var(--article-text)',
                            }}
                            disabled={repeatCount <= 1}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={repeatCount}
                            onChange={(e) => {
                              const value = Math.max(1, Math.min(10, Number(e.target.value)));
                              onRepeatCountChange(value);
                            }}
                            className="w-10 px-1 py-0.5 text-center text-xs font-semibold rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                            style={{
                              backgroundColor: 'var(--article-bg)',
                              border: '1px solid var(--article-border)',
                              color: 'var(--article-text)',
                            }}
                          />
                          <button
                            onClick={() => onRepeatCountChange(Math.min(10, repeatCount + 1))}
                            className="w-6 h-6 flex items-center justify-center rounded text-sm font-semibold active:scale-95"
                            style={{
                              backgroundColor: 'var(--article-bg)',
                              border: '1px solid var(--article-border)',
                              color: 'var(--article-text)',
                            }}
                            disabled={repeatCount >= 10}
                          >
                            +
                          </button>
                          <span className="text-[10px] ml-1" style={{ color: 'var(--article-text-secondary)' }}>
                            {currentRepeat}/{repeatCount}
                          </span>
                        </div>
                      </div>
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
