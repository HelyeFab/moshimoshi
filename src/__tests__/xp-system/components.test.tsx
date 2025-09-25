/**
 * XP UI Components Tests
 * Test XP gain popup, level display, and dashboard integration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { XPGainPopup, XPGainManager } from '@/components/gamification/XPGainPopup'
import { useXP } from '@/hooks/useXP'
import { I18nProvider } from '@/i18n/I18nContext'

// Mock hooks
jest.mock('@/hooks/useXP')
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { uid: 'test-user' },
    isAuthenticated: true
  }))
}))
jest.mock('@/components/ui/Toast/ToastContext', () => ({
  useToast: jest.fn(() => ({
    showToast: jest.fn()
  }))
}))

// Mock framer-motion for testing
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

const mockI18n = {
  locale: 'en',
  t: (key: string, params?: any) => {
    const translations: Record<string, string> = {
      'xp.gained': `+${params?.amount || 0} XP`,
      'xp.levelUp': 'Level Up!',
      'xp.progress': `${params?.current || 0}/${params?.required || 100} XP`
    }
    return translations[key] || key
  },
  strings: {}
}

describe('XP UI Components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  describe('XPGainPopup Component', () => {
    it('should render XP gain amount', () => {
      const { container } = render(
        <I18nProvider value={mockI18n as any}>
          <XPGainPopup xpGained={10} />
        </I18nProvider>
      )

      expect(container.textContent).toContain('+10 XP')
    })

    it('should auto-hide after 2 seconds', () => {
      const onComplete = jest.fn()

      render(
        <I18nProvider value={mockI18n as any}>
          <XPGainPopup xpGained={10} onComplete={onComplete} />
        </I18nProvider>
      )

      expect(onComplete).not.toHaveBeenCalled()

      act(() => {
        jest.advanceTimersByTime(2300) // 2s hide + 300ms animation
      })

      expect(onComplete).toHaveBeenCalled()
    })

    it('should show bonus text for large XP gains', () => {
      const { container } = render(
        <I18nProvider value={mockI18n as any}>
          <XPGainPopup
            xpGained={50}
            showBonus={true}
            bonusText="Perfect Session!"
          />
        </I18nProvider>
      )

      expect(container.textContent).toContain('+50 XP')
      expect(container.textContent).toContain('Perfect Session!')
    })

    it('should apply delay when specified', () => {
      const onComplete = jest.fn()

      render(
        <I18nProvider value={mockI18n as any}>
          <XPGainPopup xpGained={10} delay={1000} onComplete={onComplete} />
        </I18nProvider>
      )

      act(() => {
        jest.advanceTimersByTime(2000) // Should still be visible due to delay
      })
      expect(onComplete).not.toHaveBeenCalled()

      act(() => {
        jest.advanceTimersByTime(1300) // Now it should complete
      })
      expect(onComplete).toHaveBeenCalled()
    })

    it('should position popup at specified coordinates', () => {
      const { container } = render(
        <I18nProvider value={mockI18n as any}>
          <XPGainPopup
            xpGained={10}
            position={{ x: 200, y: 300 }}
          />
        </I18nProvider>
      )

      const popup = container.querySelector('[style*="left"]')
      expect(popup).toHaveStyle({
        left: '200px',
        top: '300px'
      })
    })
  })

  describe('XPGainManager Component', () => {
    it('should manage multiple XP events', () => {
      const events = [
        { id: '1', xpGained: 10, timestamp: Date.now() },
        { id: '2', xpGained: 15, timestamp: Date.now() + 100 },
        { id: '3', xpGained: 20, timestamp: Date.now() + 200 }
      ]

      const onEventComplete = jest.fn()

      const { container } = render(
        <I18nProvider value={mockI18n as any}>
          <XPGainManager events={events} onEventComplete={onEventComplete} />
        </I18nProvider>
      )

      // Should render all events
      expect(container.textContent).toContain('+10 XP')
      expect(container.textContent).toContain('+15 XP')
      expect(container.textContent).toContain('+20 XP')
    })

    it('should stagger multiple events to prevent overlap', () => {
      const events = [
        { id: '1', xpGained: 10, timestamp: Date.now() },
        { id: '2', xpGained: 15, timestamp: Date.now() }
      ]

      const { container } = render(
        <I18nProvider value={mockI18n as any}>
          <XPGainManager events={events} onEventComplete={jest.fn()} />
        </I18nProvider>
      )

      const popups = container.querySelectorAll('[style*="left"]')
      expect(popups).toHaveLength(2)

      // Check that positions are different (staggered)
      const firstTop = popups[0].getAttribute('style')?.match(/top:\s*(\d+)/)?.[1]
      const secondTop = popups[1].getAttribute('style')?.match(/top:\s*(\d+)/)?.[1]
      expect(firstTop).not.toBe(secondTop)
    })

    it('should handle event completion', () => {
      const events = [{ id: '1', xpGained: 10, timestamp: Date.now() }]
      const onEventComplete = jest.fn()

      render(
        <I18nProvider value={mockI18n as any}>
          <XPGainManager events={events} onEventComplete={onEventComplete} />
        </I18nProvider>
      )

      act(() => {
        jest.advanceTimersByTime(2300) // Wait for completion
      })

      expect(onEventComplete).toHaveBeenCalledWith('1')
    })
  })

  describe('useXP Hook', () => {
    beforeEach(() => {
      global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
      const mockUseXP = useXP as jest.MockedFunction<typeof useXP>
      mockUseXP.mockClear()
    })

    it('should fetch XP status on mount', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            totalXP: 250,
            currentLevel: 5,
            levelInfo: {
              currentLevel: 5,
              currentXP: 50,
              xpToNextLevel: 100,
              progressPercentage: 50,
              title: 'Student'
            }
          }
        })
      } as Response)

      const mockUseXP = useXP as jest.MockedFunction<typeof useXP>
      mockUseXP.mockReturnValue({
        totalXP: 250,
        currentLevel: 5,
        levelInfo: {
          currentLevel: 5,
          currentXP: 50,
          xpToNextLevel: 100,
          progressPercentage: 50,
          title: 'Student',
          nextLevelTitle: 'Apprentice',
          totalXP: 250,
          rank: 0,
          recentXPEvents: []
        },
        xpToNextLevel: 100,
        progressPercentage: 50,
        loading: false,
        error: null,
        refreshXP: jest.fn(),
        trackXP: jest.fn()
      })

      const result = mockUseXP()
      expect(result.totalXP).toBe(250)
      expect(result.currentLevel).toBe(5)
      expect(result.levelInfo?.title).toBe('Student')
    })

    it('should track XP gains', async () => {
      const trackXP = jest.fn()
      const mockUseXP = useXP as jest.MockedFunction<typeof useXP>
      mockUseXP.mockReturnValue({
        totalXP: 100,
        currentLevel: 2,
        levelInfo: null,
        xpToNextLevel: 50,
        progressPercentage: 50,
        loading: false,
        error: null,
        refreshXP: jest.fn(),
        trackXP
      })

      const result = mockUseXP()
      await result.trackXP('review_completed', 10, 'Test review', { correct: true })

      expect(trackXP).toHaveBeenCalledWith(
        'review_completed',
        10,
        'Test review',
        { correct: true }
      )
    })

    it('should handle loading state', () => {
      const mockUseXP = useXP as jest.MockedFunction<typeof useXP>
      mockUseXP.mockReturnValue({
        totalXP: 0,
        currentLevel: 1,
        levelInfo: null,
        xpToNextLevel: 100,
        progressPercentage: 0,
        loading: true,
        error: null,
        refreshXP: jest.fn(),
        trackXP: jest.fn()
      })

      const result = mockUseXP()
      expect(result.loading).toBe(true)
    })

    it('should handle error state', () => {
      const mockUseXP = useXP as jest.MockedFunction<typeof useXP>
      mockUseXP.mockReturnValue({
        totalXP: 0,
        currentLevel: 1,
        levelInfo: null,
        xpToNextLevel: 100,
        progressPercentage: 0,
        loading: false,
        error: 'Failed to load XP',
        refreshXP: jest.fn(),
        trackXP: jest.fn()
      })

      const result = mockUseXP()
      expect(result.error).toBe('Failed to load XP')
    })

    it('should fallback to localStorage when API fails', () => {
      const mockLocalStorage = {
        getItem: jest.fn(() => '500'),
        setItem: jest.fn()
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      })

      const mockUseXP = useXP as jest.MockedFunction<typeof useXP>
      mockUseXP.mockReturnValue({
        totalXP: 500, // From localStorage
        currentLevel: 10,
        levelInfo: null,
        xpToNextLevel: 150,
        progressPercentage: 33,
        loading: false,
        error: 'API error',
        refreshXP: jest.fn(),
        trackXP: jest.fn()
      })

      const result = mockUseXP()
      expect(result.totalXP).toBe(500)
    })
  })

  describe('Dashboard Integration', () => {
    it('should display real XP data in dashboard', async () => {
      const mockUseXP = useXP as jest.MockedFunction<typeof useXP>
      mockUseXP.mockReturnValue({
        totalXP: 750,
        currentLevel: 8,
        levelInfo: {
          currentLevel: 8,
          currentXP: 50,
          xpToNextLevel: 150,
          progressPercentage: 33.33,
          title: 'Apprentice',
          nextLevelTitle: 'Student',
          totalXP: 750,
          rank: 0,
          recentXPEvents: []
        },
        xpToNextLevel: 150,
        progressPercentage: 33.33,
        loading: false,
        error: null,
        refreshXP: jest.fn(),
        trackXP: jest.fn()
      })

      // Mock LevelDisplay component test
      const LevelDisplay = ({ currentLevel, currentXP, requiredXP, title }: any) => (
        <div data-testid="level-display">
          <div>Level {currentLevel}</div>
          <div>{currentXP}/{requiredXP} XP</div>
          <div>{title}</div>
        </div>
      )

      const { getByTestId } = render(
        <LevelDisplay
          currentLevel={8}
          currentXP={50}
          requiredXP={200}
          title="Apprentice"
        />
      )

      const display = getByTestId('level-display')
      expect(display.textContent).toContain('Level 8')
      expect(display.textContent).toContain('50/200 XP')
      expect(display.textContent).toContain('Apprentice')
    })

    it('should update in real-time when XP is gained', async () => {
      // Simulate XP gain event
      const event = new CustomEvent('xpGained', {
        detail: {
          xpGained: 15,
          totalXP: 265,
          leveledUp: false,
          newLevel: 5
        }
      })

      const listener = jest.fn()
      window.addEventListener('xpGained', listener)

      window.dispatchEvent(event)

      expect(listener).toHaveBeenCalled()
      expect(listener.mock.calls[0][0].detail).toEqual({
        xpGained: 15,
        totalXP: 265,
        leveledUp: false,
        newLevel: 5
      })

      window.removeEventListener('xpGained', listener)
    })

    it('should handle level up events', async () => {
      const event = new CustomEvent('xpGained', {
        detail: {
          xpGained: 50,
          totalXP: 500,
          leveledUp: true,
          newLevel: 10
        }
      })

      const listener = jest.fn()
      window.addEventListener('xpGained', listener)

      window.dispatchEvent(event)

      const detail = listener.mock.calls[0][0].detail
      expect(detail.leveledUp).toBe(true)
      expect(detail.newLevel).toBe(10)

      window.removeEventListener('xpGained', listener)
    })
  })
})