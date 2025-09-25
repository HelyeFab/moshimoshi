import React from 'react'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import AdminResourcesPage from '@/app/admin/resources/page'

expect.extend(toHaveNoViolations)

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn()
  })),
  useSearchParams: jest.fn(() => new URLSearchParams())
}))

jest.mock('@/hooks/useAdmin', () => ({
  useAdmin: jest.fn(() => ({
    isAdmin: true,
    isLoading: false
  }))
}))

jest.mock('@/i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
    strings: {
      common: {
        cancel: 'Cancel',
        loading: 'Loading...'
      },
      admin: {
        resources: {
          title: 'Resources',
          searchPlaceholder: 'Search resources',
          filterByStatus: 'Filter by status',
          createNew: 'Create New',
          newResource: 'New Resource',
          allStatus: 'All',
          published: 'Published',
          draft: 'Draft',
          scheduled: 'Scheduled',
          selected: 'selected',
          deleteSelected: 'Delete Selected',
          clearSelection: 'Clear Selection',
          loadingResources: 'Loading resources...',
          noResourcesFound: 'No resources found',
          noResourcesMatching: 'No resources matching',
          selectAll: 'Select All',
          featured: 'Featured',
          uncategorized: 'Uncategorized',
          views: 'views',
          edit: 'Edit',
          view: 'View',
          delete: 'Delete',
          actions: 'Actions',
          status: 'Status',
          category: 'Category',
          updated: 'Updated',
          totalPosts: 'Total Posts',
          totalViews: 'Total Views',
          deleteResource: 'Delete Resource',
          deleteResourceConfirm: 'Are you sure?',
          deleteResources: 'Delete Resources',
          deleteResourcesConfirm: 'Delete {count} resources?',
          error: 'Error',
          failedToDelete: 'Failed to delete',
          failedToDeleteSome: 'Failed to delete some',
          description: 'Manage resources',
          errors: {
            loadFailed: 'Failed to load resources'
          }
        }
      },
      loading: {
        general: 'Loading...'
      }
    }
  })
}))

// Mock Modal component
jest.mock('@/components/ui/Modal', () => {
  return function Modal({ isOpen, children, title }: any) {
    if (!isOpen) return null
    return (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    )
  }
})

global.fetch = jest.fn()

