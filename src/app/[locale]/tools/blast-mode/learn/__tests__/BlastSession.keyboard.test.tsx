/**
 * Keyboard navigation tests for BlastSession
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { BlastItem, BlastStep } from '@/lib/blast-mode/types'

;(global as any).React = React

const BlastSession = require('../BlastSession').default

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() })
}))

jest.mock('@/i18n/I18nContext', () => ({
  useLocalePath: () => ({ getLocalePath: (path: string) => path })
}))

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, vars?: any) => (vars ? `${key}` : key) })
}))

jest.mock('@/components/ui/Dialog', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('@/components/ui/Modal', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>
}))

jest.mock('@/lib/review-engine/core/event-hub', () => ({
  initializeEventHub: jest.fn(),
  getEventHub: () => ({ emit: jest.fn() })
}))

jest.mock('@/lib/review-engine/core/events', () => ({
  ReviewEventType: {
    SESSION_COMPLETED: 'SESSION_COMPLETED'
  }
}))

jest.mock('@/lib/blast-mode/blastSessionManager', () => ({
  blastSessionManager: {
    saveCompletedSession: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('@/lib/blast-mode/blastLessonManager', () => ({
  blastLessonManager: {
    saveLessonProgress: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('../BlastStepRenderer', () => ({
  __esModule: true,
  default: ({ onAnswer }: any) => (
    <button type="button" onClick={() => onAnswer('x', true, 100)}>
      answer
    </button>
  )
}))

describe('BlastSession keyboard navigation', () => {
  const items: BlastItem[] = [
    { id: 'item-1', contentType: 'vocabulary', kanji: '猫', kana: 'ねこ', meaningEn: 'cat' },
    { id: 'item-2', contentType: 'vocabulary', kanji: '犬', kana: 'いぬ', meaningEn: 'dog' }
  ]

  const steps: BlastStep[] = [
    { stepType: 'meaning_to_jp_mcq', itemId: 'item-1', prompt: 'cat', answer: '猫', options: ['猫'] },
    { stepType: 'meaning_to_jp_mcq', itemId: 'item-2', prompt: 'dog', answer: '犬', options: ['犬'] }
  ]

  const baseProps = {
    items,
    steps,
    userId: 'user-1',
    sessionId: 'session-1',
    contentType: 'vocabulary' as const,
    isPremium: false
  }

  it('advances to next step on Enter after answering', () => {
    render(<BlastSession {...baseProps} />)

    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('answer'))
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('advances to next step on Space after answering', () => {
    render(<BlastSession {...baseProps} />)

    fireEvent.click(screen.getByText('answer'))
    fireEvent.keyDown(window, { key: ' ' })

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('advances to next step on ArrowRight after answering', () => {
    render(<BlastSession {...baseProps} />)

    fireEvent.click(screen.getByText('answer'))
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })
})
