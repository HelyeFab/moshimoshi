'use client'

import type { FlashcardContent } from '@/types/flashcards'
import { OfflineTTSCache } from '@/lib/tts/offlineCache'
import { normalizeTextForTTS } from '@/lib/flashcards/ttsText'

const WARMUP_VERSION = 'v2'
const WARMUP_PROVIDER = 'voicevox'
const WARMUP_VOICE = '23'
const WARMUP_SPEED = 0.85
const INITIAL_CARDS_TO_WARM = 5
const BACKGROUND_BATCH_SIZE = 2
const BACKGROUND_DELAY_MS = 250

const inFlightWarmups = new Set<string>()

const isJapaneseOnly = (text: string): boolean =>
  /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text) && !/[a-zA-Z]/.test(text)

const normalizeCardTextForTTS = (text?: string | null): string => {
  if (!text) return ''
  return normalizeTextForTTS(text)
}

const resolveCardSideText = (card: FlashcardContent, side: 'front' | 'back'): string => {
  const sideValue = side === 'front' ? card.front : card.back
  const sideText = typeof sideValue === 'string' ? sideValue : sideValue?.text

  if (side === 'front') {
    return (
      card.metadata?.furiganaFront ||
      sideText ||
      card.metadata?.expression ||
      card.metadata?.sentence ||
      ''
    )
  }

  return (
    card.metadata?.furiganaBack ||
    sideText ||
    card.metadata?.meaning ||
    ''
  )
}

const getDeckWarmupKey = (deckId: string, updatedAt: number | undefined, cardCount: number): string =>
  `flashcards_tts_warmup_${WARMUP_VERSION}:${deckId}:${updatedAt || 0}:${cardCount}:${WARMUP_VOICE}:${WARMUP_SPEED}`

const collectJapaneseTexts = (cards: FlashcardContent[]): { initial: string[]; background: string[] } => {
  const initialSeen = new Set<string>()
  const allSeen = new Set<string>()
  const initial: string[] = []
  const background: string[] = []

  cards.forEach((card, index) => {
    const sides: Array<'front' | 'back'> = ['front', 'back']
    for (const side of sides) {
      const raw = resolveCardSideText(card, side)
      const normalized = normalizeCardTextForTTS(raw)
      if (!normalized || !isJapaneseOnly(normalized)) continue
      if (allSeen.has(normalized)) continue
      allSeen.add(normalized)

      if (index < INITIAL_CARDS_TO_WARM) {
        initialSeen.add(normalized)
        initial.push(normalized)
      } else {
        background.push(normalized)
      }
    }
  })

  // If later cards produced text already captured in initial, filter it out (dedupe across batches)
  const filteredBackground = background.filter(text => !initialSeen.has(text))
  return { initial, background: filteredBackground }
}

async function synthesizeAndStoreLocally(text: string): Promise<void> {
  const cache = OfflineTTSCache.getInstance()
  const cacheHit = await cache.has(text, WARMUP_PROVIDER, WARMUP_VOICE, WARMUP_SPEED)
  if (cacheHit) return

  const inFlightKey = `${WARMUP_PROVIDER}|${WARMUP_VOICE}|${WARMUP_SPEED}|${text}`
  if (inFlightWarmups.has(inFlightKey)) return
  inFlightWarmups.add(inFlightKey)

  try {
    const response = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: 'ja',
        voice: WARMUP_VOICE,
        speed: WARMUP_SPEED,
        pitch: 0,
      }),
    })

    if (!response.ok) {
      throw new Error(`TTS synth failed (${response.status})`)
    }

    const payload = await response.json()
    const audioUrl = payload?.data?.audioUrl
    const duration = typeof payload?.data?.duration === 'number' ? payload.data.duration : 0
    if (typeof audioUrl !== 'string' || !audioUrl) {
      throw new Error('Missing audioUrl in synth response')
    }

    await cache.set(text, WARMUP_PROVIDER, WARMUP_VOICE, WARMUP_SPEED, audioUrl, duration)
  } catch (error) {
    console.debug('[FlashcardsAudioWarmup] Warmup failed for text:', text.slice(0, 40), error)
  } finally {
    inFlightWarmups.delete(inFlightKey)
  }
}

export function startLocalFlashcardsAudioWarmup(params: {
  deckId: string
  deckUpdatedAt?: number
  cards: FlashcardContent[]
  enabled?: boolean
  onProgress?: (progress: {
    phase: 'idle' | 'warming' | 'complete'
    completed: number
    total: number
  }) => void
}): () => void {
  const { deckId, deckUpdatedAt, cards, enabled = true, onProgress } = params
  let cancelled = false

  if (!enabled || typeof window === 'undefined' || cards.length === 0) {
    return () => { cancelled = true }
  }

  const deckWarmupKey = getDeckWarmupKey(deckId, deckUpdatedAt, cards.length)
  if (localStorage.getItem(deckWarmupKey) === 'complete') {
    onProgress?.({ phase: 'complete', completed: 0, total: 0 })
    return () => { cancelled = true }
  }

  const run = async () => {
    const { initial, background } = collectJapaneseTexts(cards)
    const allTexts = [...initial, ...background]
    if (allTexts.length === 0) {
      localStorage.setItem(deckWarmupKey, 'complete')
      onProgress?.({ phase: 'complete', completed: 0, total: 0 })
      return
    }
    let completed = 0
    onProgress?.({ phase: 'warming', completed, total: allTexts.length })

    for (const text of initial) {
      if (cancelled) return
      await synthesizeAndStoreLocally(text)
      completed += 1
      onProgress?.({ phase: 'warming', completed, total: allTexts.length })
    }

    for (let i = 0; i < background.length; i += BACKGROUND_BATCH_SIZE) {
      if (cancelled) return
      const batch = background.slice(i, i + BACKGROUND_BATCH_SIZE)
      await Promise.all(batch.map(text => synthesizeAndStoreLocally(text)))
      completed += batch.length
      onProgress?.({ phase: 'warming', completed, total: allTexts.length })
      if (i + BACKGROUND_BATCH_SIZE < background.length) {
        await new Promise(resolve => window.setTimeout(resolve, BACKGROUND_DELAY_MS))
      }
    }

    if (!cancelled) {
      localStorage.setItem(deckWarmupKey, 'complete')
      onProgress?.({ phase: 'complete', completed: allTexts.length, total: allTexts.length })
    }
  }

  void run()

  return () => {
    cancelled = true
  }
}
