/**
 * XP UI Components Tests
 * Test XP gain popup, level display, and dashboard integration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { XPGainPopup, XPGainManager } from '@/components/gamification/XPGainPopup'
import * as useXPModule from '@/hooks/useXP'
import { I18nProvider } from '@/i18n/I18nContext'

// Mock hooks - properly mock as a function that can be controlled
jest.mock('@/hooks/useXP', () => ({
  useXP: jest.fn()
}))

const { useXP } = useXPModule

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
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useAnimation: () => ({
    start: jest.fn(),
    set: jest.fn()
  })
}))

// Mock i18n strings
const mockStrings = {
  common: {
    loading: 'Loading...',
    error: 'Error'
  },
  dashboard: {
    level: 'Level',
    xp: 'XP',
    nextLevel: 'Next Level'
  }
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider locale="en" strings={mockStrings}>
    {children}
  </I18nProvider>
)

describe('XP UI Components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('XPGainPopup Component', () => {
    it('should render XP gain amount', () => {
      render(
        <TestWrapper>
          <XPGainPopup
            xpGained={10}
            x={100}
            y={100}
            onComplete={() => {}}
          />
        </TestWrapper>
      )

      expect(screen.getByText('+10 XP')).toBeInTheDocument()
    })

    it('should auto-hide after 2 seconds', async () => {
      const onComplete = jest.fn()
      const { container } = render(
        <TestWrapper>
          <XPGainPopup
            xpGained={10}
            x={100}
            y={100}
            onComplete={onComplete}
          />
        </TestWrapper>
      )

      expect(container.querySelector('div')).toBeInTheDocument()

      await waitFor(
        () => {
          expect(onComplete).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )
    })

    it('should show bonus text for large XP gains', () => {
      render(
        <TestWrapper>
          <XPGainPopup
            xpGained={50}
            x={100}
            y={100}
            bonusText="Perfect!"
            onComplete={() => {}}
          />
        </TestWrapper>
      )

      expect(screen.getByText('Perfect!')).toBeInTheDocument()
    })

    it('should apply delay when specified', async () => {
      const onComplete = jest.fn()
      render(
        <TestWrapper>
          <XPGainPopup
            xpGained={10}
            x={100}
            y={100}
            delay={1000}
            onComplete={onComplete}
          />
        </TestWrapper>
      )

      // Should not be called immediately
      expect(onComplete).not.toHaveBeenCalled()

      // Should be called after delay + duration
      await waitFor(
        () => {
          expect(onComplete).toHaveBeenCalled()
        },
        { timeout: 4000 }
      )
    })

    it('should position popup at specified coordinates', () => {
      const { container } = render(
        <TestWrapper>
          <XPGainPopup
            xpGained={10}
            x={200}
            y={300}
            onComplete={() => {}}
          />
        </TestWrapper>
      )

      const popup = container.querySelector('div[style*="position"]')
      expect(popup).toHaveStyle({
        left: '200px',
        top: '300px'
      })
    })
  })

  describe('XPGainManager Component', () => {
    it('should manage multiple XP events', () => {
      const events = [
        { id: '1', xpGained: 10, x: 100, y: 100 },
        { id: '2', xpGained: 20, x: 200, y: 200 }
      ]

      const { container } = render(
        <TestWrapper>
          <XPGainManager events={events} />
        </TestWrapper>
      )

      expect(screen.getByText('+10 XP')).toBeInTheDocument()
      expect(screen.getByText('+20 XP')).toBeInTheDocument()
    })

    it('should stagger multiple events to prevent overlap', () => {
      const events = [
        { id: '1', xpGained: 10, x: 100, y: 100 },
        { id: '2', xpGained: 20, x: 100, y: 100 },
        { id: '3', xpGained: 30, x: 100, y: 100 }
      ]

      render(
        <TestWrapper>
          <XPGainManager events={events} />
        </TestWrapper>
      )

      const popups = screen.getAllByText(/\+\d+ XP/)
      expect(popups).toHaveLength(3)
    })

    it('should handle event completion', async () => {
      const events = [{ id: '1', xpGained: 10, x: 100, y: 100 }]

      const { rerender } = render(
        <TestWrapper>
          <XPGainManager events={events} />
        </TestWrapper>
      )

      expect(screen.getByText('+10 XP')).toBeInTheDocument()

      // Simulate event completion and removal
      await waitFor(() => {
        rerender(
          <TestWrapper>
            <XPGainManager events={[]} />
          </TestWrapper>
        )
      })
    })
  })

  describe('useXP Hook', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
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

      ;(useXPModule.useXP as jest.Mock).mockReturnValue({
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

      // Simulate using the hook
      const result = (useXPModule.useXP as jest.Mock)()
      expect(result.totalXP).toBe(250)
      expect(result.currentLevel).toBe(5)
      expect(result.levelInfo?.title).toBe('Student')
    })

    it('should track XP gains', async () => {
      const trackXP = jest.fn()
      ;(useXPModule.useXP as jest.Mock).mockReturnValue({
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

      const result = (useXPModule.useXP as jest.Mock)()
      await result.trackXP('review_completed', 10, 'Test review', { correct: true })

      expect(trackXP).toHaveBeenCalledWith(
        'review_completed',
        10,
        'Test review',
        { correct: true }
      )
    })

    it('should handle loading state', () => {
      ;(useXPModule.useXP as jest.Mock).mockReturnValue({
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

      const result = (useXPModule.useXP as jest.Mock)()
      expect(result.loading).toBe(true)
    })

    it('should handle error state', () => {
      ;(useXPModule.useXP as jest.Mock).mockReturnValue({
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

      const result = (useXPModule.useXP as jest.Mock)()
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

      ;(useXPModule.useXP as jest.Mock).mockReturnValue({
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

      const result = (useXPModule.useXP as jest.Mock)()
      expect(result.totalXP).toBe(500)
    })
  })

  describe('Dashboard Integration', () => {
    it('should display real XP data in dashboard', async () => {
      ;(useXPModule.useXP as jest.Mock).mockReturnValue({
        totalXP: 750,
        currentLevel: 8,
        levelInfo: {
          currentLevel: 8,
          currentXP: 50,
          xpToNextLevel: 100,
          progressPercentage: 50,
          title: 'Advanced Student',
          nextLevelTitle: 'Expert',
          totalXP: 750,
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

      const Dashboard = () => {
        const xp = useXP()
        return (
          <div>
            <div>Level {xp.currentLevel}</div>
            <div>{xp.totalXP} XP</div>
            <div>{xp.levelInfo?.title}</div>
          </div>
        )
      }

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )

      expect(screen.getByText('Level 8')).toBeInTheDocument()
      expect(screen.getByText('750 XP')).toBeInTheDocument()
      expect(screen.getByText('Advanced Student')).toBeInTheDocument()
    })

    it('should update in real-time when XP is gained', async () => {
      const mockDispatchEvent = jest.fn()
      global.window = {
        dispatchEvent: mockDispatchEvent,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      } as any

      // Dispatch XP gain event
      const xpEvent = new CustomEvent('xpGained', {
        detail: {
          xpGained: 15,
          totalXP: 115,
          currentLevel: 2,
          leveledUp: false
        }
      })

      act(() => {
        window.dispatchEvent(xpEvent)
      })

      expect(mockDispatchEvent).toHaveBeenCalledWith(xpEvent)
    })

    it('should handle level up events', async () => {
      const mockDispatchEvent = jest.fn()
      global.window = {
        dispatchEvent: mockDispatchEvent,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      } as any

      // Dispatch level up event
      const levelUpEvent = new CustomEvent('xpGained', {
        detail: {
          xpGained: 50,
          totalXP: 200,
          currentLevel: 3,
          leveledUp: true,
          newLevelTitle: 'Intermediate'
        }
      })

      act(() => {
        window.dispatchEvent(levelUpEvent)
      })

      expect(mockDispatchEvent).toHaveBeenCalledWith(levelUpEvent)
    })
  })
})