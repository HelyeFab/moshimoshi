/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import WordExplanationModal from '@/components/word/WordExplanationModal'
import { useFeature } from '@/hooks/useFeature'

jest.mock('@/hooks/useFeature', () => ({
  useFeature: jest.fn(),
}))

jest.mock('@/hooks/useTTS', () => ({
  useTTS: () => ({
    play: jest.fn(),
    preload: jest.fn(),
    playing: false,
    currentText: null,
  }),
}))

jest.mock('@/hooks/useContentTranslation', () => ({
  useContentTranslation: () => ({
    translateText: jest.fn(),
    isLoading: false,
    error: null,
    addToVocabulary: jest.fn(),
  }),
}))

jest.mock('@/utils/tatoebaSearch', () => ({
  searchTatoebaExamples: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/services/kanjiService', () => ({
  kanjiService: {
    getKanjiDetails: jest.fn().mockResolvedValue(null),
  },
}))

jest.mock('@/components/ui/Modal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/lists/AddToListButton', () => ({
  __esModule: true,
  default: () => <div>AddToList</div>,
}))

jest.mock('@/components/conjugation/CompactConjugationTable', () => ({
  __esModule: true,
  default: () => <div>ConjugationTable</div>,
}))

jest.mock('@/components/kanji/KanjiDetailsModal', () => ({
  __esModule: true,
  default: () => <div>KanjiDetailsModal</div>,
}))

const mockUseFeature = useFeature as jest.MockedFunction<typeof useFeature>

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  word: '猫',
  explanation: {
    word: '猫',
    meaning: 'cat',
    reading: 'ねこ',
    partOfSpeech: 'noun',
    examples: [],
  } as any,
  loading: false,
  error: null,
}

describe('WordExplanationModal entitlement gating', () => {
  beforeAll(() => {
    ;(global as any).React = React
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('checks word_lookup entitlement on open', async () => {
    const mockCheck = jest.fn().mockResolvedValue(true)
    mockUseFeature.mockReturnValue({ checkAndTrack: mockCheck } as any)

    render(<WordExplanationModal {...baseProps} />)

    await waitFor(() => {
      expect(mockCheck).toHaveBeenCalled()
    })
  })

  it('closes modal when entitlement denies access', async () => {
    const mockCheck = jest.fn().mockResolvedValue(false)
    const onClose = jest.fn()
    mockUseFeature.mockReturnValue({ checkAndTrack: mockCheck } as any)

    render(<WordExplanationModal {...baseProps} onClose={onClose} />)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})
