'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { useTTS } from '@/hooks/useTTS'
import { TTSOptions } from '@/lib/tts/types'
import { RepeatModeConfig } from '@/types/youtube-player'
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText'
import KuromojiService from '@/utils/kuromojiService'
import { useBottomNav } from '@/contexts/BottomNavContext'
import MobileSettingsToolbar from './CompactSettingsToolbar'
import Modal from '@/components/ui/Modal'
import { useWordExplanation } from '@/hooks/useWordExplanation'
import WordExplanationModal from '@/components/word/WordExplanationModal'
import UnifiedShadowingMode from '@/components/shadowing/UnifiedShadowingMode'
import { segmentLongSentence, shouldSegment } from '@/utils/sentenceSegmentation'
import { ReadingSettings, TranslationMode } from '@/types/story'
import { useContentTranslation } from '@/hooks/useContentTranslation'
import { useNhkAudio } from '@/components/audio/NhkAudioPlayer'

// Helper function to cleanup audio element
const cleanupAudio = (audio: HTMLAudioElement | null): void => {
  if (audio) {
    audio.pause()
    audio.src = ''
    audio.load()
  }
}

import {
  Volume2,
  X,
  ArrowLeft,
  Type,
  Languages,
  Palette,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Settings,
  CheckCircle,
  Loader2,
  Clock,
} from 'lucide-react'
import { useNewsProgress } from '@/hooks/useNewsProgress'
import NewsArticleFallbackImage from './NewsArticleFallbackImage'

interface NewsArticle {
  id: string
  title: string
  content: string
  summary: string
  url: string
  imageUrl?: string
  publishDate: string | Date
  source: string
  category: string
  difficulty: string
  tags?: string[]
  metadata?: {
    wordCount?: number
    readingTime?: number
    hasFurigana?: boolean
  }

  // NHK original audio (professional narrator - PRIMARY source for full article)
  nhkAudioUrl?: string // NHK's official m3u8 HLS audio stream

  // TTS-generated audio fields (FALLBACK when nhkAudioUrl unavailable)
  generatedTitleAudioUrl?: string
  generatedSummaryAudioUrl?: string
  generatedContentAudioUrl?: string
  audioGeneratedAt?: Date
  audioProvider?: 'edge-tts' | 'voicevox' | 'kokoro'
  audioVoice?: string
  audioStatus?: 'pending' | 'generated' | 'failed' | 'partial'
  audioError?: string
}

// ReadingSettings interface now imported from @/types/story

