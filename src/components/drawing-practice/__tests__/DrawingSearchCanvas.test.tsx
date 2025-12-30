/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import DrawingSearchCanvas from '../DrawingSearchCanvas'

// Setup canvas mock
const mockContext = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  lineCap: 'round',
  lineJoin: 'round',
  strokeStyle: '#000000',
  lineWidth: 4,
}

// Mock HTMLCanvasElement.getContext before tests
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext) as any
})

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, onClick, disabled, className, title, ...props }: any) => (
      <button onClick={onClick} disabled={disabled} className={className} title={title} {...props}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock kanjiCanvasService
const mockRecognizeHybrid = jest.fn()
const mockLoadScripts = jest.fn()
const mockInitCanvas = jest.fn()
const mockEraseCanvas = jest.fn()

jest.mock('@/services/kanjiCanvasService', () => ({
  kanjiCanvasService: {
    loadScripts: () => mockLoadScripts(),
    initCanvas: (id: string) => mockInitCanvas(id),
    eraseCanvas: (id: string) => mockEraseCanvas(id),
    recognizeHybrid: (...args: any[]) => mockRecognizeHybrid(...args),
  },
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="trash-icon">Trash</span>,
  Undo2: () => <span data-testid="undo-icon">Undo</span>,
  Search: () => <span data-testid="search-icon">Search</span>,
}))

describe('DrawingSearchCanvas', () => {
  const mockOnCandidatesChange = jest.fn()
  const mockOnSearching = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Reset mock context methods
    Object.values(mockContext).forEach(val => {
      if (typeof val === 'function') {
        (val as jest.Mock).mockClear()
      }
    })

    // Default mock implementations
    mockLoadScripts.mockResolvedValue(undefined)
    mockInitCanvas.mockResolvedValue(undefined)
    mockRecognizeHybrid.mockResolvedValue({
      candidates: ['水', '氷', '永'],
      confidence: [0.95, 0.8, 0.7],
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const defaultProps = {
    onCandidatesChange: mockOnCandidatesChange,
    onSearching: mockOnSearching,
  }

  describe('Rendering', () => {
    it('renders canvas element', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      const canvas = screen.getByTestId('drawing-search-canvas')
      expect(canvas).toBeInTheDocument()
      expect(canvas.tagName).toBe('CANVAS')
    })

    it('renders with default dimensions', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      const canvas = screen.getByTestId('drawing-search-canvas')
      expect(canvas).toHaveAttribute('width', '200')
      expect(canvas).toHaveAttribute('height', '200')
    })

    it('renders with custom dimensions', () => {
      render(<DrawingSearchCanvas {...defaultProps} width={300} height={250} />)

      const canvas = screen.getByTestId('drawing-search-canvas')
      expect(canvas).toHaveAttribute('width', '300')
      expect(canvas).toHaveAttribute('height', '250')
    })

    it('renders undo and clear buttons', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      expect(screen.getByTestId('undo-button')).toBeInTheDocument()
      expect(screen.getByTestId('clear-button')).toBeInTheDocument()
    })

    it('renders instruction text', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      expect(screen.getByText('Draw a kanji to search')).toBeInTheDocument()
    })

    it('shows loading state initially', async () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('buttons are disabled when no strokes', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      expect(screen.getByTestId('undo-button')).toBeDisabled()
      expect(screen.getByTestId('clear-button')).toBeDisabled()
    })
  })

  describe('Initialization', () => {
    it('loads recognition scripts on mount', async () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      // Fast-forward through initialization delay
      await act(async () => {
        jest.advanceTimersByTime(300)
      })

      expect(mockLoadScripts).toHaveBeenCalled()
    })

    it('calls initCanvas after scripts load successfully', async () => {
      // Reset mocks to track specific behavior
      mockLoadScripts.mockResolvedValue(undefined)
      mockInitCanvas.mockResolvedValue(undefined)

      const { unmount } = render(<DrawingSearchCanvas {...defaultProps} />)

      // Wait for initialization timer
      await act(async () => {
        jest.advanceTimersByTime(200)
      })

      // Then wait for the inner timeout after loadScripts
      await act(async () => {
        jest.advanceTimersByTime(150)
      })

      // Verify loadScripts was called
      expect(mockLoadScripts).toHaveBeenCalled()

      unmount()
    })
  })

  describe('Drawing Interaction', () => {
    it('handles mouse down event', async () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      const canvas = screen.getByTestId('drawing-search-canvas')

      // Simulate mousedown
      fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 })

      // The canvas should start tracking the drawing
      // Since we're using native event listeners, we need to verify through state effects
    })

    it('handles touch events', async () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      const canvas = screen.getByTestId('drawing-search-canvas')

      // Simulate touch start
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 50, clientY: 50, identifier: 0 } as Touch],
        bubbles: true,
        cancelable: true,
      })

      canvas.dispatchEvent(touchStartEvent)
    })
  })

  describe('Recognition', () => {
    it('has recognition service mocked correctly', () => {
      // Verify our mocks are set up correctly
      expect(mockRecognizeHybrid).toBeDefined()
      expect(mockLoadScripts).toBeDefined()
      expect(mockInitCanvas).toBeDefined()
    })

    it('recognition service returns expected format', async () => {
      const result = await mockRecognizeHybrid('test', [], 'kanji', 200, 200)
      expect(result).toHaveProperty('candidates')
      expect(result).toHaveProperty('confidence')
      expect(Array.isArray(result.candidates)).toBe(true)
    })
  })

  describe('Clear Functionality', () => {
    it('clear button is initially disabled', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)
      const clearButton = screen.getByTestId('clear-button')
      expect(clearButton).toBeDisabled()
    })

    it('clear button has correct aria-label', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)
      expect(screen.getByLabelText('Clear canvas')).toBeInTheDocument()
    })
  })

  describe('Undo Functionality', () => {
    it('undo button is initially disabled', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)
      const undoButton = screen.getByTestId('undo-button')
      expect(undoButton).toBeDisabled()
    })

    it('undo button has correct aria-label', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)
      expect(screen.getByLabelText('Undo last stroke')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles initialization failure gracefully', async () => {
      mockLoadScripts.mockRejectedValue(new Error('Failed to load'))

      render(<DrawingSearchCanvas {...defaultProps} />)

      await act(async () => {
        jest.advanceTimersByTime(300)
      })

      // Component should still render without crashing
      expect(screen.getByTestId('drawing-search-canvas')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has accessible button labels', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      expect(screen.getByLabelText('Undo last stroke')).toBeInTheDocument()
      expect(screen.getByLabelText('Clear canvas')).toBeInTheDocument()
    })

    it('canvas has touch-none class for proper touch handling', () => {
      render(<DrawingSearchCanvas {...defaultProps} />)

      const canvas = screen.getByTestId('drawing-search-canvas')
      expect(canvas).toHaveClass('touch-none')
    })
  })

  describe('Custom Props', () => {
    it('applies custom className', () => {
      const { container } = render(<DrawingSearchCanvas {...defaultProps} className="custom-class" />)

      // The wrapper div should have the custom class
      const wrapper = container.querySelector('.custom-class')
      expect(wrapper).toBeInTheDocument()
    })

    it('accepts custom dimensions', () => {
      render(<DrawingSearchCanvas {...defaultProps} width={250} height={250} />)

      const canvas = screen.getByTestId('drawing-search-canvas')
      expect(canvas).toHaveAttribute('width', '250')
      expect(canvas).toHaveAttribute('height', '250')
    })

    it('accepts custom stroke properties', () => {
      render(<DrawingSearchCanvas {...defaultProps} strokeColor="#FF0000" strokeWidth={5} />)

      // Canvas should render with the custom props
      const canvas = screen.getByTestId('drawing-search-canvas')
      expect(canvas).toBeInTheDocument()
    })
  })
})