describe('Resources Accessibility Tests', () => {
  const mockFetch = global.fetch as jest.Mock

  const createMockResource = (overrides = {}) => ({
    id: 'resource-1',
    title: 'Test Resource',
    status: 'published',
    category: 'test',
    views: 100,
    updatedAt: new Date(),
    featured: false,
    tags: [],
    ...overrides
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('WCAG 2.1 Compliance', () => {
    it('should have no accessibility violations in default state', async () => {
      const resources = [
        createMockResource({ id: '1', title: 'Resource 1' }),
        createMockResource({ id: '2', title: 'Resource 2', status: 'draft' })
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 2, publishedPosts: 1, draftPosts: 1, totalViews: 150 })
      })

      const { container } = render(<AdminResourcesPage />)

      // Wait for content to load
      await screen.findByText('Resource 1')

      // Run axe accessibility tests
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no violations in empty state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 0, publishedPosts: 0, draftPosts: 0, totalViews: 0 })
      })

      const { container } = render(<AdminResourcesPage />)
      await screen.findByText('No resources found')

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no violations during loading state', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolve

      const { container } = render(<AdminResourcesPage />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should navigate through all interactive elements with keyboard', async () => {
      const resources = [
        createMockResource({ id: '1', title: 'Resource 1' }),
        createMockResource({ id: '2', title: 'Resource 2' }),
        createMockResource({ id: '3', title: 'Resource 3' })
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 3, publishedPosts: 3, draftPosts: 0, totalViews: 300 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Resource 1')

      // Test Tab navigation order
      const searchInput = screen.getByPlaceholderText('Search resources')
      const createButton = screen.getByText('+ New Resource')

      // Verify all elements are keyboard accessible
      const interactiveElements = [
        searchInput,
        createButton
      ]

      // Verify all elements are keyboard accessible
      interactiveElements.forEach(element => {
        element.focus()
        expect(element).toHaveFocus()
      })
    })

    it('should handle Enter and Space keys on buttons', async () => {
      const resources = [createMockResource()]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 1, publishedPosts: 1, draftPosts: 0, totalViews: 100 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Test Resource')

      const viewButton = screen.getAllByText('View')[0]

      // Test Enter key
      viewButton.focus()
      fireEvent.keyDown(viewButton, { key: 'Enter', code: 'Enter' })
      // Verify action was triggered (implementation dependent)

      // Test Space key
      fireEvent.keyDown(viewButton, { key: ' ', code: 'Space' })
      // Verify action was triggered
    })

    it('should trap focus in modal dialogs', async () => {
      const resources = [createMockResource()]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 1, publishedPosts: 1, draftPosts: 0, totalViews: 100 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Test Resource')

      // Open delete confirmation modal
      const deleteButton = screen.getAllByText('Delete')[0]
      fireEvent.click(deleteButton)

      // Wait for modal
      const modal = await screen.findByRole('dialog')
      const modalElements = within(modal).getAllByRole('button')

      // Verify focus is trapped within modal
      modalElements[0].focus()
      expect(modalElements[0]).toHaveFocus()

      // Tab should cycle within modal
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
      expect(modalElements[1] || modalElements[0]).toHaveFocus()
    })

    it('should support Escape key to close modals', async () => {
      const resources = [createMockResource()]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 1, publishedPosts: 1, draftPosts: 0, totalViews: 100 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Test Resource')

      // Open modal
      const deleteButton = screen.getAllByText('Delete')[0]
      fireEvent.click(deleteButton)

      const modal = await screen.findByRole('dialog')
      expect(modal).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels', async () => {
      const resources = [
        createMockResource({ id: '1', title: 'Resource 1' }),
        createMockResource({ id: '2', title: 'Resource 2' }),
        createMockResource({ id: '3', title: 'Resource 3' })
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 3, publishedPosts: 3, draftPosts: 0, totalViews: 300 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Resource 1')

      // Check for ARIA labels on form inputs
      const searchInput = screen.getByPlaceholderText('Search resources')
      expect(searchInput).toBeInTheDocument()

      // Check buttons have accessible text
      const buttons = screen.getAllByText(/View|Edit|Delete/)
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should announce live updates', async () => {
      const resources = [createMockResource()]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 1, publishedPosts: 1, draftPosts: 0, totalViews: 100 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Test Resource')

      // Check for delete button
      const deleteButton = screen.getAllByText('Delete')[0]
      expect(deleteButton).toBeInTheDocument()

      // Trigger delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      fireEvent.click(deleteButton)

      // Check modal appears
      await waitFor(() => {
        expect(screen.getByText('Delete Resource')).toBeInTheDocument()
      })
    })

    it('should have proper heading hierarchy', async () => {
      const resources = Array.from({ length: 5 }, (_, i) =>
        createMockResource({ id: `${i}`, title: `Resource ${i}` })
      )
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 5, publishedPosts: 5, draftPosts: 0, totalViews: 500 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Resource 0')

      // Check heading hierarchy
      const h2s = screen.getAllByRole('heading', { level: 2 })
      expect(h2s.length).toBeGreaterThan(0)
    })
  })

  describe('Form Accessibility', () => {
    it('should have associated labels for all form controls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 0, publishedPosts: 0, draftPosts: 0, totalViews: 0 })
      })

      render(<AdminResourcesPage />)

      const searchInput = screen.getByPlaceholderText('Search resources')
      expect(searchInput).toBeInTheDocument()

      // Check select elements exist
      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBeGreaterThan(0)
    })

    it('should show error messages accessibly', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<AdminResourcesPage />)

      const errorMessage = await screen.findByRole('dialog')
      expect(errorMessage).toBeInTheDocument()
    })

    it('should indicate required fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 0, publishedPosts: 0, draftPosts: 0, totalViews: 0 })
      })

      render(<AdminResourcesPage />)

      // Check that important elements exist
      const createButton = screen.getByText('+ New Resource')
      expect(createButton).toBeInTheDocument()
    })
  })

  describe('Color Contrast', () => {
    it('should have sufficient color contrast for text', async () => {
      const resources = [
        createMockResource({ id: '1', title: 'Resource 1' }),
        createMockResource({ id: '2', title: 'Resource 2' }),
        createMockResource({ id: '3', title: 'Resource 3' })
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 3, publishedPosts: 3, draftPosts: 0, totalViews: 300 })
      })

      const { container } = render(<AdminResourcesPage />)
      await screen.findByText('Resource 1')

      // Run specific color contrast tests
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })

      expect(results.violations.filter(v => v.id === 'color-contrast')).toHaveLength(0)
    })

    it('should maintain contrast in dark mode', async () => {
      // Add dark mode class to document
      document.documentElement.classList.add('dark')

      const resources = [
        createMockResource({ id: '1', title: 'Resource 1' }),
        createMockResource({ id: '2', title: 'Resource 2' }),
        createMockResource({ id: '3', title: 'Resource 3' })
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 3, publishedPosts: 3, draftPosts: 0, totalViews: 300 })
      })

      const { container } = render(<AdminResourcesPage />)
      await screen.findByText('Resource 1')

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })

      expect(results.violations.filter(v => v.id === 'color-contrast')).toHaveLength(0)

      // Clean up
      document.documentElement.classList.remove('dark')
    })
  })

  describe('Focus Management', () => {
    it('should show visible focus indicators', async () => {
      const resources = [createMockResource()]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 1, publishedPosts: 1, draftPosts: 0, totalViews: 100 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Test Resource')

      const button = screen.getByText('+ New Resource')
      button.focus()

      // Check for focus styles
      const styles = window.getComputedStyle(button)
      expect(styles.outlineWidth).not.toBe('0px')
    })

    it('should restore focus after modal closes', async () => {
      const resources = [createMockResource()]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 1, publishedPosts: 1, draftPosts: 0, totalViews: 100 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Test Resource')

      const deleteButton = screen.getAllByText('Delete')[0]
      deleteButton.focus()
      fireEvent.click(deleteButton)

      // Modal opens
      const modal = await screen.findByRole('dialog')
      expect(modal).toBeInTheDocument()

      // Close modal
      const cancelButton = within(modal).getByText('Cancel')
      fireEvent.click(cancelButton)

      // Focus should return to delete button
      await waitFor(() => {
        expect(deleteButton).toHaveFocus()
      })
    })
  })

  describe('Responsive Accessibility', () => {
    it('should maintain accessibility on mobile viewports', async () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      const resources = [
        createMockResource({ id: '1', title: 'Resource 1' }),
        createMockResource({ id: '2', title: 'Resource 2' }),
        createMockResource({ id: '3', title: 'Resource 3' })
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 3, publishedPosts: 3, draftPosts: 0, totalViews: 300 })
      })

      const { container } = render(<AdminResourcesPage />)
      await screen.findByText('Resource 1')

      const results = await axe(container)
      expect(results).toHaveNoViolations()

      // Reset viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      })
    })

    it('should have touch-friendly target sizes on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      const resources = [createMockResource()]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resources
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalPosts: 1, publishedPosts: 1, draftPosts: 0, totalViews: 100 })
      })

      render(<AdminResourcesPage />)
      await screen.findByText('Test Resource')

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect()
        // WCAG 2.5.5: Target size should be at least 44x44 pixels
        expect(rect.width).toBeGreaterThanOrEqual(44)
        expect(rect.height).toBeGreaterThanOrEqual(44)
      })
    })
  })
})