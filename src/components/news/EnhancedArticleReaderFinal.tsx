'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { EventEmitter } from 'events'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useTTS } from '@/hooks/useTTS'
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText'
import KuromojiService from '@/utils/kuromojiService'
import MobileSettingsToolbar from './CompactSettingsToolbar'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useWordExplanation } from '@/hooks/useWordExplanation'
import WordExplanationModal from '@/components/word/WordExplanationModal'
import MoshiShadowingPlayer from '@/components/shadowing/MoshiShadowingPlayer'
import AddToListButton from '@/components/lists/AddToListButton'
import { segmentLongSentence, shouldSegment } from '@/utils/sentenceSegmentation'
import { ReadingSettings, TranslationMode, StoryPage, StoryQuizQuestion } from '@/types/story'
import { useContentTranslation } from '@/hooks/useContentTranslation'
import { useArticleSentenceData, useStorySentenceData, useBookSentenceData } from '@/hooks/useSentenceData'
import { useNhkAudio } from '@/components/audio/NhkAudioPlayer'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import { gamificationListener } from '@/lib/gamification/gamificationListener'
import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import Navbar from '@/components/layout/Navbar'
import ContentCelebration from '@/components/shared/ContentCelebration'

// URE event emitter for gamification integration (following Kana pattern)
const ureEventEmitter = new EventEmitter()
let listenerInitialized = false

// Helper function to cleanup audio element
const cleanupAudio = (audio: HTMLAudioElement | null): void => {
  if (audio) {
    // Remove event listeners first to prevent onerror from firing during cleanup
    audio.onplay = null
    audio.onpause = null
    audio.onended = null
    audio.onerror = null
    audio.oncanplaythrough = null
    audio.pause()
    audio.src = ''
    audio.load()
  }
}

// Beautiful gradient backgrounds for story pages without images
const storyGradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple dream
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink sunset
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Ocean blue
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Fresh mint
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Warm peach
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // Soft cotton candy
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // Cherry blossom
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', // Warm sunrise
  'linear-gradient(135deg, #667eea 0%, #f093fb 100%)', // Magic purple
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', // Sky blue
]

// Cute emoji sets for different story vibes
const storyEmojiSets = [
  ['🌸', '✨', '🦋', '🌺'], // Nature & beauty
  ['🐱', '🐕', '🐰', '🦊'], // Cute animals
  ['🌙', '⭐', '🌟', '💫'], // Celestial
  ['🍰', '🧁', '🍡', '🍵'], // Sweet treats
  ['📚', '✏️', '🎒', '📖'], // School & learning
  ['🏠', '🌳', '🌻', '🌈'], // Home & nature
  ['🎀', '💝', '🎁', '🎈'], // Celebration
  ['🍂', '🍁', '🌾', '🎃'], // Autumn
  ['❄️', '⛄', '🎄', '🎅'], // Winter
  ['🌊', '🐚', '🏖️', '🌴'], // Beach & summer
]