// Component to render article content with per-sentence play buttons
function ArticleContentWithPlayButtons({
  sentences,
  showFurigana,
  fontSize,
  highlightGrammar,
  highlightMode,
  onWordClick,
  onPlaySentence,
  onTranslateSegment,
  playingSentenceIndex,
  sentenceAudioLoading,
  isFullArticlePlaying,
  translatingSegmentIndex,
  segmentTranslations,
  className = '',
}: {
  sentences: string[]
  showFurigana: boolean
  fontSize: string
  highlightGrammar: boolean
  highlightMode: 'none' | 'all' | 'content' | 'grammar'
  onWordClick?: (word: string, event: React.MouseEvent) => void
  onPlaySentence: (sentence: string, index: number) => void
  onTranslateSegment?: (segment: string, index: number) => void
  playingSentenceIndex: number | null
  sentenceAudioLoading: number | null
  isFullArticlePlaying: boolean
  translatingSegmentIndex?: number | null
  segmentTranslations?: { [key: number]: any }
  className?: string
}) {
  // Track segments across all sentences for unique indexing
  let globalSegmentIndex = 0

  return (
    <div className={className}>
      <style jsx>{`
        .sentence-inline-wrapper.not-segmented :global(div) {
          display: inline !important;
          margin-bottom: 0 !important;
        }
        .segment-wrapper {
          margin-bottom: 0.75rem !important;
          display: block !important;
          clear: both !important;
          width: 100% !important;
        }
        .segment-wrapper button {
          display: inline-flex !important;
        }
        .segment-wrapper .furigana-content {
          display: inline !important;
        }
        .segment-wrapper :global(.japanese-text) {
          display: inline !important;
        }
        .segment-wrapper :global(span) {
          display: inline !important;
        }
      `}</style>
      {sentences.map((sentence, sentenceIndex) => {
        // Check if this sentence should be segmented
        const needsSegmentation = shouldSegment(sentence, 120)
        const segments = needsSegmentation ? segmentLongSentence(sentence, 120) : [sentence]

        // Debug logging
        if (sentence.length > 100) {
          console.log('[Segmentation Debug]', {
            sentenceIndex,
            length: sentence.length,
            needsSegmentation,
            segmentCount: segments.length,
            hasCommas: sentence.includes('、'),
            preview: sentence.substring(0, 50) + '...',
          })
        }

        return (
          <div key={sentenceIndex} style={{ marginBottom: '1rem' }}>
            {segments.map((segment, segmentIdx) => {
              const currentGlobalIndex = globalSegmentIndex++
              return (
                <React.Fragment key={segmentIdx}>
                  <div
                    className={`group relative sentence-inline-wrapper ${segments.length > 1 ? 'segment-wrapper' : 'not-segmented'}`}
                    style={{ lineHeight: segments.length > 1 ? '2.0' : undefined }}
                  >
                    {/* Segment text with furigana (no further segmentation) */}
                    <span className="furigana-content">
                      <FuriganaTextCore
                        text={segment}
                        showFurigana={showFurigana}
                        fontSize={fontSize}
                        highlightGrammar={highlightGrammar}
                        highlightMode={highlightMode}
                        onWordClick={onWordClick}
                        className="inline"
                      />
                    </span>
                    {/* Play button inline after each segment - Subtler design */}
                    <button
                      onClick={() => onPlaySentence(segment, currentGlobalIndex)}
                      disabled={isFullArticlePlaying || sentenceAudioLoading === currentGlobalIndex}
                      className={`inline-flex items-center justify-center ml-2 w-6 h-6 rounded-full transition-all duration-200 ${
                        playingSentenceIndex === currentGlobalIndex
                          ? '!opacity-100 bg-primary-500 text-white shadow-md scale-110'
                          : playingSentenceIndex !== null
                            ? 'opacity-0' // Hide other buttons when one is playing to reduce noise
                            : isFullArticlePlaying
                              ? 'opacity-0'
                              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-110 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-500'
                      }`}
                      title={
                        playingSentenceIndex === currentGlobalIndex
                          ? 'Pause segment'
                          : 'Play segment'
                      }
                      aria-label={`Play segment ${currentGlobalIndex + 1}`}
                    >
                      {sentenceAudioLoading === currentGlobalIndex ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : playingSentenceIndex === currentGlobalIndex ? (
                        <Pause className="w-3 h-3" fill="currentColor" />
                      ) : (
                        <Play className="w-3 h-3" fill="currentColor" />
                      )}
                    </button>

                    {/* Translation button inline after play button */}
                    {onTranslateSegment && (
                      <button
                        onClick={() => onTranslateSegment(segment, currentGlobalIndex)}
                        disabled={translatingSegmentIndex === currentGlobalIndex}
                        className={`inline-flex items-center justify-center ml-1 w-6 h-6 rounded-full transition-all duration-200 ${
                          segmentTranslations?.[currentGlobalIndex]
                            ? '!opacity-100 bg-green-500 text-white shadow-md scale-110'
                            : translatingSegmentIndex === currentGlobalIndex
                              ? '!opacity-100 bg-blue-500 text-white animate-pulse'
                              : playingSentenceIndex !== null
                                ? 'opacity-0' // Hide when audio is playing
                                : isFullArticlePlaying
                                  ? 'opacity-0'
                                  : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-110 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500'
                        }`}
                        title={
                          segmentTranslations?.[currentGlobalIndex]
                            ? 'Show translation'
                            : translatingSegmentIndex === currentGlobalIndex
                              ? 'Translating...'
                              : 'Translate segment'
                        }
                        aria-label={`Translate segment ${currentGlobalIndex + 1}`}
                      >
                        {translatingSegmentIndex === currentGlobalIndex ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Display translation if available */}
                  {segmentTranslations?.[currentGlobalIndex] && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500 ml-8">
                      <div className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                        {segmentTranslations[currentGlobalIndex].translatedText}
                      </div>
                      {segmentTranslations[currentGlobalIndex].keyVocabulary?.length > 0 && (
                        <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                          <span className="font-semibold">Key vocabulary:</span>{' '}
                          {segmentTranslations[currentGlobalIndex].keyVocabulary.map(
                            (vocab: any, i: number) => (
                              <span key={i} className="inline-block mr-2 mb-1">
                                <span className="font-medium">{vocab.word}</span> -{' '}
                                <span>{vocab.meaning}</span>
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// Component to render text with furigana using the API
// Note: Segmentation is now handled at ArticleContentWithPlayButtons level
function FuriganaText({
  text,
  showFurigana,
  fontSize,
  highlightGrammar,
  highlightMode,
  onWordClick,
  className = '',
}: {
  text: string
  showFurigana: boolean
  fontSize: string
  highlightGrammar: boolean
  highlightMode: 'none' | 'all' | 'content' | 'grammar'
  onWordClick?: (word: string, event: React.MouseEvent) => void
  className?: string
}) {
  // Simply pass through to core component - segmentation handled elsewhere
  return (
    <FuriganaTextCore
      text={text}
      showFurigana={showFurigana}
      fontSize={fontSize}
      highlightGrammar={highlightGrammar}
      highlightMode={highlightMode}
      onWordClick={onWordClick}
      className={className}
    />
  )
}

// Core furigana rendering component (extracted for reuse in segments)
function FuriganaTextCore({
  text,
  showFurigana,
  fontSize,
  highlightGrammar,
  highlightMode,
  onWordClick,
  className = '',
}: {
  text: string
  showFurigana: boolean
  fontSize: string
  highlightGrammar: boolean
  highlightMode: 'none' | 'all' | 'content' | 'grammar'
  onWordClick?: (word: string, event: React.MouseEvent) => void
  className?: string
}) {
  const [furiganaHtml, setFuriganaHtml] = useState<string>(text)
  const [loading, setLoading] = useState(false)
  const [tokens, setTokens] = useState<any[]>([])

  // Format plain text with proper sentence spacing
  const formatPlainText = (text: string): string => {
    if (!text) return ''

    // Split by Japanese sentence delimiters while preserving them
    // Matches: 。！？ followed by optional whitespace
    const sentences = text.split(/([。！？])\s*/)

    // Reconstruct with proper spacing, wrapping each sentence in a div with margin
    const sentenceBlocks: string[] = []
    let currentSentence = ''

    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i]
      if (!part) continue

      // If it's a delimiter, add it to the current sentence and push the block
      if (/^[。！？]$/.test(part)) {
        currentSentence += part
        // Wrap the sentence in a div with bottom margin
        if (currentSentence.trim()) {
          sentenceBlocks.push(`<div style="margin-bottom: 1rem;">${currentSentence}</div>`)
          currentSentence = ''
        }
      } else {
        // Regular text - add to current sentence
        currentSentence += part
      }
    }

    // Add any remaining text
    if (currentSentence.trim()) {
      sentenceBlocks.push(`<div style="margin-bottom: 1rem;">${currentSentence}</div>`)
    }

    return sentenceBlocks.join('') || text
  }

  // Tokenize text for clickable words when onWordClick is provided
  useEffect(() => {
    const tokenizeText = async () => {
      if (!onWordClick || !text) {
        setTokens([])
        return
      }

      try {
        const kuromojiService = KuromojiService.getInstance()
        const analyzedTokens = await kuromojiService.tokenize(text)
        setTokens(analyzedTokens)
      } catch (error) {
        console.error('[FuriganaText] Failed to tokenize text:', error)
        setTokens([])
      }
    }

    tokenizeText()
  }, [text, onWordClick])

  useEffect(() => {
    const fetchFurigana = async () => {
      if (!showFurigana || !text) {
        // Format plain text with proper sentence breaks
        setFuriganaHtml(formatPlainText(text))
        return
      }

      setLoading(true)
      try {
        const response = await fetch('/api/furigana', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.result) {
            setFuriganaHtml(data.result)
          }
        }
      } catch (error) {
        console.error('Failed to fetch furigana:', error)
        setFuriganaHtml(formatPlainText(text))
      } finally {
        setLoading(false)
      }
    }

    fetchFurigana()
  }, [text, showFurigana])

  const getFontSizeStyle = () => {
    const sizes = {
      small: 'var(--font-size-article-small)',
      medium: 'var(--font-size-article-medium)',
      large: 'var(--font-size-article-large)',
      xlarge: 'var(--font-size-article-xlarge)',
    }
    return sizes[fontSize as keyof typeof sizes]
  }

  // Convert katakana to hiragana for furigana display
  const convertKatakanaToHiragana = (str: string): string => {
    return str.replace(/[\u30A1-\u30FA]/g, function (match) {
      const chr = match.charCodeAt(0) - 0x60
      return String.fromCharCode(chr)
    })
  }

  // Handle word click from tokenized text
  const handleTokenClick = (token: any, event: React.MouseEvent) => {
    if (onWordClick && token.basic_form) {
      onWordClick(token.basic_form, event)
    }
  }

  // If grammar highlighting is enabled, use the GrammarHighlightedText component
  if (highlightGrammar && highlightMode !== 'none') {
    return (
      <div
        style={{
          fontSize: getFontSizeStyle(),
          lineHeight: showFurigana
            ? 'var(--line-height-article-furigana)'
            : 'var(--line-height-article-base)',
          letterSpacing: 'var(--letter-spacing-article)',
        }}
      >
        <GrammarHighlightedText
          text={text}
          highlightMode={highlightMode}
          onWordClick={onWordClick}
          showFurigana={showFurigana}
          className={className}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={`${className} animate-pulse`}
        style={{
          fontSize: getFontSizeStyle(),
          lineHeight: 'var(--line-height-article-base)',
          color: 'var(--article-text-secondary)',
        }}
      >
        {text}
      </div>
    )
  }

  // If onWordClick is provided and we have tokens, render clickable words with optional furigana
  if (onWordClick && tokens.length > 0) {
    return (
      <span
        className={`japanese-text ${className}`}
        style={{
          fontSize: getFontSizeStyle(),
          lineHeight: showFurigana
            ? 'var(--line-height-article-furigana)'
            : 'var(--line-height-article-base)',
          letterSpacing: 'var(--letter-spacing-article)',
          color: 'var(--article-text)',
          display: className?.includes('inline') ? 'inline' : undefined,
          fontFamily: '"Noto Sans JP", "Hiragino Sans", "Meiryo", sans-serif',
        }}
      >
        {tokens.map((token: any, index: number) => {
          // Handle Japanese full stop - add line breaks after it
          if (token.surface_form === '。') {
            return (
              <React.Fragment key={index}>
                <span className="inline-block">。</span>
              </React.Fragment>
            )
          }

          // Check if the token contains kanji
          const hasKanji = /[\u4E00-\u9FAF]/.test(token.surface_form)

          // Convert katakana reading to hiragana
          const hiraganaReading = token.reading ? convertKatakanaToHiragana(token.reading) : ''

          if (
            showFurigana &&
            hiraganaReading &&
            token.surface_form !== hiraganaReading &&
            hasKanji
          ) {
            // Render with furigana for words containing kanji
            return (
              <span
                key={index}
                className="cursor-pointer hover:bg-primary-500/20 transition-colors rounded px-1 inline-block relative"
                style={{
                  paddingTop: '0.50rem',
                  whiteSpace: 'nowrap',
                  marginRight: '0.1em',
                }}
                onClick={e => {
                  e.stopPropagation()
                  handleTokenClick(token, e)
                }}
              >
                <span
                  className="absolute text-xs"
                  style={{
                    top: '0',
                    left: '0',
                    right: '0',
                    fontSize: '0.65em',
                    lineHeight: 1,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    color: 'var(--article-text-secondary)',
                    opacity: 0.85,
                  }}
                >
                  {hiraganaReading}
                </span>
                <span>{token.surface_form}</span>
              </span>
            )
          } else {
            // Render without furigana
            return (
              <span
                key={index}
                className="cursor-pointer hover:bg-primary-500/20 transition-colors rounded px-0.5 inline-block"
                onClick={e => {
                  e.stopPropagation()
                  handleTokenClick(token, e)
                }}
              >
                {token.surface_form}
              </span>
            )
          }
        })}
      </span>
    )
  }

  // Fallback: render with dangerouslySetInnerHTML (furigana HTML from API, selection-based clicking only)
  return (
    <div
      className={`japanese-text ${className} ${onWordClick ? 'cursor-pointer' : ''}`}
      dangerouslySetInnerHTML={{ __html: furiganaHtml }}
      onClick={e => {
        if (!onWordClick) return
        // Allow selection-based clicking for furigana text
        const selection = window.getSelection()
        const selectedText = selection?.toString().trim()
        if (selectedText && selectedText.length > 0) {
          onWordClick(selectedText, e)
        }
      }}
      style={{
        fontSize: getFontSizeStyle(),
        lineHeight: showFurigana
          ? 'var(--line-height-article-furigana)'
          : 'var(--line-height-article-base)',
        letterSpacing: 'var(--letter-spacing-article)',
        color: 'var(--article-text)',
        display: className?.includes('inline') ? 'inline' : undefined,
        fontFamily: '"Noto Sans JP", "Hiragino Sans", "Meiryo", sans-serif',
      }}
    />
  )
}

// Shadowing mode component for sentence practice
function ShadowingMode({
  sentences,
  audioSpeed,
  settings,
  onSettingsChange,
  onClose,
  onPlayTTS,
  ttsLoading,
  ttsPlaying,
}: {
  sentences: string[]
  audioSpeed: number
  settings: ReadingSettings
  onSettingsChange: (settings: ReadingSettings) => void
  onClose: () => void
  onPlayTTS: (text: string, options?: TTSOptions) => Promise<void>
  ttsLoading: boolean
  ttsPlaying: boolean
}) {
  const { t } = useI18n()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlayingSequence, setIsPlayingSequence] = useState(false)

  // Add logging for shadowing mode lifecycle
  useEffect(() => {
    console.log('ShadowingMode component mounted')
    return () => console.log('ShadowingMode component unmounted')
  }, [])

  // Enhanced repeat configuration matching YouTube implementation
  const [repeatConfig, setRepeatConfig] = useState<RepeatModeConfig>({
    enabled: true,
    count: 1,
    currentRepeat: 0,
    pauseDuration: 1000, // Default 1 second pause
  })

  const handlePlay = async () => {
    setIsPlayingSequence(true)
    const sentence = sentences[currentIndex]

    try {
      // Enhanced repeat logic matching YouTube implementation
      for (let i = 0; i < repeatConfig.count; i++) {
        // Update current repeat progress
        setRepeatConfig(prev => ({ ...prev, currentRepeat: i }))

        // Play the sentence with configured audio speed
        await onPlayTTS(sentence, { speed: audioSpeed })

        // Add configurable pause between repeats (except after last repeat)
        if (i < repeatConfig.count - 1) {
          await new Promise(resolve => setTimeout(resolve, repeatConfig.pauseDuration))
        }
      }

      // Auto-advancement logic after completing all repeats
      if (currentIndex < sentences.length - 1) {
        // Move to next sentence
        setCurrentIndex(currentIndex + 1)
        setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }))
      } else {
        // Last sentence completed - stop shadowing mode
        onClose()
      }
    } catch (error) {
      console.error('TTS playback error:', error)
    } finally {
      setIsPlayingSequence(false)
      setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }))
    }
  }

  // Auto-enable highlight mode when grammar highlighting is turned on
  const handleGrammarToggle = () => {
    const newGrammarState = !settings.highlightGrammar
    const newSettings = { ...settings, highlightGrammar: newGrammarState }

    // Auto-enable highlight mode if grammar highlighting is turned on and mode is 'none'
    if (newGrammarState && settings.highlightMode === 'none') {
      newSettings.highlightMode = 'content'
    }

    onSettingsChange(newSettings)
  }

  // Enhanced navigation with repeat state reset
  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }))
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setRepeatConfig(prev => ({ ...prev, currentRepeat: 0 }))
    }
  }

  // YouTube-style repeat configuration handlers
  const setRepeatCount = (newCount: number) => {
    const clampedCount = Math.max(1, Math.min(20, newCount))
    setRepeatConfig(prev => ({
      ...prev,
      count: clampedCount,
      enabled: clampedCount > 1,
      currentRepeat: 0, // Reset current repeat when count changes
    }))
  }

  const setPauseDuration = (duration: number) => {
    const clampedDuration = Math.max(500, Math.min(3000, duration))
    setRepeatConfig(prev => ({ ...prev, pauseDuration: clampedDuration }))
  }

  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto animate-fade-in"
      style={{ backgroundColor: 'var(--article-bg)' }}
    >
      <div className="min-h-screen w-full relative">
        {/* Close Button - Top Right */}
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 rounded-full p-3 transition-all duration-200 hover:scale-110 shadow-lg"
          style={{
            backgroundColor: 'var(--article-hover-bg)',
            color: 'var(--article-text-secondary)',
          }}
        >
          <X className="w-6 h-6" />
        </button>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-6 pt-16 pb-32">
          {/* Extra top padding for close button, extra bottom padding for mobile */}

          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-3">
              <span style={{ color: 'var(--article-text-secondary)' }}>
                {t('common.sentence')} {currentIndex + 1} / {sentences.length}
              </span>
              <span style={{ color: 'var(--article-text-secondary)' }}>
                {Math.round(((currentIndex + 1) / sentences.length) * 100)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--article-accent-bg)' }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${((currentIndex + 1) / sentences.length) * 100}%`,
                  backgroundColor: 'rgb(var(--palette-primary-500))',
                }}
              />
            </div>
          </div>

          {/* Current Sentence - Enhanced for full page */}
          <div
            className="mb-10 p-10 rounded-3xl shadow-lg"
            style={{
              backgroundColor: 'var(--article-content-bg)',
              border: '1px solid var(--article-border)',
            }}
          >
            <div className="text-center mb-4">
              <span
                className="text-sm font-medium px-3 py-1 rounded-full"
                style={{
                  backgroundColor: 'rgb(var(--palette-primary-500) / 0.1)',
                  color: 'rgb(var(--palette-primary-600))',
                }}
              >
                Sentence {currentIndex + 1} of {sentences.length}
              </span>
            </div>
            <div className="text-center" style={{ fontSize: '2rem' }}>
              <FuriganaText
                text={sentences[currentIndex]}
                showFurigana={settings.showFurigana}
                fontSize={settings.fontSize}
                highlightGrammar={settings.highlightGrammar ?? false}
                highlightMode={settings.highlightMode}
                className="japanese-text text-center font-medium"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Repeat Count - YouTube Style */}
            <div className="flex flex-col items-center gap-4">
              <span className="text-lg font-semibold" style={{ color: 'var(--article-text)' }}>
                {t('news.reader.repeatCount')}
              </span>

              {/* Counter Display with +/- Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setRepeatCount(repeatConfig.count - 1)}
                  disabled={repeatConfig.count <= 1}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    backgroundColor:
                      repeatConfig.count <= 1
                        ? 'var(--article-accent-bg)'
                        : 'rgb(var(--palette-primary-500) / 0.1)',
                    color:
                      repeatConfig.count <= 1
                        ? 'var(--article-text-secondary)'
                        : 'rgb(var(--palette-primary-600))',
                  }}
                  title="Decrease"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center">
                  <div
                    className="text-4xl font-bold tabular-nums"
                    style={{ color: 'rgb(var(--palette-primary-600))' }}
                  >
                    {repeatConfig.count}
                  </div>
                  <div
                    className="text-xs font-medium"
                    style={{ color: 'var(--article-text-secondary)' }}
                  >
                    {repeatConfig.count === 1 ? 'time' : 'times'}
                  </div>
                  {/* Progress indicator during playback */}
                  {isPlayingSequence && repeatConfig.count > 1 && (
                    <div
                      className="text-xs mt-1"
                      style={{ color: 'rgb(var(--palette-primary-600))' }}
                    >
                      {repeatConfig.currentRepeat + 1}/{repeatConfig.count}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setRepeatCount(repeatConfig.count + 1)}
                  disabled={repeatConfig.count >= 20}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    backgroundColor:
                      repeatConfig.count >= 20
                        ? 'var(--article-accent-bg)'
                        : 'rgb(var(--palette-primary-500) / 0.1)',
                    color:
                      repeatConfig.count >= 20
                        ? 'var(--article-text-secondary)'
                        : 'rgb(var(--palette-primary-600))',
                  }}
                  title="Increase"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Select Buttons */}
              <div className="space-y-2">
                <div
                  className="text-xs font-medium text-center"
                  style={{ color: 'var(--article-text-secondary)' }}
                >
                  Quick Select
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 5, 10].map(count => (
                    <button
                      key={count}
                      onClick={() => setRepeatCount(count)}
                      className="w-12 h-9 rounded-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 text-sm"
                      style={{
                        backgroundColor:
                          repeatConfig.count === count
                            ? 'rgb(var(--palette-primary-500))'
                            : 'var(--article-accent-bg)',
                        color: repeatConfig.count === count ? 'white' : 'var(--article-text)',
                        ...(repeatConfig.count === count && {
                          boxShadow: '0 4px 12px rgb(var(--palette-primary-500) / 0.3)',
                          border: '2px solid rgb(var(--palette-primary-500) / 0.5)',
                        }),
                      }}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pause Duration Controls - Like YouTube */}
            {repeatConfig.count > 1 && (
              <div className="flex flex-col items-center gap-4">
                <span className="text-lg font-semibold" style={{ color: 'var(--article-text)' }}>
                  Pause Between Repeats
                </span>

                {/* Pause Duration Display with +/- Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setPauseDuration(repeatConfig.pauseDuration - 500)}
                    disabled={repeatConfig.pauseDuration <= 500}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      backgroundColor:
                        repeatConfig.pauseDuration <= 500
                          ? 'var(--article-accent-bg)'
                          : 'rgb(var(--palette-primary-500) / 0.1)',
                      color:
                        repeatConfig.pauseDuration <= 500
                          ? 'var(--article-text-secondary)'
                          : 'rgb(var(--palette-primary-600))',
                    }}
                    title="Decrease pause duration"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>

                  <div className="flex flex-col items-center">
                    <div
                      className="text-4xl font-bold tabular-nums"
                      style={{ color: 'rgb(var(--palette-primary-600))' }}
                    >
                      {(repeatConfig.pauseDuration / 1000).toFixed(1)}
                    </div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: 'var(--article-text-secondary)' }}
                    >
                      seconds
                    </div>
                  </div>

                  <button
                    onClick={() => setPauseDuration(repeatConfig.pauseDuration + 500)}
                    disabled={repeatConfig.pauseDuration >= 3000}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      backgroundColor:
                        repeatConfig.pauseDuration >= 3000
                          ? 'var(--article-accent-bg)'
                          : 'rgb(var(--palette-primary-500) / 0.1)',
                      color:
                        repeatConfig.pauseDuration >= 3000
                          ? 'var(--article-text-secondary)'
                          : 'rgb(var(--palette-primary-600))',
                    }}
                    title="Increase pause duration"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Select Buttons for Pause Duration */}
                <div className="space-y-2">
                  <div
                    className="text-xs font-medium text-center"
                    style={{ color: 'var(--article-text-secondary)' }}
                  >
                    Quick Select
                  </div>
                  <div className="flex gap-2">
                    {[0.5, 1.0, 1.5, 2.0, 3.0].map(seconds => (
                      <button
                        key={seconds}
                        onClick={() => setPauseDuration(seconds * 1000)}
                        className="w-12 h-9 rounded-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 text-xs"
                        style={{
                          backgroundColor:
                            repeatConfig.pauseDuration === seconds * 1000
                              ? 'rgb(var(--palette-primary-500))'
                              : 'var(--article-accent-bg)',
                          color:
                            repeatConfig.pauseDuration === seconds * 1000
                              ? 'white'
                              : 'var(--article-text)',
                          ...(repeatConfig.pauseDuration === seconds * 1000 && {
                            boxShadow: '0 4px 12px rgb(var(--palette-primary-500) / 0.3)',
                            border: '2px solid rgb(var(--palette-primary-500) / 0.5)',
                          }),
                        }}
                      >
                        {seconds}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Playback Controls - More Compact */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="w-12 h-12 rounded-full flex items-center justify-center font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: 'var(--article-accent-bg)',
                  color: 'var(--article-text)',
                }}
                title={t('common.previous')}
              >
                ←
              </button>

              <button
                onClick={handlePlay}
                disabled={isPlayingSequence || ttsLoading}
                className="w-16 h-16 rounded-full font-semibold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-70 flex items-center justify-center gap-1 shadow-lg"
                style={{
                  backgroundColor: 'rgb(var(--palette-primary-500))',
                  color: 'white',
                }}
                title={isPlayingSequence || ttsPlaying ? t('common.playing') : t('common.play')}
              >
                {isPlayingSequence || ttsPlaying ? (
                  <span className="animate-pulse text-lg">●</span>
                ) : (
                  <Play className="w-6 h-6" fill="currentColor" />
                )}
              </button>

              <button
                onClick={handleNext}
                disabled={currentIndex === sentences.length - 1}
                className="w-12 h-12 rounded-full flex items-center justify-center font-medium transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: 'var(--article-accent-bg)',
                  color: 'var(--article-text)',
                }}
                title={t('common.next')}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Enhanced Article Reader Component
export default function EnhancedArticleReader({
  article,
  onBack,
}: {
  article: NewsArticle
  onBack?: () => void
}) {
  const { t } = useI18n()
  const { setExtraItem } = useBottomNav()
  const {
    play: playTTS,
    pause: ttsPause,
    resume: ttsResume,
    preload,
    loading: ttsLoading,
    error: ttsError,
    playing: ttsPlaying,
    stop: ttsStop,
    currentText: currentTTSText,
  } = useTTS({
    cacheFirst: true,
    onError: err => {
      console.error('TTS Error in article reader:', err)
      // TODO: Could integrate with toast notification system if available
    },
  })
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 'medium',
    showFurigana: true,
    highlightVocabulary: false,
    highlightMode: 'none',
    darkMode: false,
    autoPlay: false,
    playbackSpeed: 1.0,
    showTranslation: false, // Legacy field
    translationMode: 'off' as TranslationMode,
    translationProvider: 'ai',
    showTranslationConfidence: true,
    preserveGrammarStructure: true,
    includeGrammarNotes: true,
    autoAddToVocabulary: false,
    translationUserLevel: 'N5',
    shadowingMode: false,
  })

  // Initialize content translation hook
  const {
    translateText,
    getFullTranslation,
    isLoading: translationLoading,
    error: translationError,
    settings: translationSettings,
    updateSettings: updateTranslationSettings,
  } = useContentTranslation({
    mode: settings.translationMode,
    userLevel: settings.translationUserLevel,
    showConfidence: settings.showTranslationConfidence,
    includeGrammarNotes: settings.includeGrammarNotes,
    autoAddToVocabulary: settings.autoAddToVocabulary,
    articleId: article.id, // Enable pre-cached translation lookup
  })

  // Initialize news progress tracking for XP
  const {
    activeTimeMs,
    isPaused: isProgressPaused,
    isCompleted: isArticleCompleted,
    isSubmitting: isCompletingArticle,
    markComplete: markArticleComplete,
  } = useNewsProgress({
    articleId: article.id,
    difficulty: article.difficulty,
    enabled: true,
  })

  // State for showing XP earned notification
  const [xpNotification, setXpNotification] = useState<{ show: boolean; xp: number }>({
    show: false,
    xp: 0,
  })

  // Handle mark complete with XP notification
  const handleMarkComplete = async () => {
    const result = await markArticleComplete()
    if (result.success && result.data && !result.data.alreadyCompleted) {
      setXpNotification({ show: true, xp: result.data.xpEarned })
      // Auto-hide notification after 3 seconds
      setTimeout(() => setXpNotification({ show: false, xp: 0 }), 3000)
    }
  }

  // Format reading time for display
  const formatReadingTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    if (minutes === 0) return `${seconds}s`
    return `${minutes}m ${seconds}s`
  }

  // Track translation state
  const [translatedContent, setTranslatedContent] = useState<string | null>(null)

  // Auto-translate when translation mode is enabled and content changes
  useEffect(() => {
    const handleAutoTranslation = async () => {
      if (settings.translationMode !== 'off' && article.content) {
        console.log(
          `[Translation] Auto-translating article content (mode: ${settings.translationMode})`
        )
        try {
          const result = await getFullTranslation(article.content)
          if (result?.translatedText) {
            setTranslatedContent(result.translatedText)
            console.log('[Translation] Auto-translation completed')
          }
        } catch (error) {
          console.error('[Translation] Auto-translation failed:', error)
          setTranslatedContent(null)
        }
      } else {
        setTranslatedContent(null)
      }
    }

    handleAutoTranslation()
  }, [settings.translationMode, article.content, getFullTranslation])

  // Sync translation settings when reading settings change
  useEffect(() => {
    updateTranslationSettings({
      mode: settings.translationMode,
      userLevel: settings.translationUserLevel,
      showConfidence: settings.showTranslationConfidence,
      includeGrammarNotes: settings.includeGrammarNotes,
      autoAddToVocabulary: settings.autoAddToVocabulary,
    })
  }, [
    settings.translationMode,
    settings.translationUserLevel,
    settings.showTranslationConfidence,
    settings.includeGrammarNotes,
    settings.autoAddToVocabulary,
    updateTranslationSettings,
  ])

  // Track if we've ever loaded audio for this article (to show loading modal on first load only)
  const [hasLoadedAudioBefore, setHasLoadedAudioBefore] = useState(false)

  // Track which sentence is currently playing (for per-sentence play buttons)
  const [playingSentenceIndex, setPlayingSentenceIndex] = useState<number | null>(null)
  const [sentenceAudioLoading, setSentenceAudioLoading] = useState<number | null>(null)

  // Track segment translation state
  const [translatingSegmentIndex, setTranslatingSegmentIndex] = useState<number | null>(null)
  const [segmentTranslations, setSegmentTranslations] = useState<{ [key: number]: any }>({})

  // Ref for pre-generated audio playback (HTML5 Audio)
  const preGeneratedAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isPreGeneratedPlaying, setIsPreGeneratedPlaying] = useState(false)

  // NHK HLS audio player (for original NHK narrator audio)
  const {
    isReady: nhkAudioReady,
    isPlaying: isNhkPlaying,
    isLoading: nhkAudioLoading,
    error: nhkAudioError,
    play: playNhkAudio,
    pause: pauseNhkAudio,
    stop: stopNhkAudio,
    setPlaybackRate: setNhkPlaybackRate,
    initialize: initializeNhkAudio,
  } = useNhkAudio()

  // AI word explanation feature
  const [isWordModalOpen, setIsWordModalOpen] = useState(false)
  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    currentWord,
    reset: resetWordExplanation,
  } = useWordExplanation({ articleId: article.id })

  // Mark audio as loaded when it starts playing for the first time
  useEffect(() => {
    if (ttsPlaying && !hasLoadedAudioBefore) {
      setHasLoadedAudioBefore(true)
    }
  }, [ttsPlaying, hasLoadedAudioBefore])

  // Cleanup audio when component unmounts or article changes
  useEffect(() => {
    return () => {
      cleanupAudio(preGeneratedAudioRef.current)
      preGeneratedAudioRef.current = null
      // Stop NHK audio if playing
      stopNhkAudio()
    }
  }, [article.id, stopNhkAudio])

  // Sync playback speed with NHK audio when settings change
  useEffect(() => {
    const speed = settings.playbackSpeed || 1.0
    setNhkPlaybackRate(speed)
    // Also update pre-generated audio if currently playing
    if (preGeneratedAudioRef.current) {
      preGeneratedAudioRef.current.playbackRate = speed
    }
  }, [settings.playbackSpeed, setNhkPlaybackRate])

  // Add logging for settings changes
  const handleSettingsChange = (newSettings: ReadingSettings) => {
    console.log('Settings changed:', {
      old: settings,
      new: newSettings,
      shadowingModeToggled: settings.shadowingMode !== newSettings.shadowingMode,
    })
    setSettings(newSettings)
  }

  // Special handler for settings changes while in shadowing mode
  const handleShadowingModeSettingsChange = (newSettings: ReadingSettings) => {
    console.log('Settings changed from within shadowing mode')
    // Always preserve shadowingMode = true when called from shadowing mode
    const preservedSettings = { ...newSettings, shadowingMode: true }
    console.log('Preserved settings:', preservedSettings)
    setSettings(preservedSettings)
  }

  const [isScrolled, setIsScrolled] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const [showMobileSettings, setShowMobileSettings] = useState(false)

  // Add logging for mobile settings state
  useEffect(() => {
    console.log('Mobile settings state changed:', showMobileSettings)
  }, [showMobileSettings])
  const [sentences, setSentences] = useState<string[]>([])

  // Set up bottom navbar settings button (mobile only)
  useEffect(() => {
    console.log('Setting up bottom nav extra item for settings')
    setExtraItem({
      id: 'reader-settings',
      label: 'Settings',
      icon: Settings,
      activeIcon: Settings,
      action: () => {
        console.log('Bottom nav settings button clicked')
        setShowMobileSettings(true)
      },
      matchPaths: [],
    })

    return () => {
      console.log('Cleaning up bottom nav extra item')
      setExtraItem(null)
    }
  }, [setExtraItem])

  // Split content into sentences for shadowing mode
  useEffect(() => {
    const splitSentences = article.content
      .split(/[。！？]/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim() + '。')
    setSentences(splitSentences)
  }, [article.content])

  // Preload article content and initial sentences for better performance
  useEffect(() => {
    const preloadContent = async () => {
      try {
        // Preload full article for main play button
        await preload([article.content])
        console.log('Article content preloaded successfully')

        // Preload first 3 sentences for shadowing mode
        if (sentences.length > 0) {
          const firstSentences = sentences.slice(0, 3)
          await preload(firstSentences)
          console.log(`Preloaded ${firstSentences.length} sentences for shadowing`)
        }
      } catch (err) {
        console.error('TTS preload failed (non-critical):', err)
        // Non-critical error, user can still play on-demand
      }
    }

    // Only preload if article has content
    if (article.content && article.content.trim().length > 0) {
      preloadContent()
    }
  }, [article.content, sentences, preload])

  // Track scroll position for progress and toolbar visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight
      const progress = (scrollTop / docHeight) * 100

      setReadingProgress(progress)
      setIsScrolled(scrollTop > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // AI word tap handler - Moshimoshi feature
  const handleWordClick = async (word: string, event: React.MouseEvent) => {
    console.log('[Article Reader] handleWordClick called with word:', word)
    const cleanWord = word.replace(/<[^>]*>/g, '').trim()
    console.log('[Article Reader] cleanWord:', cleanWord)
    if (!cleanWord || cleanWord.length === 0) {
      console.log('[Article Reader] No clean word, returning')
      return
    }

    console.log('[Article Reader] Opening word modal and explaining word')
    setIsWordModalOpen(true)
    await explainWord(cleanWord, article.content)
  }

  const handleCloseWordModal = () => {
    console.log('[Article Reader] Closing word modal')
    setIsWordModalOpen(false)
    resetWordExplanation()
  }

  const handlePlayArticle = async () => {
    // Stop any sentence-level playback
    setPlayingSentenceIndex(null)
    setSentenceAudioLoading(null)

    console.log(
      '%c🔊 AUDIO PROVIDER TRACKING - Full Article Playback',
      'background: #4CAF50; color: white; font-size: 14px; padding: 4px 8px; border-radius: 4px;'
    )
    console.log('Available audio sources:', {
      nhkOriginal: article.nhkAudioUrl ? '✅ Available (Priority 1)' : '❌ Not available',
      voicevoxPreGenerated: article.generatedContentAudioUrl
        ? '✅ Available (Priority 2)'
        : '❌ Not available',
      appTtsFallback: '✅ Always available (Priority 3)',
    })

    // PRIORITY 1: NHK original audio (professional narrator)
    if (article.nhkAudioUrl) {
      handleNhkAudioPlayback()
      return
    }

    // PRIORITY 2 & 3: VOICEVOX TTS or app TTS fallback
    handleKokoroOrTTSFallback()
  }

  // Handle NHK HLS audio playback (Priority 1)
  const handleNhkAudioPlayback = async () => {
    console.log(
      '%c🎙️ Playing NHK Original Audio (Priority 1)',
      'background: #E53935; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
    )

    // If already playing NHK audio, pause it
    if (isNhkPlaying) {
      pauseNhkAudio()
      console.log('[Article Reader] Paused NHK audio')
      return
    }

    // If NHK audio is ready but paused, resume it
    if (nhkAudioReady && !isNhkPlaying) {
      await playNhkAudio()
      console.log('[Article Reader] Resumed NHK audio')
      return
    }

    // Initialize and play NHK audio
    if (article.nhkAudioUrl) {
      try {
        console.log('[Article Reader] Initializing NHK HLS stream:', article.nhkAudioUrl)
        initializeNhkAudio(article.nhkAudioUrl)

        // Set playback rate
        if (settings.audioSpeed) {
          setNhkPlaybackRate(settings.audioSpeed)
        }

        // Wait a bit for initialization then play
        setTimeout(async () => {
          await playNhkAudio()
        }, 500)
      } catch (error) {
        console.error('[Article Reader] NHK audio failed, falling back to TTS:', error)
        // Fall back to VOICEVOX/TTS
        handleKokoroOrTTSFallback()
      }
    }
  }

  // Handle Kokoro TTS playback
  const handleKokoroOrTTSFallback = async () => {
    console.log('%c🔄 Attempting Kokoro TTS playback...', 'color: #FF9800; font-weight: bold;')

    if (article.generatedContentAudioUrl) {
      // If already playing Kokoro audio, pause it
      if (isPreGeneratedPlaying && preGeneratedAudioRef.current) {
        preGeneratedAudioRef.current.pause()
        setIsPreGeneratedPlaying(false)
        console.log('[Article Reader] Paused Kokoro TTS audio')
        return
      }

      // If Kokoro audio is paused, resume it
      if (preGeneratedAudioRef.current && !preGeneratedAudioRef.current.ended) {
        preGeneratedAudioRef.current.play()
        setIsPreGeneratedPlaying(true)
        console.log('[Article Reader] Resumed Kokoro TTS audio')
        return
      }

      // Otherwise, start playing Kokoro audio from beginning
      try {
        console.log(
          '%c[Audio] SOURCE: FIREBASE PRE-CACHED (Kokoro TTS)',
          'color: #ff9900; font-weight: bold',
          {
            provider: article.audioProvider || 'kokoro',
            voice: article.audioVoice,
          }
        )

        // Clean up existing audio if any
        if (preGeneratedAudioRef.current) {
          cleanupAudio(preGeneratedAudioRef.current)
          preGeneratedAudioRef.current = null
        }

        // Create new audio element
        // Route through TTS proxy to handle Firebase Storage CORS
        const audioUrl =
          article.generatedContentAudioUrl.includes('firebasestorage') ||
          article.generatedContentAudioUrl.includes('storage.googleapis.com')
            ? `/api/tts/proxy?url=${encodeURIComponent(article.generatedContentAudioUrl)}`
            : article.generatedContentAudioUrl

        const audio = new Audio(audioUrl)
        // Validate playbackSpeed to prevent "non-finite" error
        audio.playbackRate = Number.isFinite(settings.playbackSpeed) ? settings.playbackSpeed! : 1.0

        // Set up event listeners
        audio.onplay = () => {
          setIsPreGeneratedPlaying(true)
          console.log('[Article Reader] Kokoro TTS audio started')
        }

        audio.onpause = () => {
          setIsPreGeneratedPlaying(false)
          console.log('[Article Reader] Kokoro TTS audio paused')
        }

        audio.onended = () => {
          setIsPreGeneratedPlaying(false)
          console.log('[Article Reader] Kokoro TTS audio finished')
        }

        audio.onerror = e => {
          console.error('[Article Reader] Kokoro TTS audio error:', e)
          setIsPreGeneratedPlaying(false)
          // Fall back to app TTS on error
          console.log('[Article Reader] Falling back to app TTS')
          handleTTSPlayback()
        }

        preGeneratedAudioRef.current = audio
        await audio.play()
        console.log(
          '%c▶️ PLAYING: Kokoro Pre-generated TTS (Priority 1)',
          'background: #9C27B0; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
        )
        console.log('Provider: Kokoro (pre-generated via Sheldon, cached in Firebase Storage)')
        return
      } catch (error) {
        console.error('[Article Reader] Failed to play Kokoro audio:', error)
        // Fall through to app TTS fallback
      }
    }

    // PRIORITY 2: App TTS system (fallback)
    console.log(
      '%c[Audio] SOURCE: API TTS (on-demand generation)',
      'color: #ff0000; font-weight: bold',
      {
        reason: 'No pre-cached audio available',
      }
    )
    handleTTSPlayback()
  }

  // Separate TTS playback logic for cleaner code
  const handleTTSPlayback = async () => {
    // If already playing TTS, pause it
    if (ttsPlaying) {
      ttsPause()
      return
    }

    // If TTS is paused (has currentText), resume it
    if (currentTTSText && !ttsPlaying) {
      ttsResume()
      return
    }

    // Otherwise, start TTS from beginning
    try {
      console.log(
        '%c▶️ PLAYING: App TTS System (Priority 2)',
        'background: #FF5722; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
      )
      console.log(
        'Provider chain: Kokoro → ElevenLabs → Edge-TTS (check server logs for actual provider used)'
      )
      await playTTS(article.content, {
        speed: settings.audioSpeed,
      })
      console.log('Article playback started with App TTS fallback')
    } catch (error) {
      console.error('Failed to play article with TTS:', error)
      // Error already logged by onError callback in useTTS
      // Could show user-facing error notification here if toast system exists
    }
  }

  // Split article content into sentences
  const splitIntoSentences = (text: string): string[] => {
    const sentences: string[] = []
    const parts = text.split(/([。！？])/)
    let current = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue

      if (/^[。！？]$/.test(part)) {
        current += part
        if (current.trim()) {
          sentences.push(current.trim())
          current = ''
        }
      } else {
        current += part
      }
    }

    // Add any remaining text
    if (current.trim()) {
      sentences.push(current.trim())
    }

    return sentences
  }

  // Handle playing individual sentence with on-demand Kokoro generation + caching
  // Flow: Try Kokoro (cached or generate) → Fallback to app TTS if needed
  const handlePlaySentence = async (sentence: string, index: number) => {
    // Stop full article playback if running (pre-generated or TTS)
    if (isPreGeneratedPlaying && preGeneratedAudioRef.current) {
      preGeneratedAudioRef.current.pause()
      setIsPreGeneratedPlaying(false)
    }
    if (ttsPlaying && playingSentenceIndex === null) {
      ttsStop()
    }

    // If this sentence is already playing, pause it
    if (playingSentenceIndex === index && ttsPlaying) {
      ttsPause()
      return
    }

    // If paused, resume it
    if (playingSentenceIndex === index && !ttsPlaying && currentTTSText) {
      ttsResume()
      return
    }

    // Set loading state
    setSentenceAudioLoading(index)
    setPlayingSentenceIndex(index)

    console.log(
      '%c🔊 TTS PROVIDER TRACKING - Single Sentence Playback',
      'background: #4CAF50; color: white; font-size: 14px; padding: 4px 8px; border-radius: 4px;'
    )
    console.log('Sentence:', sentence.substring(0, 50) + '...')

    // PRIORITY 1: Try Kokoro TTS (cached or on-demand generation)
    try {
      console.log('[Article Reader] Attempting Kokoro sentence audio (Priority 1)...')

      const response = await fetch('/api/tts/generate-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          sentence,
          index,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        if (data.success && data.audioUrl) {
          console.log(
            '%c▶️ PLAYING: Kokoro Sentence TTS (Priority 1)',
            'background: #9C27B0; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
          )
          console.log('Provider: Kokoro via Sheldon API', {
            cached: data.cached ? '✅ From Cache' : '🔄 Freshly Generated',
            provider: data.provider,
          })

          // Create and play audio element
          const audio = new Audio(data.audioUrl)
          // Validate playbackSpeed to prevent "non-finite" error
          audio.playbackRate = Number.isFinite(settings.playbackSpeed)
            ? settings.playbackSpeed!
            : 1.0

          audio.onended = () => {
            setSentenceAudioLoading(null)
            setPlayingSentenceIndex(null)
            console.log('[Article Reader] Kokoro sentence playback completed')
          }

          audio.onerror = e => {
            console.error('[Article Reader] Kokoro audio playback error:', e)
            setSentenceAudioLoading(null)
            setPlayingSentenceIndex(null)
          }

          await audio.play()
          setSentenceAudioLoading(null)
          return // Success!
        }
      }

      // If response not OK, fall through to app TTS
      console.log(
        '%c⚠️ Kokoro sentence generation failed, falling back to app TTS...',
        'color: #f44336; font-weight: bold;'
      )
    } catch (kokoroError) {
      console.log(
        '%c⚠️ Kokoro error, falling back to app TTS:',
        'color: #f44336; font-weight: bold;',
        kokoroError
      )
      // Fall through to app TTS
    }

    // PRIORITY 2: Fallback to app TTS (which also makes API calls via Edge TTS)
    try {
      console.log(
        '%c▶️ PLAYING: App TTS Fallback (Priority 2)',
        'background: #FF5722; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
      )
      console.log('Provider chain: Kokoro → ElevenLabs → Edge-TTS')
      await playTTS(sentence, { speed: settings.playbackSpeed })
      setSentenceAudioLoading(null)
      console.log('[Article Reader] App TTS sentence playback completed')
    } catch (ttsError) {
      console.error('[Article Reader] All sentence playback methods failed:', ttsError)
      setSentenceAudioLoading(null)
      setPlayingSentenceIndex(null)
    }
  }

  // Handle translating individual segment
  const handleTranslateSegment = async (segment: string, index: number) => {
    // Skip if segment is already being translated
    if (translatingSegmentIndex === index) return

    // If translation already exists, clear it (toggle functionality)
    if (segmentTranslations[index]) {
      setSegmentTranslations(prev => {
        const newState = { ...prev }
        delete newState[index]
        return newState
      })
      return
    }

    // Start translation process
    setTranslatingSegmentIndex(index)

    try {
      console.log(`[Translation] Translating segment ${index}: "${segment.substring(0, 50)}..."`)

      // Use 'learning' mode for icon-based translation (optimal for Japanese learning)
      const result = await translateText(segment, 'learning')

      if (result) {
        setSegmentTranslations(prev => ({
          ...prev,
          [index]: result,
        }))
        console.log(`[Translation] Successfully translated segment ${index}`)
      } else {
        console.error(`[Translation] Failed to translate segment ${index}: No result returned`)
      }
    } catch (error) {
      console.error(`[Translation] Error translating segment ${index}:`, error)
    } finally {
      setTranslatingSegmentIndex(null)
    }
  }

  // Reset sentence playback state when TTS stops
  useEffect(() => {
    if (!ttsPlaying && playingSentenceIndex !== null) {
      // Small delay to allow for pause/resume transitions
      const timer = setTimeout(() => {
        if (!ttsPlaying) {
          setPlayingSentenceIndex(null)
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [ttsPlaying, playingSentenceIndex])

  // Auto-enable highlight mode when grammar highlighting is turned on
  useEffect(() => {
    if (settings.highlightGrammar && settings.highlightMode === 'none') {
      setSettings(prev => ({ ...prev, highlightMode: 'content' }))
    }
  }, [settings.highlightGrammar])

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: 'var(--article-bg)' }}
    >
      {/* Reading Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 z-50 transition-all duration-200"
        style={{
          background: `linear-gradient(to right, rgb(var(--palette-primary-500)) ${readingProgress}%, transparent ${readingProgress}%)`,
        }}
      />

      {/* Header - Sticky & Glassmorphic */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-800/50 transition-all duration-300 supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {onBack && (
            <button
              onClick={onBack}
              className="group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-medium hidden sm:inline">{t('common.back')}</span>
            </button>
          )}

          <button
            onClick={handlePlayArticle}
            disabled={ttsLoading || nhkAudioLoading}
            className={`ml-auto px-5 py-2 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 shadow-sm font-medium ${
              ttsLoading || nhkAudioLoading
                ? 'bg-gray-100 text-gray-400 cursor-wait'
                : isNhkPlaying
                  ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md hover:shadow-red-500/20'
                  : 'bg-primary-500 text-white hover:bg-primary-600 hover:shadow-md hover:shadow-primary-500/20'
            }`}
            aria-label={
              ttsLoading || nhkAudioLoading
                ? t('common.loading')
                : ttsPlaying || isNhkPlaying || isPreGeneratedPlaying
                  ? t('common.pause')
                  : t('common.play')
            }
          >
            {ttsLoading || nhkAudioLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full" />
                <span className="text-sm hidden sm:inline">{t('common.loading')}</span>
              </>
            ) : ttsPlaying || isNhkPlaying || isPreGeneratedPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span className="text-sm hidden sm:inline">{t('common.pause')}</span>
                {isNhkPlaying && (
                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded hidden sm:inline">
                    NHK
                  </span>
                )}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span className="text-sm hidden sm:inline">{t('common.play')}</span>
                {article.nhkAudioUrl && (
                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded hidden sm:inline">
                    NHK
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 pb-32 pt-8">
        {/* Hero Image Section */}
        <div className="mb-10 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-gray-900/5 dark:ring-white/10 aspect-[21/9] relative bg-gray-100 dark:bg-gray-800 group">
          <NewsArticleFallbackImage
            imageUrl={article.imageUrl}
            title={article.title}
            source={article.source}
            category={article.category}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

          {/* Metadata Badges on Image */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between animate-fade-in-up">
            {/* Left side: Reading time */}
            <div className="flex items-center gap-2">
              {article.metadata?.readingTime && (
                <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-medium border border-white/20 shadow-lg flex items-center gap-1">
                  <span className="opacity-70">⏱</span> {article.metadata.readingTime} min
                </span>
              )}
            </div>
            {/* Right side: Level and Date */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-bold border border-white/20 shadow-lg">
                {article.difficulty}
              </span>
              <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-medium border border-white/20 shadow-lg">
                {formatDate(article.publishDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="mb-12 text-center max-w-3xl mx-auto px-4">
          {/* Title with elegant styling and interactive features */}
          <div className="group relative animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <h1
              className="mb-4 font-bold leading-tight relative inline"
              style={{
                color: 'var(--article-text)',
                fontSize: 'clamp(1.75rem, 4.5vw, 3rem)',
                lineHeight: '1.4',
                letterSpacing: '-0.02em',
              }}
            >
              <FuriganaText
                text={article.title}
                showFurigana={settings.showFurigana}
                fontSize="xlarge"
                highlightGrammar={false}
                highlightMode="none"
                onWordClick={handleWordClick}
              />
            </h1>

            {/* Title action buttons */}
            <div className="flex items-center justify-center gap-3 mt-4 mb-6">
              {/* Play title button */}
              <button
                onClick={() => handlePlaySentence(article.title, -1)}
                disabled={sentenceAudioLoading === -1}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
                  playingSentenceIndex === -1
                    ? 'bg-primary-500 text-white shadow-md scale-110'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-500 hover:scale-110'
                }`}
                title={playingSentenceIndex === -1 ? 'Pause' : 'Play title'}
              >
                {sentenceAudioLoading === -1 ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : playingSentenceIndex === -1 ? (
                  <Pause className="w-4 h-4" fill="currentColor" />
                ) : (
                  <Play className="w-4 h-4" fill="currentColor" />
                )}
              </button>

              {/* Translate title button */}
              <button
                onClick={() => handleTranslateSegment(article.title, -1)}
                disabled={translatingSegmentIndex === -1}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
                  segmentTranslations[-1]
                    ? 'bg-green-500 text-white shadow-md scale-110'
                    : translatingSegmentIndex === -1
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 hover:scale-110'
                }`}
                title={segmentTranslations[-1] ? 'Show translation' : 'Translate title'}
              >
                {translatingSegmentIndex === -1 ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Languages className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Title translation display */}
            {segmentTranslations[-1] && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border-l-4 border-blue-500 text-left max-w-2xl mx-auto">
                <div className="text-base text-blue-800 dark:text-blue-200 leading-relaxed">
                  {segmentTranslations[-1].translatedText}
                </div>
                {segmentTranslations[-1].keyVocabulary?.length > 0 && (
                  <div className="mt-3 text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-semibold">Key vocabulary:</span>{' '}
                    {segmentTranslations[-1].keyVocabulary.map((vocab: any, i: number) => (
                      <span key={i} className="inline-block mr-3 mb-1">
                        <span className="font-medium">{vocab.word}</span> -{' '}
                        <span>{vocab.meaning}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Elegant decorative divider */}
          <div
            className="flex items-center justify-center gap-3 animate-fade-in-up"
            style={{ animationDelay: '0.15s' }}
          >
            <div
              className="h-px w-12 rounded-full"
              style={{
                background:
                  'linear-gradient(to left, rgb(var(--palette-primary-500)), transparent)',
              }}
            />
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'rgb(var(--palette-primary-500) / 0.6)' }}
            />
            <div
              className="h-px w-12 rounded-full"
              style={{
                background:
                  'linear-gradient(to right, rgb(var(--palette-primary-500)), transparent)',
              }}
            />
          </div>
        </div>

        {/* Main Content - Elevated Card */}
        <div
          className="animate-fade-in-up p-6 sm:p-8 md:p-10 rounded-2xl shadow-sm dark:shadow-lg mx-auto"
          style={{
            maxWidth: 'var(--article-content-width)',
            animationDelay: '0.3s',
            backgroundColor: 'var(--article-content-bg)',
            border: '1px solid var(--article-border)',
          }}
        >
          <ArticleContentWithPlayButtons
            sentences={splitIntoSentences(article.content)}
            showFurigana={settings.showFurigana}
            fontSize={settings.fontSize}
            highlightGrammar={settings.highlightGrammar ?? false}
            highlightMode={settings.highlightMode}
            onWordClick={handleWordClick}
            onPlaySentence={handlePlaySentence}
            onTranslateSegment={handleTranslateSegment}
            playingSentenceIndex={playingSentenceIndex}
            sentenceAudioLoading={sentenceAudioLoading}
            isFullArticlePlaying={ttsPlaying && playingSentenceIndex === null}
            translatingSegmentIndex={translatingSegmentIndex}
            segmentTranslations={segmentTranslations}
          />
        </div>

        {/* Translation Section - Firebase-powered */}
        {(settings.translationMode !== 'off' || settings.showTranslation) && (
          <div
            className="mt-10 p-6 rounded-2xl animate-fade-in-up mx-auto"
            style={{
              backgroundColor: 'var(--article-accent-bg)',
              maxWidth: 'var(--article-content-width)',
              animationDelay: '0.4s',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="font-semibold text-lg flex items-center gap-2"
                style={{ color: 'var(--article-text)' }}
              >
                <Languages className="w-5 h-5" />
                {t('news.reader.translation')}
              </h3>
              {settings.translationMode !== 'off' && (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="px-2 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: 'rgb(var(--palette-primary-500) / 0.1)',
                      color: 'rgb(var(--palette-primary-600))',
                    }}
                  >
                    {settings.translationMode}
                  </span>
                  <span style={{ color: 'var(--article-text-secondary)' }}>
                    {settings.translationUserLevel}
                  </span>
                </div>
              )}
            </div>

            {/* Translation Content */}
            {translationLoading ? (
              <div className="flex items-center gap-3 py-8">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <span style={{ color: 'var(--article-text-secondary)' }}>
                  Translating with AI • Firebase caching enabled...
                </span>
              </div>
            ) : translationError ? (
              <div className="py-4 px-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-red-700 dark:text-red-400 text-sm">
                  Translation error: {translationError}
                </p>
              </div>
            ) : translatedContent ? (
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <p
                  style={{
                    color: 'var(--article-text-secondary)',
                    lineHeight: '1.7',
                    fontSize: '1rem',
                  }}
                  className="whitespace-pre-wrap"
                >
                  {translatedContent}
                </p>
              </div>
            ) : settings.translationMode !== 'off' ? (
              <div className="py-4">
                <p style={{ color: 'var(--article-text-secondary)' }} className="text-sm italic">
                  Translation will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="py-4">
                <p style={{ color: 'var(--article-text-secondary)' }} className="text-sm">
                  Enable translation in settings to see the English translation.
                </p>
              </div>
            )}

            {/* Firebase Cache Status */}
            {translatedContent && !translationLoading && (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs">
                <span style={{ color: 'var(--article-text-secondary)' }} className="opacity-70">
                  🔥 Powered by Firebase Translation Cache
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer
          className="mt-16 pt-8 mx-auto"
          style={{
            borderTop: '1px solid var(--article-border)',
            maxWidth: 'var(--article-content-width)',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            {article.metadata?.wordCount && (
              <span
                className="px-4 py-2 rounded-full text-sm"
                style={{
                  backgroundColor: 'var(--article-accent-bg)',
                  color: 'var(--article-text-secondary)',
                }}
              >
                {article.metadata.wordCount} words
              </span>
            )}
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium transition-all duration-200 hover:scale-105 inline-flex items-center gap-1"
                style={{ color: 'rgb(var(--palette-primary-600))' }}
              >
                {t('news.reader.viewOriginal')}
                <span>→</span>
              </a>
            )}
          </div>

          {/* Mark Complete Section */}
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Reading time indicator */}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Reading time: {formatReadingTime(activeTimeMs)}</span>
                {isProgressPaused && (
                  <span className="px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs">
                    Paused
                  </span>
                )}
              </div>

              {/* Mark Complete button */}
              <button
                onClick={handleMarkComplete}
                disabled={isCompletingArticle || isArticleCompleted}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                  isArticleCompleted
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                    : isCompletingArticle
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-wait'
                      : 'bg-primary-500 hover:bg-primary-600 text-white hover:scale-105 active:scale-95 shadow-md hover:shadow-lg'
                }`}
              >
                {isCompletingArticle ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Completing...</span>
                  </>
                ) : isArticleCompleted ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Completed</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Mark Complete</span>
                  </>
                )}
              </button>
            </div>

            {/* XP Notification */}
            {xpNotification.show && (
              <div className="mt-4 flex justify-center animate-bounce">
                <div className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold shadow-lg flex items-center gap-2">
                  <span className="text-2xl">🎉</span>
                  <span>+{xpNotification.xp} XP earned!</span>
                </div>
              </div>
            )}
          </div>
        </footer>
      </article>

      {/* Settings Toolbar (handles both mobile and desktop) */}
      {!settings.shadowingMode && (
        <MobileSettingsToolbar
          settings={settings}
          onSettingsChange={handleSettingsChange}
          isScrolled={isScrolled}
          isOpen={showMobileSettings}
          onClose={() => {
            console.log('Closing mobile settings')
            setShowMobileSettings(false)
          }}
        />
      )}

      {/* AI Word Explanation Modal - Moshimoshi feature */}
      <WordExplanationModal
        isOpen={isWordModalOpen}
        onClose={handleCloseWordModal}
        word={currentWord || ''}
        explanation={wordExplanation}
        loading={wordLoading}
        error={wordError}
      />

      {/* Shadowing Mode */}
      {settings.shadowingMode && (
        <UnifiedShadowingMode
          sentences={sentences}
          title={article.title}
          contentId={article.id}
          contentType="article"
          audioSpeed={settings.audioSpeed}
          showFurigana={settings.showFurigana}
          highlightGrammar={settings.highlightGrammar ?? false}
          highlightMode={settings.highlightMode}
          onClose={() => setSettings(prev => ({ ...prev, shadowingMode: false }))}
        />
      )}

      {/* Loading Modal - Show only on first audio load */}
      <Modal
        isOpen={ttsLoading && !hasLoadedAudioBefore}
        onClose={() => {}} // Prevent closing during load
        closeOnOverlayClick={false}
        closeOnEsc={false}
        showCloseButton={false}
        size="sm"
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('news.reader.preparingAudio')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('news.reader.generatingAudioMessage')}
          </p>
        </div>
      </Modal>
    </div>
  )
}
