import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminResourcesPage from '@/app/admin/resources/page';
import { useAdmin } from '@/hooks/useAdmin';
import { useI18n } from '@/i18n/I18nContext';
import {
  createMockResourceListItem,
  createMockResourceStats,
  TEST_RESOURCES,
  MOCK_I18N_STRINGS
} from '../test-utils';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams())
}));

jest.mock('@/hooks/useAdmin');
jest.mock('@/i18n/I18nContext');
jest.mock('@/components/ui/Modal', () => {
  return function MockModal({ isOpen, onClose, title, children }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="confirmation-dialog" role="dialog">
        <h2>{title}</h2>
        <div>{children}</div>
        <button onClick={onClose}>Close</button>
      </div>
    );
  };
});

// Import useRouter after mocking
import { useRouter } from 'next/navigation';

// Mock fetch
global.fetch = jest.fn();

describe('AdminResourcesPage Component', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    replace: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockImplementation(() => mockRouter);
    (useI18n as jest.Mock).mockReturnValue({
      t: (key: string) => key,
      strings: MOCK_I18N_STRINGS.en
    });
  });

  describe('Authentication and Authorization', () => {
    it('should redirect to home if user is not admin', () => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: false,
        isLoading: false
      });

      render(<AdminResourcesPage />);
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('should show loading state while checking admin status', () => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: false,
        isLoading: true
      });

      render(<AdminResourcesPage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render page when user is admin', async () => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: true,
        isLoading: false
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockResourceStats()
      });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Resources')).toBeInTheDocument();
        expect(screen.getByText('Manage blog posts and learning resources')).toBeInTheDocument();
      });
    });
  });

  describe('Loading and Displaying Resources', () => {
    beforeEach(() => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: true,
        isLoading: false
      });
    });

    it('should fetch and display resources on mount', async () => {
      const mockResources = TEST_RESOURCES.published;
      const mockStats = createMockResourceStats();

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStats
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/resources'),
          expect.objectContaining({ credentials: 'include' })
        );
        expect(fetch).toHaveBeenCalledWith(
          '/api/admin/resources/stats',
          expect.objectContaining({ credentials: 'include' })
        );
      });

      await waitFor(() => {
        mockResources.forEach(resource => {
          expect(screen.getByText(resource.title)).toBeInTheDocument();
        });
      });
    });

    it('should display stats cards', async () => {
      const mockStats = createMockResourceStats({
        totalPosts: 10,
        publishedPosts: 7,
        draftPosts: 3,
        totalViews: 500
      });

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStats
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('500')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching', () => {
      (fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AdminResourcesPage />);
      expect(screen.getByText('Loading resources...')).toBeInTheDocument();
    });

    it('should handle empty resource list', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats({ totalPosts: 0 })
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('No resources found')).toBeInTheDocument();
      });
    });

    it('should handle fetch errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Searching', () => {
    beforeEach(() => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: true,
        isLoading: false
      });
    });

    it('should filter resources by search query', async () => {
      const resources = [
        createMockResourceListItem({ title: 'React Tutorial', id: '1' }),
        createMockResourceListItem({ title: 'Vue Guide', id: '2' }),
        createMockResourceListItem({ title: 'Angular Basics', id: '3' })
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('React Tutorial')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search resources...');
      await userEvent.type(searchInput, 'React');

      expect(screen.getByText('React Tutorial')).toBeInTheDocument();
      expect(screen.queryByText('Vue Guide')).not.toBeInTheDocument();
      expect(screen.queryByText('Angular Basics')).not.toBeInTheDocument();
    });

    it('should filter resources by status', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => TEST_RESOURCES.published
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => TEST_RESOURCES.drafts
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      const { rerender } = render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/resources?'),
          expect.any(Object)
        );
      });

      const statusSelect = screen.getByRole('combobox');
      fireEvent.change(statusSelect, { target: { value: 'draft' } });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/resources?status=draft'),
          expect.any(Object)
        );
      });
    });

    it('should show no results message when search has no matches', async () => {
      const resources = [
        createMockResourceListItem({ title: 'React Tutorial', id: '1' })
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('React Tutorial')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search resources...');
      await userEvent.type(searchInput, 'NonExistent');

      expect(screen.getByText('No resources matching your search')).toBeInTheDocument();
    });

    it('should search by category', async () => {
      const resources = [
        createMockResourceListItem({ title: 'Grammar Guide', category: 'Grammar', id: '1' }),
        createMockResourceListItem({ title: 'Vocab List', category: 'Vocabulary', id: '2' })
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Grammar Guide')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search resources...');
      await userEvent.type(searchInput, 'grammar');

      expect(screen.getByText('Grammar Guide')).toBeInTheDocument();
      expect(screen.queryByText('Vocab List')).not.toBeInTheDocument();
    });

    it('should search by tags', async () => {
      const resources = [
        createMockResourceListItem({ title: 'JLPT N5', tags: ['jlpt', 'n5'], id: '1' }),
        createMockResourceListItem({ title: 'Kanji Study', tags: ['kanji'], id: '2' })
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('JLPT N5')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search resources...');
      await userEvent.type(searchInput, 'jlpt');

      expect(screen.getByText('JLPT N5')).toBeInTheDocument();
      expect(screen.queryByText('Kanji Study')).not.toBeInTheDocument();
    });
  });

  describe('Selection and Bulk Actions', () => {
    beforeEach(() => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: true,
        isLoading: false
      });
    });

    it('should toggle individual resource selection', async () => {
      const resources = TEST_RESOURCES.published;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText(resources[0].title)).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const firstResourceCheckbox = checkboxes[1]; // Skip select all checkbox

      fireEvent.click(firstResourceCheckbox);
      expect(firstResourceCheckbox).toBeChecked();

      fireEvent.click(firstResourceCheckbox);
      expect(firstResourceCheckbox).not.toBeChecked();
    });

    it('should select all resources', async () => {
      const resources = TEST_RESOURCES.published;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText(resources[0].title)).toBeInTheDocument();
      });

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      const allCheckboxes = screen.getAllByRole('checkbox');
      allCheckboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should show bulk actions when resources are selected', async () => {
      const resources = TEST_RESOURCES.published;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText(resources[0].title)).toBeInTheDocument();
      });

      const firstCheckbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(firstCheckbox);

      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByText('Delete Selected')).toBeInTheDocument();
      expect(screen.getByText('Clear Selection')).toBeInTheDocument();
    });

    it('should clear selection', async () => {
      const resources = TEST_RESOURCES.published;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText(resources[0].title)).toBeInTheDocument();
      });

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      const clearButton = screen.getByText('Clear Selection');
      fireEvent.click(clearButton);

      const allCheckboxes = screen.getAllByRole('checkbox');
      allCheckboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  describe('Resource Actions', () => {
    beforeEach(() => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: true,
        isLoading: false
      });
    });

    it('should navigate to create new resource', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        const newButton = screen.getByText('+ New Resource');
        fireEvent.click(newButton);
        expect(mockPush).toHaveBeenCalledWith('/admin/resources/new');
      });
    });

    it('should navigate to edit resource', async () => {
      const resources = [createMockResourceListItem({ id: 'resource-1' })];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        const editButtons = screen.getAllByText('Edit');
        fireEvent.click(editButtons[0]);
        expect(mockPush).toHaveBeenCalledWith('/admin/resources/resource-1/edit');
      });
    });

    it('should open resource in new tab', async () => {
      const mockOpen = jest.spyOn(window, 'open').mockImplementation();
      const resources = [createMockResourceListItem({ id: 'resource-1' })];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        const viewButtons = screen.getAllByText('View');
        fireEvent.click(viewButtons[0]);
        expect(mockOpen).toHaveBeenCalledWith('/resources/resource-1', '_blank');
      });

      mockOpen.mockRestore();
    });

    it('should delete single resource with confirmation', async () => {
      const resources = [createMockResourceListItem({ id: 'resource-1' })];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Deleted' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats({ totalPosts: 0 })
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByText('Delete');
        fireEvent.click(deleteButtons[0]);
      });

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByTestId('confirmation-dialog')).getByText('Confirm');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/admin/resources/resource-1',
          expect.objectContaining({
            method: 'DELETE',
            credentials: 'include'
          })
        );
      });
    });

    it('should handle delete error', async () => {
      const resources = [createMockResourceListItem({ id: 'resource-1' })];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Failed' })
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        const deleteButtons = screen.getAllByText('Delete');
        fireEvent.click(deleteButtons[0]);
      });

      const confirmButton = within(screen.getByTestId('confirmation-dialog')).getByText('Confirm');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to delete resource')).toBeInTheDocument();
      });
    });

    it('should bulk delete selected resources', async () => {
      const resources = TEST_RESOURCES.published;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText(resources[0].title)).toBeInTheDocument();
      });

      // Select all resources
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      const deleteSelectedButton = screen.getByText('Delete Selected');
      fireEvent.click(deleteSelectedButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        const dialog = screen.getByTestId('confirmation-dialog');
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText(/2 resources/)).toBeInTheDocument();
      });

      // Mock successful deletion
      resources.forEach(() => {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Deleted' })
        });
      });
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats({ totalPosts: 0 })
        });

      const confirmButton = within(screen.getByTestId('confirmation-dialog')).getByText('Confirm');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        resources.forEach(resource => {
          expect(fetch).toHaveBeenCalledWith(
            `/api/admin/resources/${resource.id}`,
            expect.objectContaining({
              method: 'DELETE',
              credentials: 'include'
            })
          );
        });
      });
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: true,
        isLoading: false
      });
    });

    it('should render mobile view for small screens', async () => {
      // Mock window.matchMedia for mobile
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }))
      });

      const resources = TEST_RESOURCES.published;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        // Check for mobile-specific elements
        const cards = screen.queryAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    it('should render desktop view for large screens', async () => {
      // Mock window.matchMedia for desktop
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(min-width: 769px)',
          media: query,
          onchange: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }))
      });

      const resources = TEST_RESOURCES.published;

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        // Check for desktop table
        const table = screen.queryByRole('table');
        expect(table).toBeInTheDocument();
      });
    });
  });

  describe('Status Badges', () => {
    beforeEach(() => {
      (useAdmin as jest.Mock).mockReturnValue({
        isAdmin: true,
        isLoading: false
      });
    });

    it('should display correct status badges', async () => {
      const resources = [
        createMockResourceListItem({ status: 'published', title: 'Published Post' }),
        createMockResourceListItem({ status: 'draft', title: 'Draft Post' }),
        createMockResourceListItem({ status: 'scheduled', title: 'Scheduled Post' })
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Published')).toHaveClass('bg-green-100');
        expect(screen.getByText('Draft')).toHaveClass('bg-gray-100');
        expect(screen.getByText('Scheduled')).toHaveClass('bg-blue-100');
      });
    });

    it('should display featured badge', async () => {
      const resources = [
        createMockResourceListItem({ featured: true, title: 'Featured Post' })
      ];

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => resources
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockResourceStats()
        });

      render(<AdminResourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Featured')).toBeInTheDocument();
      });
    });
  });
});