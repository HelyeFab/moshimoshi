/**
 * @jest-environment jsdom
 */

import { startLocalFlashcardsAudioWarmup } from '@/lib/flashcards/audioWarmup'
import type { FlashcardContent } from '@/types/flashcards'
import { OfflineTTSCache } from '@/lib/tts/offlineCache'

jest.mock('@/lib/tts/offlineCache', () => ({
  OfflineTTSCache: {
    getInstance: jest.fn(),
  },
}))

const mockOfflineTTSCache = OfflineTTSCache as jest.Mocked<typeof OfflineTTSCache>

describe('flashcards audioWarmup', () => {
  let fetchMock: jest.Mock
  const has = jest.fn()
  const set = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    jest.clearAllMocks()
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          audioUrl: 'https://example.com/audio.mp3',
          duration: 1.2,
        },
      }),
    })
    ;(global.fetch as any) = fetchMock

    mockOfflineTTSCache.getInstance.mockReturnValue({
      has,
      set,
    } as any)

    has.mockResolvedValue(false)
    set.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('warms only Japanese text, reports progress, and marks deck complete', async () => {
    const cards: FlashcardContent[] = [
      { id: '1', front: '日本語', back: 'English' },  // warm front only
      { id: '2', front: '漢字', back: 'かな' },       // warm both sides
      { id: '3', front: 'Hello', back: 'World' },    // skip
    ]

    const progressEvents: Array<{ phase: string; completed: number; total: number }> = []
    let resolveDone!: () => void
    const donePromise = new Promise<void>(resolve => {
      resolveDone = resolve
    })

    startLocalFlashcardsAudioWarmup({
      deckId: 'deck-1',
      deckUpdatedAt: 123,
      cards,
      onProgress: event => {
        progressEvents.push(event)
        if (event.phase === 'complete') {
          resolveDone()
        }
      },
    })

    // flush delayed background batches and wait for completion callback
    jest.runAllTimers()
    await donePromise

    // Japanese-only unique texts: 日本語, 漢字, かな
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(has).toHaveBeenCalled()
    expect(set).toHaveBeenCalledTimes(3)

    expect(progressEvents.some(e => e.phase === 'warming' && e.total === 3)).toBe(true)
    expect(progressEvents.at(-1)).toEqual({ phase: 'complete', completed: 3, total: 3 })

    const key = 'flashcards_tts_warmup_v2:deck-1:123:3:23:0.85'
    expect(localStorage.getItem(key)).toBe('complete')
  })

  it('skips work when deck warmup marker is already complete', () => {
    const key = 'flashcards_tts_warmup_v2:deck-2:999:1:23:0.85'
    localStorage.setItem(key, 'complete')

    const cancel = startLocalFlashcardsAudioWarmup({
      deckId: 'deck-2',
      deckUpdatedAt: 999,
      cards: [{ id: '1', front: '日本語', back: '英語' }],
    })

    cancel()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
