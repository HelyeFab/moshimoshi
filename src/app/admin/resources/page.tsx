'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { useI18n } from '@/i18n/I18nContext';
import { ResourceListItem, ResourceStats } from '@/types/resources';
import { formatDistanceToNow } from 'date-fns';
import Modal from '@/components/ui/Modal';
import Dropdown from '@/components/ui/Dropdown';

export default function AdminResourcesPage() {
  const { t, strings } = useI18n();
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'scheduled'>('all');
  const [selectedResources, setSelectedResources] = useState<string[]>([]);

  // Add state for confirmation dialog and error message
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    loading: false,
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    isDestructive: true,
    onConfirm: () => { },
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, adminLoading, router]);

  // Load resources and stats
  useEffect(() => {
    if (isAdmin) {
      loadResourcesData();
    }
  }, [isAdmin, statusFilter]);

  const loadResourcesData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const [resourcesRes, statsRes] = await Promise.all([
        fetch(`/api/admin/resources?${params.toString()}`, {
          credentials: 'include'
        }),
        fetch('/api/admin/resources/stats', {
          credentials: 'include'
        })
      ]);

      if (!resourcesRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const resourcesData = await resourcesRes.json();
      const statsData = await statsRes.json();

      setResources(resourcesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading resources data:', error);
      setErrorMessage(strings.admin.resources.error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResource = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      loading: false,
      title: strings.admin.resources.deleteResource,
      message: strings.admin.resources.deleteResourceConfirm,
      confirmText: strings.admin.resources.delete,
      cancelText: strings.admin.resources.cancel,
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          const response = await fetch(`/api/admin/resources/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error('Failed to delete');
          }

          await loadResourcesData();
        } catch (error) {
          setErrorMessage(strings.admin.resources.failedToDelete);
          console.error('Error deleting resource:', error);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, loading: false }));
        }
      },
    });
  };

  const handleBulkDelete = async () => {
    if (selectedResources.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      loading: false,
      title: strings.admin.resources.deleteResources,
      message: strings.admin.resources.deleteResourcesConfirm.replace('{count}', selectedResources.length.toString()),
      confirmText: strings.admin.resources.delete,
      cancelText: strings.admin.resources.cancel,
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await Promise.all(selectedResources.map(id =>
            fetch(`/api/admin/resources/${id}`, {
              method: 'DELETE',
              credentials: 'include'
            })
          ));
          setSelectedResources([]);
          await loadResourcesData();
        } catch (error) {
          setErrorMessage(strings.admin.resources.failedToDeleteSome);
          console.error('Error bulk deleting resources:', error);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, loading: false }));
        }
      },
    });
  };

  const toggleResourceSelection = (id: string) => {
    setSelectedResources(prev =>
      prev.includes(id)
        ? prev.filter(resourceId => resourceId !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedResources.length === filteredResources.length) {
      setSelectedResources([]);
    } else {
      setSelectedResources(filteredResources.map(resource => resource.id));
    }
  };

  // Filter resources based on search query
  const filteredResources = resources.filter(resource => {
    const matchesSearch = searchQuery === '' ||
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
      scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (adminLoading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center">{strings.loading.general}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{strings.admin.resources.title}</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{strings.admin.resources.description}</p>
      </div>

      {/* Action button */}
      <div className="flex justify-between items-center">
        <div />
        <button
          onClick={() => router.push('/admin/resources/new')}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          + {strings.admin.resources.newResource}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-dark-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-primary-500">{stats.totalPosts}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{strings.admin.resources.totalPosts}</div>
          </div>
          <div className="bg-white dark:bg-dark-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600">{stats.publishedPosts}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{strings.admin.resources.published}</div>
          </div>
          <div className="bg-white dark:bg-dark-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-600">{stats.draftPosts}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{strings.admin.resources.draft}</div>
          </div>
          <div className="bg-white dark:bg-dark-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-blue-600">{stats.totalViews.toLocaleString()}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{strings.admin.resources.totalViews}</div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-dark-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder={strings.admin.resources.searchResources}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white"
            />
          </div>
          <Dropdown
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as any)}
            placeholder={strings.admin.resources.filterByStatus}
            options={[
              {
                value: 'all',
                label: strings.admin.resources.allStatus,
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              },
              {
                value: 'published',
                label: strings.admin.resources.published,
                icon: <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              },
              {
                value: 'draft',
                label: strings.admin.resources.draft,
                icon: <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              },
              {
                value: 'scheduled',
                label: strings.admin.resources.scheduled,
                icon: <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            ]}
            size="medium"
            variant="default"
          />
        </div>

        {/* Bulk Actions */}
        {selectedResources.length > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedResources.length} {strings.admin.resources.selected}
            </span>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              {strings.admin.resources.deleteSelected}
            </button>
            <button
              onClick={() => setSelectedResources([])}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {strings.admin.resources.clearSelection}
            </button>
          </div>
        )}
      </div>

      {/* Resources Table/Cards */}
      <div className="bg-white dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">{strings.admin.resources.loadingResources}</div>
        ) : filteredResources.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            {searchQuery ? strings.admin.resources.noResourcesMatching : strings.admin.resources.noResourcesFound}
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden">
              {/* Select All for mobile */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedResources.length === filteredResources.length && filteredResources.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                  {strings.admin.resources.selectAll}
                </label>
              </div>

              {/* Resource Cards */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredResources.map((resource) => (
                  <div key={resource.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedResources.includes(resource.id)}
                        onChange={() => toggleResourceSelection(resource.id)}
                        className="rounded mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{resource.title}</h3>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {getStatusBadge(resource.status)}
                            {resource.featured && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                {strings.admin.resources.featured}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>{resource.category || strings.admin.resources.uncategorized}</div>
                          <div>{resource.views.toLocaleString()} {strings.admin.resources.views} • {formatDistanceToNow(resource.updatedAt, { addSuffix: true })}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            onClick={() => router.push(`/admin/resources/${resource.id}/edit`)}
                            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            {strings.admin.resources.edit}
                          </button>
                          <button
                            onClick={() => window.open(`/resources/${resource.id}`, '_blank')}
                            className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded hover:bg-primary-600"
                          >
                            {strings.admin.resources.view}
                          </button>
                          <button
                            onClick={() => handleDeleteResource(resource.id)}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            {strings.admin.resources.delete}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="text-left p-4">
                      <input
                        type="checkbox"
                        checked={selectedResources.length === filteredResources.length && filteredResources.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left p-4 font-medium">{strings.admin.resources.title}</th>
                    <th className="text-left p-4 font-medium">{strings.admin.resources.status}</th>
                    <th className="text-left p-4 font-medium">{strings.admin.resources.category}</th>
                    <th className="text-left p-4 font-medium">{strings.admin.resources.views}</th>
                    <th className="text-left p-4 font-medium">{strings.admin.resources.updated}</th>
                    <th className="text-left p-4 font-medium">{strings.admin.resources.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResources.map((resource) => (
                    <tr key={resource.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedResources.includes(resource.id)}
                          onChange={() => toggleResourceSelection(resource.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{resource.title}</div>
                            {resource.featured && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                {strings.admin.resources.featured}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(resource.status)}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">{resource.category || strings.admin.resources.uncategorized}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">{resource.views.toLocaleString()}</td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">
                        {formatDistanceToNow(resource.updatedAt, { addSuffix: true })}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/admin/resources/${resource.id}/edit`)}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            {strings.admin.resources.edit}
                          </button>
                          <button
                            onClick={() => window.open(`/resources/${resource.id}`, '_blank')}
                            className="px-2 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600"
                          >
                            {strings.admin.resources.view}
                          </button>
                          <button
                            onClick={() => handleDeleteResource(resource.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            {strings.admin.resources.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        title={confirmDialog.title}
      >
        <div className="p-4">
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            {confirmDialog.message}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700"
              disabled={confirmDialog.loading}
            >
              {confirmDialog.cancelText || strings.common.cancel}
            </button>
            <button
              onClick={confirmDialog.onConfirm}
              className={`px-4 py-2 rounded-lg text-white ${
                confirmDialog.isDestructive
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-primary-500 hover:bg-primary-600'
              } disabled:opacity-50`}
              disabled={confirmDialog.loading}
            >
              {confirmDialog.loading ? strings.common.loading : confirmDialog.confirmText}
            </button>
          </div>
        </div>
      </Modal>

      {/* Error Message Modal */}
      {errorMessage && (
        <Modal
          isOpen={!!errorMessage}
          onClose={() => setErrorMessage(null)}
          title={strings.admin.resources.errors.loadFailed}
        >
          <div className="p-4">
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              {errorMessage}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorMessage(null)}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                OK
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}