// Story page fallback component with gradient and emojis
function StoryPageFallback({ pageIndex, title }: { pageIndex: number; title: string }) {
  // Use page index to deterministically select gradient and emojis
  const gradientIndex = pageIndex % storyGradients.length
  const emojiSetIndex = (pageIndex + Math.floor(title.length / 3)) % storyEmojiSets.length
  const gradient = storyGradients[gradientIndex]
  const emojis = storyEmojiSets[emojiSetIndex]

  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{ background: gradient }}
    >
      {/* Floating emojis with animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {emojis.map((emoji, i) => (
          <span
            key={i}
            className="absolute text-4xl sm:text-5xl opacity-30 animate-float"
            style={{
              left: `${15 + i * 22}%`,
              top: `${20 + (i % 2) * 40}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + i * 0.5}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* Center emoji cluster */}
      <div className="relative z-10 flex items-center justify-center gap-3 sm:gap-4">
        {emojis.slice(0, 3).map((emoji, i) => (
          <span
            key={i}
            className="text-5xl sm:text-6xl drop-shadow-lg transform hover:scale-110 transition-transform"
            style={{
              transform: `rotate(${(i - 1) * 10}deg)`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* Page indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
        Page {pageIndex + 1}
      </div>

      {/* Subtle shimmer effect */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
          backgroundSize: '200% 200%',
          animation: 'shimmer 3s ease-in-out infinite',
        }}
      />

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

import {
  Volume2,
  ArrowLeft,
  Type,
  Languages,
  Palette,
  Play,
  Pause,
  Settings,
  CheckCircle,
  Loader2,
  Clock,
  Repeat,
  ListMusic,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useNewsProgress } from '@/hooks/useNewsProgress'
import NewsArticleFallbackImage from './NewsArticleFallbackImage'
import { LockScreen } from '@/components/ui/LockScreen'

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
  audioProvider?: 'kokoro' | 'elevenlabs' | 'voicevox'
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
  onWordClick?: (word: string, event: React.MouseEvent, sentenceContext?: string) => void
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
                        onWordClick={onWordClick ? (word, event) => onWordClick(word, event, segment) : undefined}
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

                    {/* Save to list button */}
                    <span
                      className={`inline-flex ml-1 transition-all duration-200 ${
                        playingSentenceIndex !== null || isFullArticlePlaying
                          ? 'opacity-0'
                          : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                      }`}
                    >
                      <AddToListButton
                        content={segment}
                        type="sentence"
                        metadata={{
                          meaning: segmentTranslations?.[currentGlobalIndex]?.translatedText,
                        }}
                        size="small"
                        className="!w-6 !h-6"
                      />
                    </span>
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

// Main Enhanced Article Reader Component
export default function EnhancedArticleReader({
  article,
  onBack,
  // Story-specific props (optional)
  pages,
  quiz,
  onComplete,
  onExit,
  storyTitle,
  contentType = 'article',
}: {
  article: NewsArticle
  onBack?: () => void
  // Story-specific props
  pages?: StoryPage[]
  quiz?: StoryQuizQuestion[]
  onComplete?: () => void
  onExit?: () => void
  storyTitle?: string // For stories, display this instead of article.title
  // Content type for sentence data fetching (determines which Firebase collection to use)
  contentType?: 'article' | 'story' | 'book'
}) {
  // Determine if we're in story mode (multi-page)
  const isStoryMode = pages && pages.length > 0
  const router = useRouter()
  const { t } = useI18n()
  const { user } = useAuth()
  const { showToast } = useToast()

  // Initialize gamification listener (following Kana pattern)
  useEffect(() => {
    if (user?.uid && !listenerInitialized) {
      console.log('[News Reader] Initializing gamification listener for user:', user.uid)
      gamificationListener.initialize(user.uid, ureEventEmitter)
      listenerInitialized = true
    }
  }, [user?.uid])
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
    onEnd: () => {
      if (playingSentenceIndex !== null) return
      if (isPlayingFullStoryRef.current) return
      if (!isArticleLoopEnabledRef.current) {
        currentRepeatRef.current = 1
        setCurrentRepeat(1)
        return
      }
      handleArticleAudioEnd()
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
    showTranslation: true, // Legacy field - now always on
    translationMode: 'learning' as TranslationMode, // Always on - translation assistance available
    translationProvider: 'ai',
    showTranslationConfidence: true,
    preserveGrammarStructure: true,
    includeGrammarNotes: true,
    autoAddToVocabulary: false,
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
    showConfidence: settings.showTranslationConfidence,
    includeGrammarNotes: settings.includeGrammarNotes,
    autoAddToVocabulary: settings.autoAddToVocabulary,
    articleId: article.id, // Enable pre-cached translation lookup
  })

  // Initialize pre-cached sentence data (audio URLs + translations)
  // Fetch from the appropriate Firebase collection based on content type
  const articleSentenceData = useArticleSentenceData(contentType === 'article' ? article.id : null)
  const storySentenceData = useStorySentenceData(contentType === 'story' ? article.id : null)
  const bookSentenceData = useBookSentenceData(contentType === 'book' ? article.id : null)

  // Select the appropriate sentence data based on content type
  const {
    sentenceMap: preCachedSentences,
    hasCachedData: hasSentenceCache,
    getAudioUrl: getPreCachedAudioUrl,
  } = (() => {
    switch (contentType) {
      case 'story':
        // For stories, we need to get audio from page-based data
        // The storySentenceData hook returns pageData, so we create compatible interface
        const storyGetAudioUrl = (text: string): string | null => {
          const sentence = storySentenceData.getSentenceByText(text)
          return sentence?.audioUrl || null
        }
        return {
          sentenceMap: new Map(), // Stories use getSentenceByText instead
          hasCachedData: storySentenceData.hasCachedData,
          getAudioUrl: storyGetAudioUrl,
        }
      case 'book':
        const bookGetAudioUrl = (text: string): string | null => {
          const sentence = bookSentenceData.getSentenceByText(text)
          return sentence?.audioUrl || null
        }
        return {
          sentenceMap: bookSentenceData.sentenceMap,
          hasCachedData: bookSentenceData.hasCachedData,
          getAudioUrl: bookGetAudioUrl,
        }
      case 'article':
      default:
        return {
          sentenceMap: articleSentenceData.sentenceMap,
          hasCachedData: articleSentenceData.hasCachedData,
          getAudioUrl: articleSentenceData.getAudioUrl,
        }
    }
  })()

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

  // State for showing celebration screen
  const [celebrationData, setCelebrationData] = useState<{
    show: boolean
    xp: number
    readingTimeMs: number
  } | null>(null)

  // Story mode state (for multi-page content with optional quiz)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [showQuiz, setShowQuiz] = useState(false)

  // Get current content based on mode
  const currentContent = isStoryMode ? pages![currentPageIndex].text : article.content
  const currentTranslation = isStoryMode ? pages![currentPageIndex].translation : undefined
  const currentPageImage = isStoryMode ? pages![currentPageIndex].imageUrl : article.imageUrl
  const totalPages = isStoryMode ? pages!.length : 1
  const displayTitle = storyTitle || article.title
  const fullAudioContent = isStoryMode
    ? pages?.map(p => p.text || '').filter(Boolean).join(' ') || ''
    : (typeof article.content === 'string' ? article.content : '')

  // Handle mark complete with celebration screen and URE event emission
  const handleMarkComplete = async () => {
    const result = await markArticleComplete()
    if (result.success && result.data && !result.data.alreadyCompleted) {
      // Show celebration screen with all data
      setCelebrationData({
        show: true,
        xp: result.data.xpEarned,
        readingTimeMs: activeTimeMs,
      })

      // Emit URE SESSION_COMPLETED event for unified gamification (following Kana pattern)
      const sessionId = `news_${article.id}_${Date.now()}`
      ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
        data: {
          sessionId,
          contentType: 'news',
          statistics: {
            correctItems: 1, // Article completion counts as 1 successful item
            accuracy: 100, // Completion = 100% success
          },
          duration: activeTimeMs,
          metadata: {
            articleId: article.id,
            difficulty: article.difficulty,
            xpEarned: result.data.xpEarned,
          },
        },
      })
      console.log('[News Reader] Emitted SESSION_COMPLETED event:', {
        sessionId,
        xpEarned: result.data.xpEarned,
      })
    }
  }

  // Format reading time for display
  const formatReadingTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    if (minutes === 0) return `${seconds}s`
    return `${minutes}m ${seconds}s`
  }

  // Story mode: Page navigation handlers
  const handlePageChange = (direction: 'next' | 'prev') => {
    if (!isStoryMode) return

    // Stop full story mode when manually navigating (user takes control)
    if (isPlayingFullStory) {
      setIsPlayingFullStory(false)
    }

    // Stop any playing audio when changing pages (for per-page audio experience)
    if (preGeneratedAudioRef.current) {
      cleanupAudio(preGeneratedAudioRef.current)
      preGeneratedAudioRef.current = null
      setIsPreGeneratedPlaying(false)
    }

    // Stop TTS audio if playing
    if (ttsPlaying) {
      ttsStop()
    }

    // Stop sentence-level playback
    setPlayingSentenceIndex(null)

    if (direction === 'next') {
      if (currentPageIndex < totalPages - 1) {
        setCurrentPageIndex(currentPageIndex + 1)
        // Translation will update automatically via useEffect (uses pre-stored page.translation)
      } else if (currentPageIndex === totalPages - 1) {
        // Last page - show quiz if available, otherwise complete
        if (quiz && quiz.length > 0) {
          setShowQuiz(true)
        } else if (onComplete) {
          onComplete()
        }
      }
    } else if (direction === 'prev' && currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
      // Translation will update automatically via useEffect (uses pre-stored page.translation)
    }
  }

  // Quiz completion handler
  const handleQuizComplete = (score: number, xpEarned: number) => {
    console.log('[Quiz] Completed:', { score, xpEarned })
  }

  const handleQuizFinish = () => {
    setShowQuiz(false)
    if (onComplete) {
      onComplete()
    } else if (onExit) {
      onExit()
    }
  }

  // Track translation state
  const [translatedContent, setTranslatedContent] = useState<string | null>(null)
  const [debugEnabled, setDebugEnabled] = useState(true)
  const [debugEvents, setDebugEvents] = useState<string[]>([])
  const debugEventGuardRef = useRef<Map<string, number>>(new Map())
  const [debugPanelPos, setDebugPanelPos] = useState({ x: 0, y: 0 })
  const debugDragStateRef = useRef<{
    dragging: boolean
    startX: number
    startY: number
    originX: number
    originY: number
  }>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 })
  const addDebugEvent = useCallback(
    (message: string, data?: Record<string, unknown>) => {
      if (!debugEnabled) return
      const timestamp = new Date().toISOString()
      const payload = data ? ` ${JSON.stringify(data)}` : ''
      setDebugEvents(prev => [`${timestamp} ${message}${payload}`, ...prev].slice(0, 80))
    },
    [debugEnabled]
  )
  const addDebugEventOnce = useCallback(
    (key: string, message: string, data?: Record<string, unknown>, throttleMs: number = 2000) => {
      if (!debugEnabled) return
      const now = Date.now()
      const last = debugEventGuardRef.current.get(key)
      if (last && now - last < throttleMs) {
        return
      }
      debugEventGuardRef.current.set(key, now)
      addDebugEvent(message, data)
    },
    [addDebugEvent, debugEnabled]
  )

  // Local cache for news article translations (stories use pre-stored translations)
  // Using ref to avoid re-triggering effect when cache updates
  const newsTranslationCacheRef = useRef<Record<string, string>>({})

  // For stories: Use the pre-stored translation immediately (no API call needed)
  // For news: Use API with local caching
  useEffect(() => {
    const handleTranslation = async () => {
      // If translation mode is off, clear and return
      if (settings.translationMode === 'off') {
        setTranslatedContent(null)
        return
      }

      // STORY MODE: Use pre-stored translation directly (instant, no API call)
      if (isStoryMode && currentTranslation) {
        addDebugEventOnce(
          `story-prestored-${currentPageIndex}`,
          '[Translation] Using pre-stored page translation',
          { page: currentPageIndex + 1 }
        )
        setTranslatedContent(currentTranslation)
        return
      }

      // STORY MODE: No pre-stored translation - try sentence cache, then AI fallback
      if (isStoryMode && !currentTranslation && currentContent) {
        // If sentence cache is still loading, wait to avoid unnecessary fallback
        if (storySentenceData.isLoading) {
          addDebugEventOnce(
            `story-waiting-${currentPageIndex}`,
            '[Translation] Waiting for story sentence cache',
            { page: currentPageIndex + 1 }
          )
          return
        }

        const pageNumber = pages?.[currentPageIndex]?.pageNumber ?? currentPageIndex + 1
        const cachedSentences = storySentenceData.getPageSentences(pageNumber)
        const cachedTranslation = cachedSentences
          .map(sentence => sentence.translation?.translatedText)
          .filter(Boolean)
          .join(' ')

        if (cachedTranslation) {
          addDebugEventOnce(
            `story-sentence-cache-${currentPageIndex}`,
            '[Translation] Using story sentence cache',
            { page: currentPageIndex + 1, sentenceCount: cachedSentences.length }
          )
          setTranslatedContent(cachedTranslation)
          return
        }

        console.warn('[Translation] Story page missing pre-stored translation, using AI fallback')
        addDebugEventOnce(
          `story-ai-fallback-${currentPageIndex}`,
          '[Translation] Story missing cache -> AI fallback',
          { page: currentPageIndex + 1 }
        )
        // Fall back to AI translation for stories without pre-stored translations
        try {
          const result = await getFullTranslation(currentContent)
          if (result?.translatedText) {
            addDebugEventOnce(
              `story-ai-success-${currentPageIndex}`,
              '[Translation] AI fallback success',
              { page: currentPageIndex + 1 }
            )
            setTranslatedContent(result.translatedText)
          }
        } catch (error) {
          console.error('[Translation] AI fallback translation failed:', error)
          addDebugEventOnce(
            `story-ai-failed-${currentPageIndex}`,
            '[Translation] AI fallback failed',
            {
              page: currentPageIndex + 1,
              error: error instanceof Error ? error.message : String(error),
            },
            5000
          )
          setTranslatedContent(null)
        }
        return
      }

      // NEWS MODE: Check local cache first, then API
      if (!isStoryMode && currentContent) {
        const cacheKey = `news_${article.id}_${currentContent.substring(0, 50)}`

        // Check local cache (using ref)
        if (newsTranslationCacheRef.current[cacheKey]) {
          addDebugEventOnce(
            `news-cache-${cacheKey.substring(0, 40)}`,
            '[Translation] Using cached news translation',
            { key: cacheKey.substring(0, 40) }
          )
          console.log(`[Translation] Using cached news translation`)
          setTranslatedContent(newsTranslationCacheRef.current[cacheKey])
          return
        }

        // Fetch from API (will use Firebase cache if available)
        console.log(`[Translation] Fetching news translation via API (mode: ${settings.translationMode})`)
        try {
          const result = await getFullTranslation(currentContent)
          if (result?.translatedText) {
            setTranslatedContent(result.translatedText)
            // Cache locally for this session (using ref to avoid effect re-trigger)
            newsTranslationCacheRef.current[cacheKey] = result.translatedText
            addDebugEventOnce(
              `news-cache-write-${cacheKey.substring(0, 40)}`,
              '[Translation] News translation completed and cached',
              { key: cacheKey.substring(0, 40) }
            )
            console.log('[Translation] News translation completed and cached')
          }
        } catch (error) {
          console.error('[Translation] News translation failed:', error)
          addDebugEventOnce(
            `news-failed-${cacheKey.substring(0, 40)}`,
            '[Translation] News translation failed',
            { error: error instanceof Error ? error.message : String(error) },
            5000
          )
          setTranslatedContent(null)
        }
      }
    }

    handleTranslation()
  }, [
    settings.translationMode,
    currentContent,
    currentTranslation,
    currentPageIndex,
    isStoryMode,
    article.id,
    getFullTranslation,
    pages,
    storySentenceData.isLoading,
    storySentenceData.hasCachedData,
    storySentenceData.pageData?.length,
    storySentenceData.getPageSentences,
    addDebugEvent,
  ])

  // Sync translation settings when reading settings change
  useEffect(() => {
    updateTranslationSettings({
      mode: settings.translationMode,
      showConfidence: settings.showTranslationConfidence,
      includeGrammarNotes: settings.includeGrammarNotes,
      autoAddToVocabulary: settings.autoAddToVocabulary,
    })
  }, [
    settings.translationMode,
    settings.showTranslationConfidence,
    settings.includeGrammarNotes,
    settings.autoAddToVocabulary,
    updateTranslationSettings,
  ])

  // Track which sentence is currently playing (for per-sentence play buttons)
  const [playingSentenceIndex, setPlayingSentenceIndex] = useState<number | null>(null)
  const [sentenceAudioLoading, setSentenceAudioLoading] = useState<number | null>(null)

  // Track segment translation state
  const [translatingSegmentIndex, setTranslatingSegmentIndex] = useState<number | null>(null)
  const [segmentTranslations, setSegmentTranslations] = useState<{ [key: number]: any }>({})

  // Ref for pre-generated audio playback (HTML5 Audio)
  const preGeneratedAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isPreGeneratedPlaying, setIsPreGeneratedPlaying] = useState(false)

  // Full story playback mode (play all pages sequentially)
  const [isPlayingFullStory, setIsPlayingFullStory] = useState(false)
  const [isStoryLoopEnabled, setIsStoryLoopEnabled] = useState(false)
  const isPlayingFullStoryRef = useRef(false) // Ref to access in audio callbacks
  const isStoryLoopEnabledRef = useRef(false) // Ref to access in audio callbacks
  const fullStoryFailureCountRef = useRef(0) // Track consecutive pages without audio

  // Article-level loop + repeat (TTS/VOICEVOX only)
  const [isArticleLoopEnabled, setIsArticleLoopEnabled] = useState(false)
  const [repeatCount, setRepeatCount] = useState(3)
  const [currentRepeat, setCurrentRepeat] = useState(1)
  const isArticleLoopEnabledRef = useRef(false)
  const repeatCountRef = useRef(3)
  const currentRepeatRef = useRef(1)

  // Lock screen state (prevents accidental touches during full story playback)
  const [isScreenLocked, setIsScreenLocked] = useState(false)

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

  const isArticleAudioActive =
    (ttsPlaying || isPreGeneratedPlaying) && !isPlayingFullStory && !isNhkPlaying

  // AI word explanation feature
  const [isWordModalOpen, setIsWordModalOpen] = useState(false)
  const [wordContext, setWordContext] = useState<string | undefined>(undefined)

  // Detect if this is a book (from Toshokan Library) vs a news article
  const isBook = article.source === 'Toshokan Library'
  const isStoryContent = contentType === 'story' || isStoryMode

  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    currentWord,
    reset: resetWordExplanation,
    prefetch: prefetchWordExplanations,
  } = useWordExplanation({
    // Use bookId for books, articleId for news articles
    articleId: isBook || isStoryContent ? undefined : article.id,
    bookId: isBook ? article.id : undefined,
    storyId: isStoryContent ? article.id : undefined,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const enabled = localStorage.getItem('moshi-debug') === 'true' || params.has('debug')
    setDebugEnabled(enabled || true)
  }, [])

  useEffect(() => {
    if (!debugEnabled || typeof window === 'undefined') return
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail?.message) {
        addDebugEvent(customEvent.detail.message, customEvent.detail.data)
      }
    }
    window.addEventListener('moshi-debug', handler)
    return () => window.removeEventListener('moshi-debug', handler)
  }, [debugEnabled, addDebugEvent])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePointerMove = (event: PointerEvent) => {
      if (!debugDragStateRef.current.dragging) return
      const deltaX = event.clientX - debugDragStateRef.current.startX
      const deltaY = event.clientY - debugDragStateRef.current.startY
      setDebugPanelPos({
        x: debugDragStateRef.current.originX + deltaX,
        y: debugDragStateRef.current.originY + deltaY,
      })
    }
    const handlePointerUp = () => {
      debugDragStateRef.current.dragging = false
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [])

  // Cleanup audio when component unmounts or article changes
  useEffect(() => {
    return () => {
      cleanupAudio(preGeneratedAudioRef.current)
      preGeneratedAudioRef.current = null
      // Stop NHK audio if playing
      stopNhkAudio()
      // Stop TTS audio if playing
      ttsStop()
      // Reset full story mode
      setIsPlayingFullStory(false)
      // Reset article loop + repeat
      setIsArticleLoopEnabled(false)
      setRepeatCount(3)
      setCurrentRepeat(1)
      // Reset lock screen
      setIsScreenLocked(false)
    }
  }, [article.id, stopNhkAudio, ttsStop])

  // Sync full story refs with state (for access in audio callbacks)
  useEffect(() => {
    isPlayingFullStoryRef.current = isPlayingFullStory
  }, [isPlayingFullStory])

  useEffect(() => {
    isStoryLoopEnabledRef.current = isStoryLoopEnabled
  }, [isStoryLoopEnabled])

  useEffect(() => {
    isArticleLoopEnabledRef.current = isArticleLoopEnabled
  }, [isArticleLoopEnabled])

  useEffect(() => {
    repeatCountRef.current = repeatCount
  }, [repeatCount])

  useEffect(() => {
    currentRepeatRef.current = currentRepeat
  }, [currentRepeat])

  // Prefetch word explanations for instant modal response
  useEffect(() => {
    if (!article?.id) return

    // Story: use full story text (all pages) under story collection
    if (isStoryContent && pages?.length) {
      const fullText = pages
        .map(p => p.text || '')
        .filter(Boolean)
        .join(' ')
      if (fullText) {
        addDebugEvent('[WordExplanation] Prefetch start', {
          contentType: 'story',
          textLength: fullText.length,
          pages: pages.length,
        })
        prefetchWordExplanations({
          contentId: article.id,
          contentType: 'story',
          text: fullText,
        })
          .then(() => {
            addDebugEvent('[WordExplanation] Prefetch queued', { contentType: 'story' })
          })
          .catch((error: unknown) => {
            addDebugEvent('[WordExplanation] Prefetch failed', {
              contentType: 'story',
              error: error instanceof Error ? error.message : String(error),
            })
          })
      }
      return
    }

    // Book: use article.content under book collection
    if (isBook && article.content) {
      addDebugEvent('[WordExplanation] Prefetch start', {
        contentType: 'book',
        textLength: typeof article.content === 'string' ? article.content.length : 0,
      })
      prefetchWordExplanations({
        contentId: article.id,
        contentType: 'book',
        text: typeof article.content === 'string' ? article.content : '',
      })
        .then(() => addDebugEvent('[WordExplanation] Prefetch queued', { contentType: 'book' }))
        .catch((error: unknown) => {
          addDebugEvent('[WordExplanation] Prefetch failed', {
            contentType: 'book',
            error: error instanceof Error ? error.message : String(error),
          })
        })
      return
    }

    // News article default
    if (article.content) {
      addDebugEvent('[WordExplanation] Prefetch start', {
        contentType: 'article',
        textLength: typeof article.content === 'string' ? article.content.length : 0,
      })
      prefetchWordExplanations({
        contentId: article.id,
        contentType: 'article',
        text: typeof article.content === 'string' ? article.content : '',
      })
        .then(() => addDebugEvent('[WordExplanation] Prefetch queued', { contentType: 'article' }))
        .catch((error: unknown) => {
          addDebugEvent('[WordExplanation] Prefetch failed', {
            contentType: 'article',
            error: error instanceof Error ? error.message : String(error),
          })
        })
    }
  }, [
    article?.id,
    article.content,
    isBook,
    isStoryContent,
    pages,
    prefetchWordExplanations,
    addDebugEvent,
  ])

  useEffect(() => {
    if (!debugEnabled) return
    addDebugEventOnce(
      `story-cache-${storySentenceData.isLoading}-${storySentenceData.hasCachedData}-${storySentenceData.pageData?.length ?? 0}`,
      '[SentenceData] Story cache state',
      {
        isLoading: storySentenceData.isLoading,
        hasCachedData: storySentenceData.hasCachedData,
        pageCount: storySentenceData.pageData?.length ?? 0,
      }
    )
  }, [
    debugEnabled,
    storySentenceData.isLoading,
    storySentenceData.hasCachedData,
    storySentenceData.pageData,
    addDebugEvent,
    addDebugEventOnce,
  ])

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
  const handleWordClick = async (word: string, event: React.MouseEvent, sentenceContext?: string) => {
    console.log('[Article Reader] handleWordClick called with word:', word)
    const cleanWord = word.replace(/<[^>]*>/g, '').trim()
    console.log('[Article Reader] cleanWord:', cleanWord)
    if (!cleanWord || cleanWord.length === 0) {
      console.log('[Article Reader] No clean word, returning')
      return
    }

    // Use the specific sentence context if provided, otherwise fall back to current content
    const context = sentenceContext || currentContent
    console.log('[Article Reader] Opening word modal with context:', context?.substring(0, 100))
    setIsWordModalOpen(true)
    setWordContext(context)
    await explainWord(cleanWord, context)
  }

  const handleCloseWordModal = () => {
    console.log('[Article Reader] Closing word modal')
    setIsWordModalOpen(false)
    setWordContext(undefined)
    resetWordExplanation()
  }

  const handlePlayArticle = async () => {
    // Stop any sentence-level playback
    setPlayingSentenceIndex(null)
    setSentenceAudioLoading(null)

    // Stop full story mode when using the single-page play button
    // This gives the user control to switch from "play all" to "play current page"
    if (isPlayingFullStory) {
      setIsPlayingFullStory(false)
    }

    console.log(
      '%c🔊 AUDIO PROVIDER TRACKING - Full Article Playback',
      'background: #4CAF50; color: white; font-size: 14px; padding: 4px 8px; border-radius: 4px;'
    )
    console.log('Available audio sources:', {
      nhkOriginal: '⏩ Ignored (legacy)',
      voicevoxPreGenerated: article.generatedContentAudioUrl
        ? '✅ Available (Priority 1)'
        : '❌ Not available',
      appTtsFallback: '✅ Always available (Priority 2)',
    })

    const isActiveAudio = ttsPlaying || isPreGeneratedPlaying || !!currentTTSText
    if (isArticleLoopEnabledRef.current && !isActiveAudio) {
      currentRepeatRef.current = 1
      setCurrentRepeat(1)
    }

    // Use pre-generated VOICEVOX if present; otherwise app TTS fallback
    handleVoicevoxOrTTSFallback({ forceFullAudio: isArticleLoopEnabledRef.current })
  }

  // ============================================
  // FULL STORY PLAYBACK (Play All Pages)
  // ============================================

  /**
   * Play a specific page's audio for full story mode
   * Handles the audio element creation and event listeners
   */
  const playPageAudioForFullStory = async (pageIndex: number) => {
    if (!pages || pageIndex >= pages.length) {
      console.log('[Full Story] Invalid page index, stopping')
      setIsPlayingFullStory(false)
      return
    }

    const pageAudioUrl = pages[pageIndex]?.audioUrl
    if (!pageAudioUrl) {
      console.log(`[Full Story] No audio for page ${pageIndex + 1}, advancing to next`)
      fullStoryFailureCountRef.current += 1
      // No audio for this page, try next page
      handleFullStoryPageEnd(pageIndex)
      return
    }

    // Reset failure counter when we successfully find audio
    fullStoryFailureCountRef.current = 0

    // Clean up existing audio
    if (preGeneratedAudioRef.current) {
      cleanupAudio(preGeneratedAudioRef.current)
      preGeneratedAudioRef.current = null
    }

    console.log(`[Full Story] Playing page ${pageIndex + 1} of ${pages.length}`)

    const audio = new Audio(pageAudioUrl)
    audio.playbackRate = Number.isFinite(settings.playbackSpeed) ? settings.playbackSpeed! : 1.0

    audio.onplay = () => {
      setIsPreGeneratedPlaying(true)
    }

    audio.onpause = () => {
      setIsPreGeneratedPlaying(false)
    }

    audio.onended = () => {
      setIsPreGeneratedPlaying(false)
      console.log(`[Full Story] Page ${pageIndex + 1} audio finished`)
      // Check refs for current state (state may have changed during playback)
      if (isPlayingFullStoryRef.current) {
        handleFullStoryPageEnd(pageIndex)
      }
    }

    audio.onerror = () => {
      console.error(`[Full Story] Audio error on page ${pageIndex + 1}`)
      setIsPreGeneratedPlaying(false)
      // Skip to next page on error
      if (isPlayingFullStoryRef.current) {
        handleFullStoryPageEnd(pageIndex)
      }
    }

    preGeneratedAudioRef.current = audio

    try {
      await audio.play()
    } catch (error) {
      console.error('[Full Story] Failed to play audio:', error)
      setIsPreGeneratedPlaying(false)
      // Try next page on play failure
      if (isPlayingFullStoryRef.current) {
        handleFullStoryPageEnd(pageIndex)
      }
    }
  }

  /**
   * Handle when a page's audio ends during full story playback
   * Advances to next page or loops back to start
   */
  const handleFullStoryPageEnd = (completedPageIndex: number) => {
    if (!isPlayingFullStoryRef.current || !pages) {
      return
    }

    const nextPageIndex = completedPageIndex + 1

    // Safety check: if we've tried all pages without finding audio, stop
    if (fullStoryFailureCountRef.current >= pages.length) {
      console.warn('[Full Story] No audio found on any page - stopping playback')
      setIsPlayingFullStory(false)
      fullStoryFailureCountRef.current = 0
      return
    }

    if (nextPageIndex < pages.length) {
      // Advance to next page
      console.log(`[Full Story] Advancing to page ${nextPageIndex + 1}`)
      setCurrentPageIndex(nextPageIndex)
      // Small delay to let React update, then play next page
      setTimeout(() => {
        if (isPlayingFullStoryRef.current) {
          playPageAudioForFullStory(nextPageIndex)
        }
      }, 150)
    } else if (isStoryLoopEnabledRef.current) {
      // Loop back to first page
      console.log('[Full Story] Looping back to page 1')
      setCurrentPageIndex(0)
      setTimeout(() => {
        if (isPlayingFullStoryRef.current) {
          playPageAudioForFullStory(0)
        }
      }, 150)
    } else {
      // End of story, stop full story mode
      console.log('[Full Story] Story complete, stopping')
      setIsPlayingFullStory(false)
      fullStoryFailureCountRef.current = 0
    }
  }

  /**
   * Start/pause/resume full story playback
   */
  const handlePlayFullStory = async () => {
    if (!isStoryMode || !pages || pages.length === 0) return

    // Stop any sentence-level playback
    setPlayingSentenceIndex(null)
    setSentenceAudioLoading(null)

    // If already playing full story, pause it
    if (isPlayingFullStory && isPreGeneratedPlaying && preGeneratedAudioRef.current) {
      console.log('[Full Story] Pausing')
      preGeneratedAudioRef.current.pause()
      return
    }

    // If paused during full story mode, resume
    if (isPlayingFullStory && !isPreGeneratedPlaying && preGeneratedAudioRef.current && !preGeneratedAudioRef.current.ended) {
      console.log('[Full Story] Resuming')
      try {
        await preGeneratedAudioRef.current.play()
        setIsPreGeneratedPlaying(true)
      } catch (error) {
        console.error('[Full Story] Resume failed:', error)
      }
      return
    }

    // Check if any pages have audio before starting
    const pagesWithAudio = pages.filter(p => p.audioUrl)
    if (pagesWithAudio.length === 0) {
      console.warn('[Full Story] No pages have audio - cannot start full story playback')
      showToast(t('story.noAudioAvailable'), 'warning', 5000)
      return
    }

    // Start fresh full story playback from current page
    console.log(`[Full Story] Starting from page ${currentPageIndex + 1}`)
    fullStoryFailureCountRef.current = 0 // Reset failure counter
    setIsPlayingFullStory(true)
    playPageAudioForFullStory(currentPageIndex)
  }

  /**
   * Stop full story playback completely
   */
  const handleStopFullStory = () => {
    console.log('[Full Story] Stopping')
    setIsPlayingFullStory(false)
    fullStoryFailureCountRef.current = 0 // Reset failure counter
    if (preGeneratedAudioRef.current) {
      cleanupAudio(preGeneratedAudioRef.current)
      preGeneratedAudioRef.current = null
    }
    setIsPreGeneratedPlaying(false)
  }

  /**
   * Restart current audio playback from the beginning
   * Simply restarts whatever is currently playing (article, page, etc.)
   */
  const handleRestartFullStory = () => {
    console.log('[Audio] Restarting current audio')

    // Stop current playback
    if (preGeneratedAudioRef.current) {
      cleanupAudio(preGeneratedAudioRef.current)
      preGeneratedAudioRef.current = null
    }
    setIsPreGeneratedPlaying(false)
    ttsStop()
    if (isArticleLoopEnabledRef.current) {
      currentRepeatRef.current = 1
      setCurrentRepeat(1)
    }

    // Restart current audio (whether it's an article, single page, or current page in full story)
    setTimeout(() => {
      handlePlayArticle()
    }, 150)
  }

  /**
   * Toggle loop mode for full story playback
   */
  const handleToggleStoryLoop = () => {
    setIsStoryLoopEnabled(prev => !prev)
    console.log(`[Full Story] Loop ${!isStoryLoopEnabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Toggle loop mode for full article audio (TTS/VOICEVOX only)
   */
  const handleToggleArticleLoop = () => {
    setIsArticleLoopEnabled(prev => {
      const next = !prev
      if (!next) {
        currentRepeatRef.current = 1
        setCurrentRepeat(1)
      } else if (isArticleAudioActive) {
        currentRepeatRef.current = 1
        setCurrentRepeat(1)
        if (preGeneratedAudioRef.current) {
          cleanupAudio(preGeneratedAudioRef.current)
          preGeneratedAudioRef.current = null
          setIsPreGeneratedPlaying(false)
        }
        ttsStop()
        setTimeout(() => {
          handleVoicevoxOrTTSFallback({ forceFullAudio: true })
        }, 150)
      }
      return next
    })
  }

  /**
   * Change repeat count for full article audio
   */
  const handleArticleRepeatChange = (value: number) => {
    const nextCount = Math.min(10, Math.max(1, Math.floor(value)))
    setRepeatCount(nextCount)
    repeatCountRef.current = nextCount
    if (currentRepeatRef.current > nextCount) {
      currentRepeatRef.current = nextCount
      setCurrentRepeat(nextCount)
    }
  }

  /**
   * Toggle lock screen (prevents accidental touches)
   */
  const handleToggleLock = () => {
    if (isScreenLocked) {
      return
    }
    if (!isArticleLoopEnabled && !isStoryLoopEnabled) {
      return
    }
    if (isArticleLoopEnabled && !isArticleAudioActive) {
      handlePlayArticle()
    }
    setIsScreenLocked(true)
    console.log('[Lock Screen] Locked')
  }

  /**
   * Unlock screen handler (called by LockScreen component)
   */
  const handleUnlockScreen = () => {
    setIsScreenLocked(false)
    console.log('[Lock Screen] Unlocked via Doshi tap')
  }

  // Auto-unlock when conditions change
  useEffect(() => {
    const shouldStayLocked =
      (isPlayingFullStory && isStoryLoopEnabled) || isArticleLoopEnabled

    // Unlock if playback/loop conditions are no longer satisfied
    if (isScreenLocked && !shouldStayLocked) {
      console.log('[Lock Screen] Auto-unlocking - playback conditions changed')
      setIsScreenLocked(false)
    }
  }, [
    isScreenLocked,
    isPlayingFullStory,
    isStoryLoopEnabled,
    isArticleLoopEnabled,
  ])

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

    // Initialize and play NHK audio with autoPlay once ready
    if (article.nhkAudioUrl) {
      try {
        console.log('[Article Reader] Initializing NHK HLS stream:', article.nhkAudioUrl)
        initializeNhkAudio(article.nhkAudioUrl, {
          autoPlay: true,
          playbackRate: settings.playbackSpeed,
        })
      } catch (error) {
        console.error('[Article Reader] NHK audio failed, falling back to TTS:', error)
        // Fall back to VOICEVOX/TTS
        handleVoicevoxOrTTSFallback()
      }
    }
  }

  // Handle VOICEVOX TTS playback
  const handleVoicevoxOrTTSFallback = async (
    options?: {
      forceFullAudio?: boolean
    }
  ) => {
    console.log('%c🔄 Attempting VOICEVOX TTS playback...', 'color: #FF9800; font-weight: bold;')

    // In story mode, prefer per-page audio URL if available
    // This allows audio to naturally stop at page boundaries
    const currentPageAudioUrl = isStoryMode ? pages![currentPageIndex]?.audioUrl : undefined
    const shouldForceFullAudio = options?.forceFullAudio ?? false
    const audioUrlToUse = shouldForceFullAudio
      ? article.generatedContentAudioUrl
      : (currentPageAudioUrl || article.generatedContentAudioUrl)

    if (audioUrlToUse) {
      // If already playing VOICEVOX audio, pause it
      if (isPreGeneratedPlaying && preGeneratedAudioRef.current) {
        preGeneratedAudioRef.current.pause()
        setIsPreGeneratedPlaying(false)
        console.log('[Article Reader] Paused VOICEVOX TTS audio')
        return
      }

      // If VOICEVOX audio is paused, resume it - but only if it's the same page's audio
      // Compare by checking if the current audio src contains the expected filename
      const expectedFilename = audioUrlToUse.split('/').pop() || ''
      const currentAudioMatchesPage = preGeneratedAudioRef.current?.src?.includes(
        encodeURIComponent(expectedFilename)
      )

      if (
        preGeneratedAudioRef.current &&
        !preGeneratedAudioRef.current.ended &&
        currentAudioMatchesPage
      ) {
        preGeneratedAudioRef.current.play()
        setIsPreGeneratedPlaying(true)
        console.log('[Article Reader] Resumed VOICEVOX TTS audio (same page)')
        return
      }

      // If there's old audio from a different page, clean it up first
      if (preGeneratedAudioRef.current) {
        console.log('[Article Reader] Cleaning up old audio before playing new page')
        cleanupAudio(preGeneratedAudioRef.current)
        preGeneratedAudioRef.current = null
      }

      // Otherwise, start playing VOICEVOX audio from beginning
      try {
        const isPerPageAudio = !shouldForceFullAudio && !!currentPageAudioUrl
        console.log(
          `%c[Audio] SOURCE: FIREBASE PRE-CACHED (${isPerPageAudio ? 'Per-Page' : 'Full Audio'} VOICEVOX TTS)`,
          'color: #ff9900; font-weight: bold',
          {
            provider: article.audioProvider || 'voicevox',
            voice: article.audioVoice,
            ...(isPerPageAudio && { page: currentPageIndex + 1 }),
          }
        )

        // Clean up existing audio if any
        if (preGeneratedAudioRef.current) {
          cleanupAudio(preGeneratedAudioRef.current)
          preGeneratedAudioRef.current = null
        }

        // Create new audio element
        // Firebase Storage files are public, load directly for instant playback
        const audioUrl = audioUrlToUse

        console.log('[Article Reader] Loading audio URL:', audioUrl)

        const audio = new Audio(audioUrl)
        // Validate playbackSpeed to prevent "non-finite" error
        audio.playbackRate = Number.isFinite(settings.playbackSpeed) ? settings.playbackSpeed! : 1.0

        // Set up event listeners
        audio.onplay = () => {
          setIsPreGeneratedPlaying(true)
          console.log('[Article Reader] VOICEVOX TTS audio started')
        }

        audio.onpause = () => {
          setIsPreGeneratedPlaying(false)
          console.log('[Article Reader] VOICEVOX TTS audio paused')
        }

        audio.onended = () => {
          setIsPreGeneratedPlaying(false)
          console.log('[Article Reader] VOICEVOX TTS audio finished')
          handleArticleAudioEnd()
        }

        audio.onerror = () => {
          const mediaError = audio.error
          const errorCode = mediaError?.code
          const errorMessage =
            errorCode === MediaError.MEDIA_ERR_ABORTED
              ? 'Audio playback was aborted'
              : errorCode === MediaError.MEDIA_ERR_NETWORK
                ? 'Network error while loading audio'
                : errorCode === MediaError.MEDIA_ERR_DECODE
                  ? 'Audio decoding failed'
                  : errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                    ? 'Audio format not supported or source unavailable'
                    : mediaError?.message || 'Unknown audio error'

          console.error('[Article Reader] VOICEVOX TTS audio error:', {
            code: errorCode,
            message: errorMessage,
            src: audio.src,
            originalUrl: audioUrlToUse,
          })
          setIsPreGeneratedPlaying(false)
          // Fall back to app TTS on error
          console.log('[Article Reader] Falling back to app TTS')
          handleTTSPlayback({ forceFullAudio: shouldForceFullAudio })
        }

        preGeneratedAudioRef.current = audio
        await audio.play()
        console.log(
          '%c▶️ PLAYING: VOICEVOX Pre-generated TTS (Priority 1)',
          'background: #9C27B0; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
        )
        console.log('Provider: VOICEVOX (pre-generated, cached in Firebase Storage)')
        return
      } catch (error: any) {
        if (
          error?.name === 'AbortError' ||
          String(error?.message || '').includes('play() request was interrupted')
        ) {
          return
        }
        console.error('[Article Reader] Failed to play VOICEVOX audio:', error)
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
    handleTTSPlayback({ forceFullAudio: shouldForceFullAudio })
  }

  // Separate TTS playback logic for cleaner code
  const handleTTSPlayback = async (options?: { forceFullAudio?: boolean }) => {
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
        'Provider chain: VOICEVOX → ElevenLabs (check server logs for actual provider used)'
      )
      const shouldForceFullAudio = options?.forceFullAudio ?? false
      const textToPlay = shouldForceFullAudio && fullAudioContent
        ? fullAudioContent
        : currentContent
      await playTTS(textToPlay, {
        speed: settings.playbackSpeed,
      })
      console.log('Article playback started with App TTS fallback')
    } catch (error) {
      console.error('Failed to play article with TTS:', error)
      // Error already logged by onError callback in useTTS
      // Could show user-facing error notification here if toast system exists
    }
  }

  /**
   * Handle end of full-article audio (VOICEVOX or App TTS) for loop/repeat
   */
  const handleArticleAudioEnd = () => {
    if (playingSentenceIndex !== null) return
    if (isPlayingFullStoryRef.current) return
    if (isNhkPlaying) return

    if (!isArticleLoopEnabledRef.current) {
      currentRepeatRef.current = 1
      setCurrentRepeat(1)
      return
    }

    const nextRepeat = currentRepeatRef.current + 1
    if (nextRepeat <= repeatCountRef.current) {
      currentRepeatRef.current = nextRepeat
      setCurrentRepeat(nextRepeat)
      setTimeout(() => {
        handleVoicevoxOrTTSFallback({ forceFullAudio: true })
      }, 150)
      return
    }

    currentRepeatRef.current = 1
    setCurrentRepeat(1)
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

  // Handle playing individual sentence with pre-cached audio + fallback
  // Flow: Pre-cached audio → VOICEVOX API → App TTS fallback
  const handlePlaySentence = async (sentence: string, index: number) => {
    // Stop full story mode when playing individual sentences
    if (isPlayingFullStory) {
      setIsPlayingFullStory(false)
    }

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

    // PRIORITY 0: Check for pre-cached audio URL (instant playback, no API call)
    // BUT: Skip pre-cached audio if user changed speed from default (1.0)
    // because pre-cached audio was generated at default speed and changing playbackRate
    // just speeds up/slows down the audio instead of regenerating at correct speed
    const currentSpeed = settings.playbackSpeed || 1.0
    const preCachedAudioUrl = getPreCachedAudioUrl(sentence)

    if (preCachedAudioUrl && currentSpeed !== 1.0) {
      console.log(
        `%c⚠️ Skipping pre-cached audio due to speed change (${currentSpeed}x) - will regenerate at correct speed`,
        'color: #FF9800; font-weight: bold;'
      )
    }

    if (preCachedAudioUrl && currentSpeed === 1.0) {
      try {
        console.log(
          '%c▶️ PLAYING: Pre-Cached Sentence Audio (Priority 0)',
          'background: #2196F3; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
        )
        console.log('Source: Firebase Storage (pre-generated VOICEVOX)')

        const audio = new Audio(preCachedAudioUrl)
        audio.playbackRate = 1.0

        audio.onended = () => {
          setSentenceAudioLoading(null)
          setPlayingSentenceIndex(null)
          console.log('[Article Reader] Pre-cached sentence playback completed')
        }

        audio.onerror = e => {
          console.error('[Article Reader] Pre-cached audio playback error:', e)
          setSentenceAudioLoading(null)
          setPlayingSentenceIndex(null)
        }

        await audio.play()
        setSentenceAudioLoading(null)
        return // Success!
      } catch (preCachedError) {
        console.log(
          '%c⚠️ Pre-cached audio failed, falling back to API...',
          'color: #f44336; font-weight: bold;',
          preCachedError
        )
        // Fall through to API-based generation
      }
    }

    // PRIORITY 1: Try VOICEVOX TTS via API (cached or on-demand generation)
    try {
      console.log('[Article Reader] Attempting VOICEVOX sentence audio via API (Priority 1)...')

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
            '%c▶️ PLAYING: VOICEVOX Sentence TTS (Priority 1)',
            'background: #9C27B0; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
          )
          console.log('Provider: VOICEVOX via Modal API', {
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
            console.log('[Article Reader] VOICEVOX sentence playback completed')
          }

          audio.onerror = e => {
            console.error('[Article Reader] VOICEVOX audio playback error:', e)
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
        '%c⚠️ VOICEVOX sentence generation failed, falling back to app TTS...',
        'color: #f44336; font-weight: bold;'
      )
    } catch (voicevoxError) {
      console.log(
        '%c⚠️ VOICEVOX error, falling back to app TTS:',
        'color: #f44336; font-weight: bold;',
        voicevoxError
      )
      // Fall through to app TTS
    }

    // PRIORITY 2: Fallback to app TTS (which also makes API calls via Edge TTS)
    try {
      console.log(
        '%c▶️ PLAYING: App TTS Fallback (Priority 2)',
        'background: #FF5722; color: white; font-size: 12px; padding: 2px 6px; border-radius: 3px;'
      )
      console.log('Provider chain: VOICEVOX → ElevenLabs → Edge-TTS')
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

  // Story mode: Quiz UI
  if (showQuiz && quiz && quiz.length > 0) {
    return (
      <>
        {/* Desktop Navbar */}
        <div className="hidden sm:block">
          <Navbar user={user} showUserMenu={true} />
        </div>

        <QuizPlayer
          questions={quiz}
          contentType={isStoryMode ? 'story' : 'comic'}
          contentId={article.id}
          contentTitle={displayTitle}
          onComplete={handleQuizComplete}
          onExit={handleQuizFinish}
          onBack={() => setShowQuiz(false)}
          showTranslation={settings.translationMode !== 'off'}
          enableAutoSave={true}
          showFurigana={settings.showFurigana}
          fontSize={settings.fontSize}
          // Content metadata for celebration
          difficulty={article.difficulty}
          pageCount={pages?.length}
        />
      </>
    )
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

      {debugEnabled && (
        <div
          className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[90vw] rounded-lg border border-white/20 bg-black/80 text-white shadow-xl backdrop-blur select-none touch-none"
          style={{ transform: `translate(${debugPanelPos.x}px, ${debugPanelPos.y}px)` }}
        >
          <div
            className="px-3 py-2 text-xs font-semibold border-b border-white/10 cursor-move flex items-center justify-between gap-2"
            onPointerDown={(event) => {
              debugDragStateRef.current = {
                dragging: true,
                startX: event.clientX,
                startY: event.clientY,
                originX: debugPanelPos.x,
                originY: debugPanelPos.y,
              }
            }}
          >
            <span>Debug Panel</span>
            <button
              type="button"
              className="rounded px-2 py-1 text-[10px] font-semibold bg-white/10 hover:bg-white/20 active:bg-white/30"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={async () => {
                const content = [
                  `Content: ${contentType}`,
                  `Page: ${currentPageIndex + 1} / ${totalPages}`,
                  `Story sentence cache: ${
                    storySentenceData.isLoading
                      ? 'loading'
                      : storySentenceData.hasCachedData
                        ? 'ready'
                        : 'missing'
                  }`,
                  `Page translation: ${currentTranslation ? 'present' : 'missing'}`,
                  `Translated content: ${translatedContent ? 'present' : 'empty'}`,
                  '',
                  ...debugEvents,
                ].join('\n')
                try {
                  await navigator.clipboard.writeText(content)
                  addDebugEventOnce('debug-copy', '[Debug] Copied panel to clipboard')
                } catch (error) {
                  addDebugEventOnce('debug-copy-failed', '[Debug] Clipboard copy failed', {
                    error: error instanceof Error ? error.message : String(error),
                  })
                }
              }}
            >
              Copy
            </button>
          </div>
          <div className="px-3 py-2 text-xs space-y-2 border-b border-white/10">
            {isStoryMode && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[10px] font-semibold bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-40 disabled:hover:bg-white/10"
                  onClick={() => handlePageChange('prev')}
                  disabled={currentPageIndex === 0}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[10px] font-semibold bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-40 disabled:hover:bg-white/10"
                  onClick={() => handlePageChange('next')}
                  disabled={currentPageIndex >= totalPages - 1}
                >
                  Next
                </button>
                <span className="text-[10px] text-white/70">Navigate pages</span>
              </div>
            )}
            <div>Content: {contentType}</div>
            <div>Page: {currentPageIndex + 1} / {totalPages}</div>
            <div>Story sentence cache: {storySentenceData.isLoading ? 'loading' : (storySentenceData.hasCachedData ? 'ready' : 'missing')}</div>
            <div>Page translation: {currentTranslation ? 'present' : 'missing'}</div>
            <div>Translated content: {translatedContent ? 'present' : 'empty'}</div>
            {/* iOS-specific debugging info */}
            {(() => {
              const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
              if (!isIOS) return null

              const iosVersion = navigator.userAgent.match(/OS (\d+)_(\d+)/)?.[1] || 'Unknown'
              const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
              // Check if Storage API is available (not available in private mode)
              const hasStorageAPI = typeof navigator !== 'undefined' && typeof navigator.storage !== 'undefined'

              return (
                <div className="pt-2 border-t border-yellow-500/30 space-y-1">
                  <div className="text-yellow-300 font-semibold">📱 iOS Debug Info:</div>
                  <div className="text-yellow-200">iOS Version: {iosVersion}</div>
                  <div className="text-yellow-200">Safari: {isSafari ? 'Yes' : 'No'}</div>
                  <div className="text-yellow-200">Storage API: {hasStorageAPI ? 'Available' : 'Unavailable'}</div>
                  <div className="text-yellow-200">TTS State: {ttsPlaying ? 'Playing' : ttsLoading ? 'Loading' : 'Idle'}</div>
                </div>
              )
            })()}
          </div>
          <div className="max-h-64 overflow-auto px-3 py-2 text-[11px] leading-snug space-y-1 select-text">
            {debugEvents.length === 0 ? (
              <div className="text-white/60">No events yet.</div>
            ) : (
              debugEvents.map((event, idx) => (
                <div key={idx} className="text-white/80">
                  {event}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Header - Sticky & Glassmorphic */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-800/50 transition-all duration-300 supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/stories')}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium hidden sm:inline">{t('common.back')}</span>
          </button>

          {/* Simple Play/Pause Button - Shows playback state only */}
          <button
            onClick={handlePlayArticle}
            disabled={ttsLoading}
            className={`ml-auto px-5 py-2 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 shadow-sm font-medium ${
              ttsLoading
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-wait'
                : 'bg-primary-500 text-white hover:bg-primary-600 hover:shadow-md hover:shadow-primary-500/20'
            }`}
            aria-label={
              ttsLoading
                ? t('common.loading')
                : ttsPlaying || isPreGeneratedPlaying
                  ? t('common.pause')
                  : t('common.play')
            }
          >
            {ttsLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full" />
                <span className="text-sm hidden sm:inline">{t('common.loading')}</span>
              </>
            ) : (isArticleLoopEnabled || isStoryLoopEnabled) && (ttsPlaying || isPreGeneratedPlaying) ? (
              <>
                <Repeat className="w-4 h-4 animate-pulse" />
                <span className="text-sm hidden sm:inline">{t('common.looping')}</span>
              </>
            ) : ttsPlaying || isPreGeneratedPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span className="text-sm hidden sm:inline">{t('common.pause')}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span className="text-sm hidden sm:inline">{t('common.play')}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 pb-32 pt-8">
        {/* Hero Image Section */}
        <div className="mb-10 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-gray-900/5 dark:ring-white/10 aspect-[21/9] relative bg-gray-100 dark:bg-gray-800 group">
          {/* Story mode with missing image - show beautiful gradient with emojis */}
          {isStoryMode && !currentPageImage ? (
            <StoryPageFallback pageIndex={currentPageIndex} title={displayTitle} />
          ) : (
            <NewsArticleFallbackImage
              imageUrl={currentPageImage}
              title={displayTitle}
              source={article.source}
              category={article.category}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

          {/* Settings Button - Top Right inside image */}
          {!settings.shadowingMode && (
            <div className="absolute top-1 right-1 z-10">
              <button
                onClick={() => setShowMobileSettings(true)}
                className="w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
                }}
                title={t('news.reader.settings')}
              >
                <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </button>
            </div>
          )}

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
                text={displayTitle}
                showFurigana={settings.showFurigana}
                fontSize="xlarge"
                highlightGrammar={false}
                highlightMode="none"
                onWordClick={(word, event) => handleWordClick(word, event, displayTitle)}
              />
            </h1>

            {/* Title action buttons */}
            <div className="flex items-center justify-center gap-3 mt-4 mb-6">
              {/* Play title button */}
              <button
                onClick={() => handlePlaySentence(displayTitle, -1)}
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
                onClick={() => handleTranslateSegment(displayTitle, -1)}
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
            sentences={splitIntoSentences(currentContent)}
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
                </div>
              )}
            </div>

            {/* Translation Content */}
            {translationLoading && !isStoryMode ? (
              <div className="flex items-center gap-3 py-8">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <span style={{ color: 'var(--article-text-secondary)' }}>
                  Translating with AI • Firebase caching enabled...
                </span>
              </div>
            ) : translationError && !isStoryMode ? (
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

            {/* Translation Source Status */}
            {translatedContent && !translationLoading && (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs">
                <span style={{ color: 'var(--article-text-secondary)' }} className="opacity-70">
                  {isStoryMode ? '📖 Pre-stored story translation' : '🔥 Powered by Firebase Translation Cache'}
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
            {article.url && !isStoryMode && (
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

          {/* Navigation/Complete Section */}
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            {isStoryMode ? (
              /* Story Mode: Page Navigation */
              <div className="flex flex-col gap-4">
                {/* Page indicator */}
                <div className="flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        // Stop full story mode when manually selecting page
                        if (isPlayingFullStory) {
                          handleStopFullStory()
                        }
                        setCurrentPageIndex(index)
                        setTranslatedContent(null)
                      }}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                        index === currentPageIndex
                          ? 'bg-primary-500 scale-125'
                          : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                      }`}
                      aria-label={`Go to page ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handlePageChange('prev')}
                    disabled={currentPageIndex === 0}
                    className="px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: 'var(--article-hover-bg)',
                      color: 'var(--article-text)',
                    }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--article-text-secondary)' }}
                  >
                    {currentPageIndex + 1} / {totalPages}
                  </span>

                  <button
                    onClick={() => handlePageChange('next')}
                    className="px-4 py-2 rounded-xl text-white transition-all duration-200 hover:scale-105"
                    style={{
                      backgroundColor: 'rgb(var(--palette-primary-500))',
                    }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Article Mode: Mark Complete */
              <>
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

              </>
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
          onOpen={() => {
            console.log('Opening mobile settings')
            setShowMobileSettings(true)
          }}
          onClose={() => {
            console.log('Closing mobile settings')
            setShowMobileSettings(false)
          }}
          // Audio controls
          isPlayingAudio={ttsPlaying || isPreGeneratedPlaying}
          isArticleLoopEnabled={isArticleLoopEnabled}
          isStoryLoopEnabled={isStoryLoopEnabled}
          isScreenLocked={isScreenLocked}
          repeatCount={repeatCount}
          currentRepeat={currentRepeat}
          onPlayPause={handlePlayArticle}
          onRestart={handleRestartFullStory}
          onToggleArticleLoop={handleToggleArticleLoop}
          onToggleStoryLoop={handleToggleStoryLoop}
          onToggleLock={handleToggleLock}
          onRepeatCountChange={handleArticleRepeatChange}
          showAudioControls={!isNhkPlaying}
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
        translationContext={wordContext ? { sentence: wordContext } : undefined}
        showTranslationContext={true}
        enableRelatedTranslations={true}
        onWordLookup={(word) => handleWordClick(word, {} as React.MouseEvent)}
        ttsVoice="23"
      />

      {/* Shadowing Mode - MoshiPlayer Style */}
      {settings.shadowingMode && (
        <MoshiShadowingPlayer
          sentences={sentences}
          title={article.title}
          contentId={article.id}
          contentType={isStoryMode ? 'story' : isBook ? 'book' : 'article'}
          onClose={() => setSettings(prev => ({ ...prev, shadowingMode: false }))}
          initialSettings={{
            showFurigana: settings.showFurigana,
            highlightMode: settings.highlightMode,
            repeatCount: 3,
          }}
        />
      )}

      {/* Lock Screen - Prevents accidental touches during full story playback */}
      <LockScreen
        isLocked={
          isScreenLocked &&
          ((isPlayingFullStory && isStoryLoopEnabled) || isArticleLoopEnabled)
        }
        onUnlock={handleUnlockScreen}
        title={t('story.lockScreenTitle')}
        unlockText={t('story.lockScreenUnlockText')}
        className="z-[60]"
      />

      {/* Celebration Screen - Shows when article is completed */}
      {celebrationData?.show && (
        <ContentCelebration
          xpEarned={celebrationData.xp}
          readingTimeMs={celebrationData.readingTimeMs}
          difficulty={article.difficulty}
          contentTitle={displayTitle}
          contentType="article"
          onClose={() => setCelebrationData(null)}
        />
      )}
    </div>
  )
}
