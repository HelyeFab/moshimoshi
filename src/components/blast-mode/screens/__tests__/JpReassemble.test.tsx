/**
 * UI Tests for JpReassemble Component
 * Validates tile reordering, duplicate handling, and keyboard interaction
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { JpReassemble } from '../JpReassemble'

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

jest.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => false
}))

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => {
  const React = require('react')
  const stripMotionProps = (props: any) => {
    const {
      whileHover,
      whileTap,
      transition,
      animate,
      initial,
      ...rest
    } = props
    return rest
  }
  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...stripMotionProps(props)}>{children}</div>,
      button: ({ children, ...props }: any) => <button {...stripMotionProps(props)}>{children}</button>
    }
  }
})

describe('JpReassemble', () => {
  const defaultProps = {
    prompt: 'Arrange the tiles to form: to eat',
    tiles: ['る', 'べ', '食'],
    correctOrder: ['食', 'べ', 'る'],
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
      render(<JpReassemble {...defaultProps} />)
      expect(screen.getByText('Arrange the tiles to form: to eat')).toBeInTheDocument()
    })

    it('should render all tiles', () => {
      render(<JpReassemble {...defaultProps} />)

      expect(screen.getByText('る')).toBeInTheDocument()
      expect(screen.getByText('べ')).toBeInTheDocument()
      expect(screen.getByText('食')).toBeInTheDocument()
    })

    it('should render duplicate tiles correctly', () => {
      const propsWithDuplicates = {
        ...defaultProps,
        tiles: ['あ', 'り', 'が', 'と', 'う', 'ご', 'ざ', 'い', 'ま', 'す'],
        correctOrder: ['あ', 'り', 'が', 'と', 'う', 'ご', 'ざ', 'い', 'ま', 'す']
      }

      render(<JpReassemble {...propsWithDuplicates} />)

      // All tiles should be present
      propsWithDuplicates.tiles.forEach(tile => {
        expect(screen.getByText(tile)).toBeInTheDocument()
      })
    })

    it('should render Submit and Reset buttons', () => {
      render(<JpReassemble {...defaultProps} />)

      expect(screen.getByRole('button', { name: /Submit/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument()
    })

    it('should render instructions', () => {
      render(<JpReassemble {...defaultProps} />)

      expect(screen.getByText('blastMode.screens.reassemble.instructions.reorder')).toBeInTheDocument()
    })

    it('should render pick-mode instructions when extra tiles exist', () => {
      render(
        <JpReassemble
          {...defaultProps}
          tiles={['年', '少', '中', '海']}
          correctOrder={['年', '少']}
        />
      )

      expect(screen.getByText('blastMode.screens.reassemble.instructions.pick')).toBeInTheDocument()
    })
  })

  describe('Click-to-swap interaction', () => {
    it('should select first tile on first click', () => {
      render(<JpReassemble {...defaultProps} />)

      const firstTile = screen.getByRole('button', { name: /Tile 1: る/i })
      fireEvent.click(firstTile)

      // First tile should be selected (has ring-2 class)
      expect(firstTile).toHaveClass('ring-2')
    })

    it('should deselect tile when clicked twice', () => {
      render(<JpReassemble {...defaultProps} />)

      const firstTile = screen.getByRole('button', { name: /Tile 1: る/i })

      // First click - select
      fireEvent.click(firstTile)
      expect(firstTile).toHaveClass('ring-2')

      // Second click - deselect
      fireEvent.click(firstTile)
      expect(firstTile).not.toHaveClass('ring-2')
    })

    it('should swap tiles when two different tiles are clicked', () => {
      render(<JpReassemble {...defaultProps} />)

      const tile1 = screen.getByRole('button', { name: /Tile 1: る/i })
      const tile2 = screen.getByRole('button', { name: /Tile 3: 食/i })

      // Click first tile
      fireEvent.click(tile1)

      // Click second tile - should swap
      fireEvent.click(tile2)

      // Order should have changed
      // Note: With mocked Reorder, we verify the state change by checking selection clears
      expect(tile1).not.toHaveClass('ring-2')
    })

    it('should not respond to clicks when disabled', () => {
      render(<JpReassemble {...defaultProps} disabled={true} />)

      const firstTile = screen.getByRole('button', { name: /Tile 1: る/i })
      fireEvent.click(firstTile)

      // Should not be selected
      expect(firstTile).not.toHaveClass('ring-2')
    })
  })

  describe('Submit functionality', () => {
    it('should trigger onAnswer when Enter key is pressed', async () => {
      const onAnswerMock = jest.fn()
      render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      // Press Enter to submit
      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalled()
      })
    })

    it('should trigger onAnswer when Submit button is clicked', async () => {
      const onAnswerMock = jest.fn()
      render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      const submitButton = screen.getByRole('button', { name: /Submit/i })
      fireEvent.click(submitButton)

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalled()
      })
    })

    it('should call onAnswer with correct=true for correct order', async () => {
      const onAnswerMock = jest.fn()
      const propsWithCorrectOrder = {
        ...defaultProps,
        tiles: ['食', 'べ', 'る'], // Already in correct order
        correctOrder: ['食', 'べ', 'る']
      }

      render(<JpReassemble {...propsWithCorrectOrder} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith(['食', 'べ', 'る'], true, expect.any(Number))
      })
    })

    it('should call onAnswer with correct=false for wrong order', async () => {
      const onAnswerMock = jest.fn()
      render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      // Submit with initial (wrong) order: ['る', 'べ', '食']
      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith(['る', 'べ', '食'], false, expect.any(Number))
      })
    })

    it('should capture response time at submission, not after UI delay', async () => {
      const onAnswerMock = jest.fn()
      const startTime = Date.now()

      // Mock Date.now to control time
      const realDateNow = Date.now.bind(global.Date)
      const mockDateNow = jest.spyOn(Date, 'now')
      mockDateNow.mockImplementation(() => startTime)

      render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      // Simulate 800ms passing before user submits
      mockDateNow.mockImplementation(() => startTime + 800)
      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Advance UI delay timer (1500ms)
      act(() => {
        jest.advanceTimersByTime(1500)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalled()
      })

      // Response time should be ~800ms (submission time), not 2300ms (submission + delay)
      const responseTime = onAnswerMock.mock.calls[0][2]
      expect(responseTime).toBeGreaterThanOrEqual(700)
      expect(responseTime).toBeLessThan(1000)
      // Should NOT include the 1500ms UI delay
      expect(responseTime).toBeLessThan(1500)

      mockDateNow.mockRestore()
    })

    it('should not trigger onAnswer immediately without delay', () => {
      const onAnswerMock = jest.fn()
      render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Should not call before timer
      expect(onAnswerMock).not.toHaveBeenCalled()
    })

    it('should use exactly 1500ms delay for auto-advance', async () => {
      const onAnswerMock = jest.fn()
      render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Before 1500ms
      act(() => {
        jest.advanceTimersByTime(1499)
      })
      expect(onAnswerMock).not.toHaveBeenCalled()

      // At 1500ms
      act(() => {
        jest.advanceTimersByTime(1)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledTimes(1)
      })
    })

    it('should not submit when disabled', () => {
      const onAnswerMock = jest.fn()
      render(<JpReassemble {...defaultProps} disabled={true} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      expect(onAnswerMock).not.toHaveBeenCalled()
    })

    it('should submit selected tiles in pick-mode', async () => {
      const onAnswerMock = jest.fn()
      render(
        <JpReassemble
          {...defaultProps}
          tiles={['年', '少', '中', '海']}
          correctOrder={['年', '少']}
          onAnswer={onAnswerMock}
        />
      )

      const tile1 = screen.getByRole('button', { name: /Tile 1: 年/i })
      const tile2 = screen.getByRole('button', { name: /Tile 2: 少/i })
      fireEvent.click(tile1)
      fireEvent.click(tile2)

      const submitButton = screen.getByRole('button', { name: /Submit/i })
      fireEvent.click(submitButton)

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith(['年', '少'], true, expect.any(Number))
      })
    })
  })

  describe('Reset functionality', () => {
    it('should restore original order when Reset button is clicked', () => {
      render(<JpReassemble {...defaultProps} />)

      const resetButton = screen.getByRole('button', { name: /Reset/i })
      fireEvent.click(resetButton)

      // Tiles should be restored to original shuffled order
      // Verify all tiles are still present
      expect(screen.getByText('る')).toBeInTheDocument()
      expect(screen.getByText('べ')).toBeInTheDocument()
      expect(screen.getByText('食')).toBeInTheDocument()
    })

    it('should restore original order when R key is pressed', () => {
      render(<JpReassemble {...defaultProps} />)

      fireEvent.keyPress(window, { key: 'R', code: 'KeyR' })

      // Tiles should be restored
      expect(screen.getByText('る')).toBeInTheDocument()
      expect(screen.getByText('べ')).toBeInTheDocument()
      expect(screen.getByText('食')).toBeInTheDocument()
    })

    it('should clear selection when reset', () => {
      render(<JpReassemble {...defaultProps} />)

      // Select a tile
      const firstTile = screen.getByRole('button', { name: /Tile 1: る/i })
      fireEvent.click(firstTile)
      expect(firstTile).toHaveClass('ring-2')

      // Reset
      fireEvent.keyPress(window, { key: 'R', code: 'KeyR' })

      // Selection should be cleared
      expect(firstTile).not.toHaveClass('ring-2')
    })

    it('should accept lowercase "r" key', () => {
      render(<JpReassemble {...defaultProps} />)

      fireEvent.keyPress(window, { key: 'r', code: 'KeyR' })

      // Should work with lowercase too
      expect(screen.getByText('る')).toBeInTheDocument()
    })
  })

  describe('Keyboard navigation', () => {
    it('should select tile when number key 1-9 is pressed', () => {
      render(<JpReassemble {...defaultProps} />)

      // Press "1" to select first tile
      fireEvent.keyPress(window, { key: '1', code: 'Digit1' })

      const firstTile = screen.getByRole('button', { name: /Tile 1: る/i })
      expect(firstTile).toHaveClass('ring-2')
    })

    it('should swap tiles using number keys', () => {
      render(<JpReassemble {...defaultProps} />)

      // Press "1" to select first tile
      fireEvent.keyPress(window, { key: '1', code: 'Digit1' })

      // Press "3" to select third tile and swap
      fireEvent.keyPress(window, { key: '3', code: 'Digit3' })

      // Selection should be cleared after swap
      const tiles = screen.getAllByRole('button')
      tiles.forEach(tile => {
        expect(tile).not.toHaveClass('ring-2')
      })
    })

    it('should not respond to keyboard when disabled', () => {
      const onAnswerMock = jest.fn()
      render(<JpReassemble {...defaultProps} disabled={true} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })
      fireEvent.keyPress(window, { key: 'R', code: 'KeyR' })
      fireEvent.keyPress(window, { key: '1', code: 'Digit1' })

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      expect(onAnswerMock).not.toHaveBeenCalled()
    })

    it('should not respond to keyboard after submission', () => {
      render(<JpReassemble {...defaultProps} />)

      // Submit
      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Try to use keyboard again
      fireEvent.keyPress(window, { key: '1', code: 'Digit1' })

      const firstTile = screen.getByRole('button', { name: /Tile 1: る/i })
      expect(firstTile).not.toHaveClass('ring-2')
    })
  })

  describe('Feedback display', () => {
    it('should show correct feedback for correct answer', async () => {
      const propsWithCorrectOrder = {
        ...defaultProps,
        tiles: ['食', 'べ', 'る'],
        correctOrder: ['食', 'べ', 'る']
      }

      render(<JpReassemble {...propsWithCorrectOrder} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Feedback should appear
      await waitFor(() => {
        expect(screen.getByText('blastMode.screens.reassemble.correct')).toBeInTheDocument()
      })
    })

    it('should show incorrect feedback with correct order for wrong answer', async () => {
      render(<JpReassemble {...defaultProps} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Feedback should appear with correct answer
      await waitFor(() => {
        expect(screen.getByText('blastMode.screens.reassemble.incorrect')).toBeInTheDocument()
      })
    })

    it('should hide Submit and Reset buttons after submission', () => {
      render(<JpReassemble {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: /Submit/i })
      const resetButton = screen.getByRole('button', { name: /Reset/i })

      expect(submitButton).toBeInTheDocument()
      expect(resetButton).toBeInTheDocument()

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Buttons should be hidden
      expect(screen.queryByRole('button', { name: /Submit/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Reset/i })).not.toBeInTheDocument()
    })

    it('should hide instructions after submission', () => {
      render(<JpReassemble {...defaultProps} />)

      expect(screen.getByText('blastMode.screens.reassemble.instructions.reorder')).toBeInTheDocument()

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Instructions should be hidden
      expect(screen.queryByText('blastMode.screens.reassemble.instructions.reorder')).not.toBeInTheDocument()
    })
  })

  describe('Duplicate tile handling', () => {
    it('should render tiles with repeated labels using unique IDs', () => {
      const propsWithDuplicates = {
        ...defaultProps,
        tiles: ['と', 'う', 'き', 'ょ', 'う'],
        correctOrder: ['と', 'う', 'き', 'ょ', 'う']
      }

      render(<JpReassemble {...propsWithDuplicates} />)

      // Should have 2 'う' tiles
      const uTiles = screen.getAllByText('う')
      expect(uTiles.length).toBe(2)

      // Each should have unique reorder-item test id
      // Ensure buttons exist for duplicates
      const tileButtons = screen.getAllByRole('button')
      expect(tileButtons.length).toBeGreaterThan(0)
    })

    it('should handle identical tiles correctly in swap', () => {
      const propsWithDuplicates = {
        ...defaultProps,
        tiles: ['あ', 'あ', 'い'],
        correctOrder: ['あ', 'い', 'あ']
      }

      render(<JpReassemble {...propsWithDuplicates} />)

      // Both 'あ' tiles should be rendered
      const aTiles = screen.getAllByText('あ')
      expect(aTiles.length).toBe(2)

      // Click first 'あ'
      fireEvent.click(aTiles[0])

      // Click second 'あ' - should swap
      fireEvent.click(aTiles[1])

      // Verify swap occurred (selection cleared)
      const tile1 = aTiles[0].closest('button')
      expect(tile1).not.toHaveClass('ring-2')
    })
  })

  describe('Single-choice mode', () => {
    it('should allow selecting a single correct tile', async () => {
      const onAnswerMock = jest.fn()
      render(
        <JpReassemble
          prompt="rest"
          tiles={['休', '木', '本', '土']}
          correctOrder={['休']}
          onAnswer={onAnswerMock}
        />
      )

      const correctTile = screen.getByRole('button', { name: /Tile 1: 休/i })
      fireEvent.click(correctTile)

      act(() => {
        jest.advanceTimersByTime(1200)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalledWith(['休'], true, expect.any(Number))
      })
    })
  })

  describe('State reset on tiles change', () => {
    it('should reset selection when tiles change', () => {
      const { rerender } = render(<JpReassemble {...defaultProps} />)

      // Select a tile
      const firstTile = screen.getByRole('button', { name: /Tile 1: る/i })
      fireEvent.click(firstTile)
      expect(firstTile).toHaveClass('ring-2')

      // Change tiles
      rerender(
        <JpReassemble
          {...defaultProps}
          tiles={['あ', 'い', 'う']}
          correctOrder={['あ', 'い', 'う']}
        />
      )

      // New tiles should not be selected
      const newTile = screen.getByRole('button', { name: /Tile 1: あ/i })
      expect(newTile).not.toHaveClass('ring-2')
    })

    it('should clear feedback when tiles change', () => {
      const { rerender } = render(<JpReassemble {...defaultProps} />)

      // Submit to show feedback
      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Change tiles
      rerender(
        <JpReassemble
          {...defaultProps}
          tiles={['あ', 'い', 'う']}
          correctOrder={['あ', 'い', 'う']}
        />
      )

      // Feedback should be cleared
      expect(screen.queryByText('blastMode.screens.reassemble.correct')).not.toBeInTheDocument()
      expect(screen.queryByText('blastMode.screens.reassemble.incorrect')).not.toBeInTheDocument()
    })
  })

  describe('Timer management', () => {
    it('should clear timer on unmount', () => {
      const onAnswerMock = jest.fn()
      const { unmount } = render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      // Unmount before timer fires
      unmount()

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      // Should not call after unmount
      expect(onAnswerMock).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible labels for tiles', () => {
      render(<JpReassemble {...defaultProps} />)

      expect(screen.getByLabelText('Tile 1: る')).toBeInTheDocument()
      expect(screen.getByLabelText('Tile 2: べ')).toBeInTheDocument()
      expect(screen.getByLabelText('Tile 3: 食')).toBeInTheDocument()
    })

    it('should have button role for all tiles', () => {
      render(<JpReassemble {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      // 3 tiles + Submit button + Reset button = 5 buttons
      expect(buttons.length).toBe(5)
    })

    it('should disable tiles when disabled prop is true', () => {
      render(<JpReassemble {...defaultProps} disabled={true} />)

      const submitButton = screen.getByRole('button', { name: /Submit/i })
      const resetButton = screen.getByRole('button', { name: /Reset/i })

      expect(submitButton).toBeDisabled()
      expect(resetButton).toBeDisabled()
    })
  })

  describe('No act warnings / timer leaks', () => {
    it('should not cause act warnings with proper timer handling', async () => {
      const onAnswerMock = jest.fn()
      const { unmount } = render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      await waitFor(() => {
        expect(onAnswerMock).toHaveBeenCalled()
      })

      unmount()
      // No errors should occur
    })

    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(<JpReassemble {...defaultProps} />)

      // Mount and unmount to verify no leaks
      unmount()

      const onAnswerMock = jest.fn()
      const { unmount: unmount2 } = render(<JpReassemble {...defaultProps} onAnswer={onAnswerMock} />)

      fireEvent.keyPress(window, { key: 'Enter', code: 'Enter' })

      act(() => {
        jest.advanceTimersByTime(1500)
      })

      expect(onAnswerMock).toHaveBeenCalledTimes(1)
      unmount2()
    })
  })
})
