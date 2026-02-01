/**
 * @jest-environment jsdom
 *
 * StallBadge Component Tests
 *
 * Tests the visual badge component that displays on Learning Village stalls.
 * Validates rendering, animations, i18n, and styling for all badge types.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import StallBadge from '../StallBadge'
import { useI18n } from '@/i18n/I18nContext'

// Mock i18n hook
jest.mock('@/i18n/I18nContext', () => ({
  useI18n: jest.fn(),
}))

const mockUseI18n = useI18n as jest.MockedFunction<typeof useI18n>

describe('StallBadge', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Default i18n mock
    mockUseI18n.mockReturnValue({
      strings: {
        learningVillage: {
          badges: {
            new: 'New Content',
            updated: 'Updated',
            popular: 'Popular',
            featured: 'Featured',
          },
        },
      },
    } as any)
  })

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<StallBadge type="new" />)
      expect(screen.getByText('New Content')).toBeInTheDocument()
    })

    it('should render "new" badge with correct label', () => {
      render(<StallBadge type="new" />)
      expect(screen.getByText('New Content')).toBeInTheDocument()
    })

    it('should render "updated" badge with correct label', () => {
      render(<StallBadge type="updated" />)
      expect(screen.getByText('Updated')).toBeInTheDocument()
    })

    it('should render "popular" badge with correct label', () => {
      render(<StallBadge type="popular" />)
      expect(screen.getByText('Popular')).toBeInTheDocument()
    })

    it('should render "featured" badge with correct label', () => {
      render(<StallBadge type="featured" />)
      expect(screen.getByText('Featured')).toBeInTheDocument()
    })
  })

  describe('i18n integration', () => {
    it('should display Japanese translation when locale is ja', () => {
      mockUseI18n.mockReturnValue({
        strings: {
          learningVillage: {
            badges: {
              new: '新着コンテンツ',
              updated: '更新済み',
              popular: '人気',
              featured: '注目',
            },
          },
        },
      } as any)

      render(<StallBadge type="new" />)
      expect(screen.getByText('新着コンテンツ')).toBeInTheDocument()
    })

    it('should display Spanish translation when locale is es', () => {
      mockUseI18n.mockReturnValue({
        strings: {
          learningVillage: {
            badges: {
              new: 'Contenido Nuevo',
              updated: 'Actualizado',
              popular: 'Popular',
              featured: 'Destacado',
            },
          },
        },
      } as any)

      render(<StallBadge type="new" />)
      expect(screen.getByText('Contenido Nuevo')).toBeInTheDocument()
    })

    it('should display French translation when locale is fr', () => {
      mockUseI18n.mockReturnValue({
        strings: {
          learningVillage: {
            badges: {
              new: 'Nouveau Contenu',
              updated: 'Mis à Jour',
              popular: 'Populaire',
              featured: 'En Vedette',
            },
          },
        },
      } as any)

      render(<StallBadge type="new" />)
      expect(screen.getByText('Nouveau Contenu')).toBeInTheDocument()
    })

    it('should display German translation when locale is de', () => {
      mockUseI18n.mockReturnValue({
        strings: {
          learningVillage: {
            badges: {
              new: 'Neue Inhalte',
              updated: 'Aktualisiert',
              popular: 'Beliebt',
              featured: 'Hervorgehoben',
            },
          },
        },
      } as any)

      render(<StallBadge type="new" />)
      expect(screen.getByText('Neue Inhalte')).toBeInTheDocument()
    })

    it('should display Italian translation when locale is it', () => {
      mockUseI18n.mockReturnValue({
        strings: {
          learningVillage: {
            badges: {
              new: 'Nuovi Contenuti',
              updated: 'Aggiornato',
              popular: 'Popolare',
              featured: 'In Evidenza',
            },
          },
        },
      } as any)

      render(<StallBadge type="new" />)
      expect(screen.getByText('Nuovi Contenuti')).toBeInTheDocument()
    })

    it('should fallback to English if translation missing', () => {
      mockUseI18n.mockReturnValue({
        strings: {} as any,
      })

      render(<StallBadge type="new" />)
      expect(screen.getByText('New Content')).toBeInTheDocument()
    })
  })

  describe('styling and appearance', () => {
    it('should apply custom className when provided', () => {
      const { container } = render(<StallBadge type="new" className="custom-class" />)
      const badge = container.querySelector('.custom-class')
      expect(badge).toBeInTheDocument()
    })

    it('should have absolute positioning for overlay on stall cards', () => {
      const { container } = render(<StallBadge type="new" />)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('absolute')
    })

    it('should be positioned at top-right corner', () => {
      const { container } = render(<StallBadge type="new" />)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('-top-2')
      expect(badge).toHaveClass('-right-2')
    })

    it('should have high z-index for visibility above card content', () => {
      const { container } = render(<StallBadge type="new" />)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('z-10')
    })
  })

  describe('badge type specific styling', () => {
    it('should apply orange-pink gradient for "new" badge', () => {
      const { container } = render(<StallBadge type="new" />)
      const gradientElement = container.querySelector('.from-orange-400')
      expect(gradientElement).toBeInTheDocument()
    })

    it('should apply blue-cyan gradient for "updated" badge', () => {
      const { container } = render(<StallBadge type="updated" />)
      const gradientElement = container.querySelector('.from-blue-400')
      expect(gradientElement).toBeInTheDocument()
    })

    it('should apply purple-pink gradient for "popular" badge', () => {
      const { container } = render(<StallBadge type="popular" />)
      const gradientElement = container.querySelector('.from-purple-400')
      expect(gradientElement).toBeInTheDocument()
    })

    it('should apply yellow-orange gradient for "featured" badge', () => {
      const { container } = render(<StallBadge type="featured" />)
      const gradientElement = container.querySelector('.from-yellow-400')
      expect(gradientElement).toBeInTheDocument()
    })
  })

  describe('icon rendering', () => {
    it('should render Sparkles icon for "new" badge', () => {
      const { container } = render(<StallBadge type="new" />)
      // Lucide icons render as SVG with specific classes
      const icon = container.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('should render different icons for different badge types', () => {
      const types = ['new', 'updated', 'popular', 'featured'] as const

      types.forEach((type) => {
        const { container } = render(<StallBadge type={type} />)
        const icon = container.querySelector('svg')
        expect(icon).toBeInTheDocument()
      })
    })

    it('should size icon appropriately (w-3.5 h-3.5)', () => {
      const { container } = render(<StallBadge type="new" />)
      const icon = container.querySelector('svg')
      expect(icon).toHaveClass('w-3.5')
      expect(icon).toHaveClass('h-3.5')
    })
  })

  describe('accessibility', () => {
    it('should have appropriate text size for readability', () => {
      const { container } = render(<StallBadge type="new" />)
      const badgePill = container.querySelector('.text-xs')
      expect(badgePill).toBeInTheDocument()
    })

    it('should have bold font weight for emphasis', () => {
      const { container } = render(<StallBadge type="new" />)
      const badgePill = container.querySelector('.font-bold')
      expect(badgePill).toBeInTheDocument()
    })

    it('should have white text color for contrast', () => {
      const { container } = render(<StallBadge type="new" />)
      const badgePill = container.querySelector('.text-white')
      expect(badgePill).toBeInTheDocument()
    })

    it('should prevent text wrapping', () => {
      const { container } = render(<StallBadge type="new" />)
      const text = screen.getByText('New Content')
      expect(text).toHaveClass('whitespace-nowrap')
    })
  })

  describe('framer motion integration', () => {
    it('should render motion.div for animations', () => {
      const { container } = render(<StallBadge type="new" />)
      // Framer Motion components render as divs with absolute positioning
      const motionDiv = container.querySelector('.absolute.-top-2.-right-2')
      expect(motionDiv).toBeInTheDocument()
    })
  })

  describe('multiple badge rendering', () => {
    it('should render multiple badges independently', () => {
      const { container } = render(
        <>
          <StallBadge type="new" />
          <StallBadge type="updated" />
          <StallBadge type="popular" />
        </>
      )

      expect(screen.getByText('New Content')).toBeInTheDocument()
      expect(screen.getByText('Updated')).toBeInTheDocument()
      expect(screen.getByText('Popular')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle missing i18n strings gracefully', () => {
      mockUseI18n.mockReturnValue({
        strings: {
          learningVillage: {
            badges: {
              // Missing 'new' translation
            },
          },
        },
      } as any)

      render(<StallBadge type="new" />)
      // Should fallback to hardcoded English
      expect(screen.getByText('New Content')).toBeInTheDocument()
    })

    it('should handle completely missing i18n object', () => {
      mockUseI18n.mockReturnValue({
        strings: {},
      } as any)

      render(<StallBadge type="new" />)
      expect(screen.getByText('New Content')).toBeInTheDocument()
    })

    it('should handle null i18n return', () => {
      mockUseI18n.mockReturnValue({
        strings: null,
      } as any)

      render(<StallBadge type="new" />)
      expect(screen.getByText('New Content')).toBeInTheDocument()
    })
  })
})
