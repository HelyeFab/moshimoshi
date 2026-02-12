'use client'

import React, { useEffect, useState, useRef } from 'react'
import KuromojiService, { TokenWithHighlight, POS_COLORS } from '@/utils/kuromojiService'
import { getSentenceOverride, setSentenceOverride } from '@/utils/furiganaOverrides'
import Modal from '@/components/ui/Modal'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface GrammarHighlightedTextProps {
  text: string
  highlightMode: 'none' | 'all' | 'content' | 'grammar'
  onWordClick?: (word: string, event: React.MouseEvent) => void
  showFurigana?: boolean
  className?: string
  furiganaClassName?: string
  furiganaContextKey?: string
  enableFuriganaEditing?: boolean
}

// Convert katakana to hiragana
function convertKatakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30FA]/g, function (match) {
    const chr = match.charCodeAt(0) - 0x60
    return String.fromCharCode(chr)
  })
}

export function GrammarHighlightedText({
  text,
  highlightMode,
  onWordClick,
  showFurigana = false,
  className = '',
  furiganaClassName = '',
  furiganaContextKey,
  enableFuriganaEditing = true,
}: GrammarHighlightedTextProps) {
  const [tokens, setTokens] = useState<TokenWithHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isKuromojiReady, setIsKuromojiReady] = useState(false)
  const [overrideMap, setOverrideMap] = useState<Record<number, string>>({})
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingSurface, setEditingSurface] = useState('')
  const [editingValue, setEditingValue] = useState('')
  const [isEditingOpen, setIsEditingOpen] = useState(false)
  const isMobile = useIsMobile()

  // Track the current request to avoid race conditions
  const requestIdRef = useRef(0)

  // Initialize Kuromoji once
  useEffect(() => {
    // KuromojiService is a singleton that doesn't need initialization
    // It uses the /api/furigana endpoint internally
    setIsKuromojiReady(true)
  }, [])

  const contextKey = furiganaContextKey || 'global'

  useEffect(() => {
    if (!showFurigana || !text) {
      setOverrideMap({})
      return
    }

    let active = true
    getSentenceOverride(contextKey, text)
      .then((record) => {
        if (!active) return
        setOverrideMap(record?.overrides || {})
      })
      .catch(() => {
        if (!active) return
        setOverrideMap({})
      })

    return () => {
      active = false
    }
  }, [contextKey, text, showFurigana])

  useEffect(() => {
    // Increment request ID to invalidate any pending requests
    const currentRequestId = ++requestIdRef.current

    const analyzeText = async () => {
      // Need to tokenize if grammar highlighting OR furigana is enabled
      const needsTokenization = highlightMode !== 'none' || showFurigana

      if (!isKuromojiReady || !needsTokenization || !text) {
        setTokens([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const kuromojiService = KuromojiService.getInstance()
        const analyzedTokens = await kuromojiService.tokenize(text)

        // Only update state if this is still the current request
        // This prevents race conditions when toggling rapidly
        if (currentRequestId === requestIdRef.current) {
          setTokens(analyzedTokens)
          setError(null)
        }
      } catch (err) {
        // Ignore AbortError - this is expected when requests are cancelled
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        // Only update state if this is still the current request
        if (currentRequestId === requestIdRef.current) {
          console.error('Failed to analyze text:', err)
          setError('Failed to analyze text')
          setTokens([])
        }
      } finally {
        // Only update loading state if this is still the current request
        if (currentRequestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }

    analyzeText()

    // Cleanup: increment request ID to invalidate this request if component updates
    return () => {
      requestIdRef.current++
    }
  }, [text, highlightMode, showFurigana, isKuromojiReady])

  const shouldHighlight = (token: TokenWithHighlight): boolean => {
    if (highlightMode === 'none') return false
    if (highlightMode === 'all') return true

    const kuromojiService = KuromojiService.getInstance()

    if (highlightMode === 'content') {
      return kuromojiService.isContentWord(token)
    }

    if (highlightMode === 'grammar') {
      return kuromojiService.isGrammarWord(token)
    }

    return false
  }

  const shouldAddWordSpacing = (
    token: TokenWithHighlight,
    nextToken?: TokenWithHighlight
  ): boolean => {
    const partOfSpeech = token.pos

    // Don't add spacing after punctuation
    if (partOfSpeech === '記号' || partOfSpeech === '補助記号') {
      return false
    }

    // Don't add spacing after particles
    if (partOfSpeech === '助詞') {
      return false
    }

    // Don't add spacing after auxiliary verbs
    if (partOfSpeech === '助動詞') {
      return false
    }

    // Don't add spacing before particles if next token is a particle
    if (nextToken && nextToken.pos === '助詞') {
      return false
    }

    // Don't add spacing before punctuation
    if (nextToken && (nextToken.pos === '記号' || nextToken.pos === '補助記号')) {
      return false
    }

    return true
  }

  const handleWordClick = (token: TokenWithHighlight, event: React.MouseEvent) => {
    if (onWordClick && token.basic_form) {
      onWordClick(token.basic_form, event)
    }
  }

  const openFuriganaEditor = (
    token: TokenWithHighlight,
    index: number,
    event: React.MouseEvent
  ) => {
    if (!enableFuriganaEditing || !showFurigana) return
    event.preventDefault()
    event.stopPropagation()

    const hasKanji = /[\u4E00-\u9FAF]/.test(token.surface_form)
    if (!hasKanji) return

    const currentReading =
      overrideMap[index] || (token.reading ? convertKatakanaToHiragana(token.reading) : '')

    setEditingIndex(index)
    setEditingSurface(token.surface_form)
    setEditingValue(currentReading)
    setIsEditingOpen(true)
  }

  const closeFuriganaEditor = () => {
    setIsEditingOpen(false)
    setEditingIndex(null)
    setEditingSurface('')
    setEditingValue('')
  }

  const saveFuriganaOverride = () => {
    if (editingIndex === null) return
    const normalized = convertKatakanaToHiragana(editingValue.trim())

    setOverrideMap((prev) => {
      const next = { ...prev }
      if (!normalized) {
        delete next[editingIndex]
      } else {
        next[editingIndex] = normalized
      }
      void setSentenceOverride(contextKey, text, next)
      return next
    })

    closeFuriganaEditor()
  }

  const clearFuriganaOverride = () => {
    if (editingIndex === null) return
    setOverrideMap((prev) => {
      const next = { ...prev }
      delete next[editingIndex]
      void setSentenceOverride(contextKey, text, next)
      return next
    })
    closeFuriganaEditor()
  }

  if (loading || !isKuromojiReady) {
    return (
      <span className={`${className} japanese-text font-ja`} data-quickcontext="true">
        {text}
      </span>
    )
  }

  if (error || tokens.length === 0) {
    return (
      <span className={`${className} japanese-text font-ja`} data-quickcontext="true">
        {text}
      </span>
    )
  }

  // Check if text contains kanji (furigana only shows above kanji)
  const hasKanjiInText = /[\u4E00-\u9FAF]/.test(text)
  // Only increase line height if furigana is enabled AND text has kanji
  const needsExtraLineHeight = showFurigana && hasKanjiInText

  return (
    <span
      className={`${className} block md:inline japanese-text font-ja`}
      data-quickcontext="true"
      style={{ lineHeight: needsExtraLineHeight ? '2.5' : '1.8', marginTop: '0.5rem' }}
    >
      {tokens.map((token, index) => {
        const nextToken = tokens[index + 1]
        const isHighlighted = shouldHighlight(token)
        const posType = KuromojiService.getInstance().getPartOfSpeech(token)
        const addSpacing = shouldAddWordSpacing(token, nextToken)

        // Handle Japanese full stop - add line breaks after it
        if (token.surface_form === '。') {
          return (
            <React.Fragment key={index}>
              <span className="inline-block mx-1">。</span>
              <br />
              <br />
            </React.Fragment>
          )
        }

        // Skip other symbols (e.g., '・', punctuation)
        if (posType === 'symbol') {
          return null
        }

        // Check if the token contains kanji
        const hasKanji = /[\u4E00-\u9FAF]/.test(token.surface_form)

        // Convert katakana reading to hiragana
        const baseReading = token.reading ? convertKatakanaToHiragana(token.reading) : ''
        const hiraganaReading = overrideMap[index] || baseReading

        if (showFurigana && hiraganaReading && token.surface_form !== hiraganaReading && hasKanji) {
          // Render with furigana only for words containing kanji
          return (
            <span
              key={index}
              className={`cursor-pointer hover:bg-primary/20 transition-colors rounded px-2 py-0.5 mx-2 my-2 inline-block relative min-w-[2.5em] text-center ${
                isHighlighted ? `grammar-${posType}` : ''
              }`}
              style={{
                ...(isHighlighted ? { backgroundColor: `${token.color}60`, color: '#e0e0e0' } : {}),
                paddingTop: showFurigana ? '1.1em' : undefined, // Tighter furigana spacing
                whiteSpace: 'nowrap',
                wordBreak: 'keep-all',
                overflowWrap: 'normal',
                marginRight: addSpacing ? '0.25em' : undefined, // Word spacing
              }}
              onClick={e => handleWordClick(token, e)}
              data-pos={posType}
            >
              <span
                className={`absolute text-xs w-full text-center ${furiganaClassName}`}
                style={{
                  top: '0.1em', // Tighter positioning
                  left: '0',
                  fontSize: '0.7em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  fontWeight: 'normal',
                  ...(!furiganaClassName && { color: 'var(--article-text-secondary)', opacity: 0.85 }),
                }}
                onClick={e => openFuriganaEditor(token, index, e)}
              >
                {hiraganaReading}
              </span>
              <span style={{ fontWeight: 'bold' }}>{token.surface_form}</span>
            </span>
          )
        } else {
          // Render without furigana
          return (
            <span
              key={index}
              className={`cursor-pointer hover:bg-primary/20 transition-colors rounded px-2 py-0.5 mx-2 my-1 inline-block min-w-[2.5em] text-center ${isHighlighted ? `grammar-${posType}` : ''}`}
              style={{
                ...(isHighlighted ? { backgroundColor: `${token.color}50`, color: '#e0e0e0' } : {}),
                whiteSpace: 'nowrap',
                wordBreak: 'keep-all',
                overflowWrap: 'normal',
                fontWeight: 'bold',
                marginRight: addSpacing ? '0.25em' : undefined, // Word spacing
              }}
              onClick={e => handleWordClick(token, e)}
              data-pos={posType}
              title={hiraganaReading || token.surface_form}
            >
              {token.surface_form}
            </span>
          )
        }
      })}
      <Modal
        isOpen={isEditingOpen}
        onClose={closeFuriganaEditor}
        title="Edit Furigana"
        size={isMobile ? 'full' : 'sm'}
        mobileBottomSheet
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Kanji
          </div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
            {editingSurface}
          </div>
          <label className="block text-sm text-gray-500 dark:text-gray-400">
            Reading (hiragana)
          </label>
          <input
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-base text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="e.g. かぜ"
            inputMode="text"
          />
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={clearFuriganaOverride}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear Override
            </button>
            <div className="flex gap-2">
              <button
                onClick={closeFuriganaEditor}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveFuriganaOverride}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </span>
  )
}

// Legend component to show color coding
export function GrammarLegend() {
  const categories = [
    { type: 'noun', label: 'Nouns', color: POS_COLORS.noun },
    { type: 'verb', label: 'Verbs', color: POS_COLORS.verb },
    { type: 'adjective', label: 'Adjectives', color: POS_COLORS.adjective },
    { type: 'particle', label: 'Particles', color: POS_COLORS.particle },
    { type: 'adverb', label: 'Adverbs', color: POS_COLORS.adverb },
  ]

  return (
    <div className="flex flex-wrap gap-3 md:gap-3 text-xs md:text-sm">
      {categories.map(cat => (
        <div
          key={cat.type}
          className="flex items-center gap-1 px-2 py-1 md:px-0 md:py-0 bg-white dark:bg-[#a0aace] rounded-md"
        >
          <div
            className="w-3 h-3 md:w-4 md:h-4 rounded"
            style={{ backgroundColor: `${cat.color}50` }}
          />
          <span className="text-muted-foreground">{cat.label}</span>
        </div>
      ))}
    </div>
  )
}
