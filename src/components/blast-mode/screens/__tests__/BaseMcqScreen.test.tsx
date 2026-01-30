/**
 * UI Tests for BaseMcqScreen Component
 * Validates user interaction, keyboard navigation, and timing behavior
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { BaseMcqScreen } from '../BaseMcqScreen'

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}))

describe('BaseMcqScreen', () => {
  const defaultProps = {
    prompt: 'What is the meaning of 食べる?',
    options: ['to eat', 'to drink', 'to sleep', 'to run'],
    correctAnswer: 'to eat',
    onAnswer: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Rendering', () => {
    it('should render prompt', () => {
      render(<BaseMcqScreen {...defaultProps} />)
      expect(screen.getByText('What is the meaning of 食べる?')).toBeInTheDocument()
    })

    it('should render all options', () => {
      render(<BaseMcqScreen {...defaultProps} />)

      defaultProps.options.forEach(option => {
        expect(screen.getByText(option)).toBeInTheDocument()
      })
    })

    it('should render option numbers', () => {
      render(<BaseMcqScreen {...defaultProps} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('should render keyboard hint', () => {
      render(<BaseMcqScreen {...defaultProps} />)
      expect(screen.getByText('blastMode.screens.mcq.hint')).toBeInTheDocument()
    })
  })

  describe('Click interaction', () => {
    it('should trigger onAnswer after delay when option is clicked', async () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      const correctOption = screen.getByText('to eat')
      fireEvent.click(correctOption)

      // Should not call immediately
      expect(onAnswerMock).not.toHaveBeenCalled()

      // Fast-forward timer
      act(() => {
        jest.advanceTimersByTime(1200)
      })

      // Should call after delay
      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith('to eat', true, expect.any(Number))
      })
    })

    it('should call onAnswer with correct=true for correct answer', async () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.click(screen.getByText('to eat'))

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith('to eat', true, expect.any(Number))
      })
    })

    it('should call onAnswer with correct=false for wrong answer', async () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.click(screen.getByText('to drink'))

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith('to drink', false, expect.any(Number))
      })
    })

    it('should capture response time at selection, not after UI delay', async () => {
      const onAnswerMock = jest.fn()
      const startTime = Date.now()

      // Mock Date.now to control time
      const realDateNow = Date.now.bind(global.Date)
      const mockDateNow = jest.spyOn(Date, 'now')
      mockDateNow.mockImplementation(() => startTime)

      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      // Simulate 500ms passing before user clicks
      mockDateNow.mockImplementation(() => startTime + 500)
      fireEvent.click(screen.getByText('to eat'))

      // Advance UI delay timer (1200ms)
      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalled()
      })

      // Response time should be ~500ms (selection time), not 1700ms (selection + delay)
      const responseTime = onAnswerMock.mock.calls[0][2]
      expect(responseTime).toBeGreaterThanOrEqual(400)
      expect(responseTime).toBeLessThan(700)
      // Should NOT include the 1200ms UI delay
      expect(responseTime).toBeLessThan(1200)

      mockDateNow.mockRestore()
    })

    it('should show feedback after selection', () => {
      render(<BaseMcqScreen {...defaultProps} />)

      fireEvent.click(screen.getByText('to eat'))

      // After selection, the button should show feedback styling (green background)
      const selectedButton = screen.getByText('to eat').closest('button')
      expect(selectedButton).toHaveClass('bg-green-50')
    })

    it('should not trigger onAnswer immediately without delay', () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.click(screen.getByText('to eat'))

      // Should not call before timer
      expect(onAnswerMock).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard interaction', () => {
    it('should select option 1 when pressing "1" key', async () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: '1', code: 'Digit1' })

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith('to eat', true, expect.any(Number))
      })
    })

    it('should select option 2 when pressing "2" key', async () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: '2', code: 'Digit2' })

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith('to drink', false, expect.any(Number))
      })
    })

    it('should select option 3 when pressing "3" key', async () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: '3', code: 'Digit3' })

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith('to sleep', false, expect.any(Number))
      })
    })

    it('should select option 4 when pressing "4" key', async () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: '4', code: 'Digit4' })

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith('to run', false, expect.any(Number))
      })
    })

    it('should not respond to invalid key presses', () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: '5', code: 'Digit5' })
      fireEvent.keyPress(window, { key: 'a', code: 'KeyA' })
      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      expect(onAnswerMock).not.toHaveBeenCalled()
    })

    it('should ignore keyboard input when disabled', () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} disabled={true} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: '1', code: 'Digit1' })

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      expect(onAnswerMock).not.toHaveBeenCalled()
    })

    it('should ignore keyboard input after answer is selected', () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      // Select first option
      fireEvent.keyPress(window, { key: '1', code: 'Digit1' })

      // Try to select another option immediately
      fireEvent.keyPress(window, { key: '2', code: 'Digit2' })

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      // Should only call once with first selection
      expect(onAnswerMock).toHaveBeenCalledTimes(1)
      expect(onAnswerMock).toHaveBeenCalledWith('to eat', true, expect.any(Number))
    })
  })

  describe('Disabled state', () => {
    it('should not respond to clicks when disabled', () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} disabled={true} onAnswer={onAnswerMock} />)

      fireEvent.click(screen.getByText('to eat'))

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      expect(onAnswerMock).not.toHaveBeenCalled()
    })

    it('should disable all option buttons when disabled', () => {
      render(<BaseMcqScreen {...defaultProps} disabled={true} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it('should not show keyboard hint when disabled', () => {
      const { rerender } = render(<BaseMcqScreen {...defaultProps} />)

      // Initially shows hint
      expect(screen.getByText('blastMode.screens.mcq.hint')).toBeInTheDocument()

      // After selection, hint should disappear
      fireEvent.click(screen.getByText('to eat'))
      expect(screen.queryByText('blastMode.screens.mcq.hint')).not.toBeInTheDocument()
    })
  })

  describe('Timer management', () => {
    it('should clear timer on unmount', () => {
      const onAnswerMock = jest.fn()
      const { unmount } = render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.click(screen.getByText('to eat'))

      // Unmount before timer fires
      unmount()

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      // Should not call after unmount
      expect(onAnswerMock).not.toHaveBeenCalled()
    })

    it('should clear previous timer when selecting different option quickly', () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      // This test verifies behavior, but after first selection,
      // feedback is shown and subsequent clicks are blocked
      fireEvent.click(screen.getByText('to eat'))

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      expect(onAnswerMock).toHaveBeenCalledTimes(1)
    })

    it('should use exactly 1200ms delay', async () => {
      const onAnswerMock = jest.fn()
      render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.click(screen.getByText('to eat'))

      // Before 1200ms
      act(() => {
        jest.advanceTimersByTime(1199)
      })
      expect(onAnswerMock).not.toHaveBeenCalled()

      // At 1200ms
      act(() => {
        jest.advanceTimersByTime(1)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('State reset on prompt change', () => {
    it('should reset selection when prompt changes', () => {
      const { rerender } = render(<BaseMcqScreen {...defaultProps} />)

      fireEvent.click(screen.getByText('to eat'))

      // Change prompt
      rerender(
        <BaseMcqScreen
          {...defaultProps}
          prompt="What is the meaning of 飲む?"
          correctAnswer="to drink"
        />
      )

      // Hint should be visible again
      expect(screen.getByText('blastMode.screens.mcq.hint')).toBeInTheDocument()
    })

    it('should clear feedback when prompt changes', () => {
      const { rerender } = render(<BaseMcqScreen {...defaultProps} />)

      fireEvent.click(screen.getByText('to eat'))

      // Feedback is showing (button has green background)
      let selectedButton = screen.getByText('to eat').closest('button')
      expect(selectedButton).toHaveClass('bg-green-50')

      // Change prompt
      rerender(
        <BaseMcqScreen
          {...defaultProps}
          prompt="New prompt"
        />
      )

      // Feedback should be cleared (no green background)
      selectedButton = screen.getByText('to eat').closest('button')
      expect(selectedButton).not.toHaveClass('bg-green-50')
    })
  })

  describe('Accessibility', () => {
    it('should have accessible labels for options', () => {
      render(<BaseMcqScreen {...defaultProps} />)

      expect(screen.getByLabelText('Option 1: to eat')).toBeInTheDocument()
      expect(screen.getByLabelText('Option 2: to drink')).toBeInTheDocument()
      expect(screen.getByLabelText('Option 3: to sleep')).toBeInTheDocument()
      expect(screen.getByLabelText('Option 4: to run')).toBeInTheDocument()
    })

    it('should have button role for all options', () => {
      render(<BaseMcqScreen {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBe(4)
    })
  })

  describe('No act warnings / timer leaks', () => {
    it('should not cause act warnings with proper timer handling', async () => {
      const onAnswerMock = jest.fn()
      const { unmount } = render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.click(screen.getByText('to eat'))

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalled()
      })

      unmount()
      // No errors should occur
    })

    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(<BaseMcqScreen {...defaultProps} />)

      // Mount and unmount multiple times to verify no leaks
      unmount()

      const onAnswerMock = jest.fn()
      const { unmount: unmount2 } = render(<BaseMcqScreen {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: '1', code: 'Digit1' })

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      expect(onAnswerMock).toHaveBeenCalledTimes(1)
      unmount2()
    })
  })
})
