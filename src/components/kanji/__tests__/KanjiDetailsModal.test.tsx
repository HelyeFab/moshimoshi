/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal'
import { useFeature } from '@/hooks/useFeature'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'

jest.mock('@/hooks/useFeature', () => ({
  useFeature: jest.fn(),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: jest.fn(),
}))

jest.mock('@/hooks/useTTS', () => ({
  useTTS: () => ({
    play: jest.fn(),
    preload: jest.fn(),
    loading: false,
    playing: false,
    currentText: null,
  }),
}))

jest.mock('@/services/kanjiService', () => ({
  kanjiService: {
    getKanjiDetails: jest.fn().mockResolvedValue(null),
    getKanjiMnemonic: jest.fn().mockResolvedValue(null),
    generateKanjiMnemonic: jest.fn().mockResolvedValue(null),
    getStrokeOrderSVG: jest.fn().mockResolvedValue(null),
    getStrokeCount: jest.fn().mockReturnValue(0),
  },
  getUserMnemonic: jest.fn().mockResolvedValue(null),
  saveUserMnemonic: jest.fn(),
  deleteUserMnemonic: jest.fn(),
  checkRegenerationLimit: jest.fn().mockResolvedValue(null),
  regenerateKanjiMnemonic: jest.fn(),
}))

jest.mock('@/utils/tatoeba-client', () => ({
  fetchTatoebaSentences: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/utils/jmdictLocalSearch', () => ({
  searchJMdictWords: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/utils/kuromojiService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      addFurigana: jest.fn().mockResolvedValue(''),
    }),
  },
}))

jest.mock('@/components/ui/Modal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/Loading', () => ({
  LoadingSpinner: () => <div>Loading...</div>,
}))

jest.mock('@/components/ui/AudioButton', () => ({
  __esModule: true,
  default: () => <div>Audio</div>,
}))

jest.mock('@/components/ui/ActionMenu', () => ({
  __esModule: true,
  default: () => <div>ActionMenu</div>,
}))

jest.mock('@/components/lists/AddToListButton', () => ({
  __esModule: true,
  default: () => <div>AddToList</div>,
}))

jest.mock('@/components/drawing-practice/DrawingPracticeModal', () => ({
  __esModule: true,
  default: () => <div>DrawingPractice</div>,
}))

jest.mock('@/components/kanji/StrokeOrderModal', () => ({
  __esModule: true,
  default: () => <div>StrokeOrder</div>,
}))

jest.mock('@/components/kanji/MnemonicDisplay', () => ({
  __esModule: true,
  default: () => <div>MnemonicDisplay</div>,
}))

jest.mock('@/components/kanji/MnemonicEditor', () => ({
  __esModule: true,
  default: () => <div>MnemonicEditor</div>,
}))

jest.mock('@/i18n/I18nContext', () => ({
  useI18n: () => ({ strings: {} }),
}))

const mockUseFeature = useFeature as jest.MockedFunction<typeof useFeature>
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseSubscription = useSubscription as jest.MockedFunction<typeof useSubscription>

const baseKanji = {
  kanji: '日',
  meaning: 'sun',
  onyomi: [],
  kunyomi: [],
} as any

describe('KanjiDetailsModal entitlement gating', () => {
  beforeAll(() => {
    ;(global as any).React = React
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } } as any)
    mockUseSubscription.mockReturnValue({ subscription: { status: 'active' } } as any)
  })

  it('checks kanji_lookup entitlement on open', async () => {
    const mockCheck = jest.fn().mockResolvedValue(true)
    mockUseFeature.mockImplementation((featureId: any) => {
      if (featureId === 'kanji_lookup') {
        return { checkAndTrack: mockCheck } as any
      }
      return { checkAndTrack: jest.fn() } as any
    })

    render(<KanjiDetailsModal kanji={baseKanji} isOpen={true} onClose={jest.fn()} />)

    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalled()
    })
  })

  it('closes modal when entitlement denies access', async () => {
    const mockCheck = jest.fn().mockResolvedValue(false)
    const onClose = jest.fn()

    mockUseFeature.mockImplementation((featureId: any) => {
      if (featureId === 'kanji_lookup') {
        return { checkAndTrack: mockCheck } as any
      }
      return { checkAndTrack: jest.fn() } as any
    })

    render(<KanjiDetailsModal kanji={baseKanji} isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('does not re-consume quota for the same kanji in a session', async () => {
    const mockCheck = jest.fn().mockResolvedValue(true)
    const onClose = jest.fn()

    mockUseFeature.mockImplementation((featureId: any) => {
      if (featureId === 'kanji_lookup') {
        return { checkAndTrack: mockCheck } as any
      }
      return { checkAndTrack: jest.fn() } as any
    })

    const { rerender } = render(
      <KanjiDetailsModal kanji={baseKanji} isOpen={true} onClose={onClose} />
    )

    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalledTimes(1)
    })

    rerender(<KanjiDetailsModal kanji={baseKanji} isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalledTimes(1)
    })
  })
})
