'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Story } from '@/types/story';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { TrashIcon, PencilIcon, EyeIcon } from '@heroicons/react/24/outline';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import Modal from '@/components/ui/Modal';

export default function AdminStoriesPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();
  const { showToast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [storyToPublish, setStoryToPublish] = useState<{ id: string; title: string } | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storyToDelete, setStoryToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleteSelectedModalOpen, setDeleteSelectedModalOpen] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/');
    }
  }, [user, sessionLoading, router]);

  const loadStories = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch both published stories and drafts
      const [storiesResponse, draftsResponse] = await Promise.all([
        fetch('/api/admin/stories?limit=100'),
        fetch('/api/admin/stories/drafts?limit=100')
      ]);

      // Handle responses gracefully - if endpoints don't exist or return errors, use empty arrays
      const storiesData = storiesResponse.ok ? await storiesResponse.json() : { stories: [] };
      const draftsData = draftsResponse.ok ? await draftsResponse.json() : { drafts: [] };

      // Combine stories and drafts, marking drafts with status: 'draft'
      const allStories = [
        ...(storiesData.stories || []),
        ...(draftsData.drafts || []).map((draft: any) => ({
          id: draft.id,
          title: draft.characterSheet?.storyTitle || 'Untitled',
          titleJa: draft.characterSheet?.storyTitleJa || '無題',
          theme: draft.theme || 'Unknown',
          jlptLevel: draft.jlptLevel || 'N5',
          pages: draft.pages || [],
          status: 'draft',
          viewCount: 0,
          slug: draft.id,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt
        }))
      ];

      setStories(allStories);

      // Only show error if both endpoints failed
      if (!storiesResponse.ok && !draftsResponse.ok) {
        console.warn('Stories API endpoints returned errors - showing empty state');
      }
    } catch (error) {
      console.error('Error loading stories:', error);
      showToast('Failed to load stories', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load stories and drafts
  useEffect(() => {
    if (user?.isAdmin) {
      loadStories();
    }
  }, [user, loadStories]);

  const handleToggleSelect = (storyId: string) => {
    setSelectedIds(prev =>
      prev.includes(storyId)
        ? prev.filter(id => id !== storyId)
        : [...prev, storyId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === stories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(stories.map(s => s.id));
    }
  };

  const openDeleteModal = (storyId: string, title: string) => {
    setStoryToDelete({ id: storyId, title });
    setDeleteModalOpen(true);
  };

  const handleDeleteStory = async () => {
    if (!storyToDelete) return;

    try {
      setDeleteModalOpen(false);
      setIsDeleting(true);
      const response = await fetch('/api/admin/stories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storyId: storyToDelete.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete story');
      }

      setStories(prev => prev.filter(s => s.id !== storyToDelete.id));
      setSelectedIds(prev => prev.filter(id => id !== storyToDelete.id));
      showToast('Story deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting story:', error);
      showToast('Failed to delete story', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteSelectedModal = () => {
    if (!selectedIds.length) return;
    setDeleteSelectedModalOpen(true);
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;

    try {
      setDeleteSelectedModalOpen(false);
      setIsDeleting(true);
      for (const id of selectedIds) {
        const response = await fetch('/api/admin/stories', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ storyId: id }),
        });

        if (!response.ok) {
          throw new Error(`Failed to delete story ${id}`);
        }
      }
      setStories(prev => prev.filter(s => !selectedIds.includes(s.id)));
      setSelectedIds([]);
      showToast('Selected stories deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting stories:', error);
      showToast('Failed to delete stories', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openPublishModal = (draftId: string, title: string) => {
    setStoryToPublish({ id: draftId, title });
    setPublishModalOpen(true);
  };

  const handlePublishDraft = async () => {
    if (!storyToPublish) return;

    try {
      setPublishModalOpen(false);
      setIsPublishing(true);
      const response = await fetch('/api/admin/stories/publish-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftId: storyToPublish.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to publish draft');
      }

      showToast('Story published successfully!', 'success');

      // Reload stories list
      await loadStories();
    } catch (error) {
      console.error('Error publishing draft:', error);
      showToast('Failed to publish story', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  if (sessionLoading || loading) {
    return <LoadingOverlay />;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <>
      <div className="max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            AI Stories Management
          </h1>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/stories/generate"
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-sm"
            >
              <span>✨</span>
              Generate with AI
            </Link>

            <Link
              href="/admin/stories/new"
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-sm"
            >
              Create New Story
            </Link>

            {selectedIds.length > 0 && (
              <button
                onClick={openDeleteSelectedModal}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Stories Table */}
        {stories.length === 0 ? (
          <div className="bg-white dark:bg-dark-850 rounded-lg p-12 text-center shadow-sm border border-gray-200 dark:border-dark-700">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No stories created yet
            </p>
            <Link
              href="/admin/stories/new"
              className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline transition-colors"
            >
              Create your first story
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-850 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-dark-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === stories.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-primary-500 focus:ring-primary-500 dark:focus:ring-primary-400"
                      />
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Title
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Level
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Theme
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Pages
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Status
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Views
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stories.map((story) => (
                    <tr
                      key={story.id}
                      className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-800"
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(story.id)}
                          onChange={() => handleToggleSelect(story.id)}
                          className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-800 text-primary-500 focus:ring-primary-500 dark:focus:ring-primary-400"
                        />
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {story.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {story.titleJa}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                          {story.jlptLevel}
                        </span>
                      </td>
                      <td className="p-4 text-gray-900 dark:text-gray-100">
                        {story.theme}
                      </td>
                      <td className="p-4 text-gray-900 dark:text-gray-100">
                        {story.pages.length}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${story.status === 'published'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : story.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                          {story.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-900 dark:text-gray-100">
                        {story.viewCount || 0}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {story.status === 'draft' ? (
                            <>
                              <button
                                onClick={() => openPublishModal(story.id, story.title)}
                                disabled={isPublishing}
                                className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300 rounded transition-colors disabled:opacity-50"
                                title="Publish story"
                              >
                                Publish
                              </button>
                              <Link
                                href={`/admin/stories/edit/${story.id}?draft=true`}
                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                                title="Edit draft"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </Link>
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/stories/${story.slug}`}
                                className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                title="View story"
                                target="_blank"
                              >
                                <EyeIcon className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/admin/stories/edit/${story.id}`}
                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                                title="Edit story"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </Link>
                            </>
                          )}
                          <button
                            onClick={() => openDeleteModal(story.id, story.title)}
                            disabled={isDeleting}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete story"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete/Publish confirmation overlay */}
      {(isDeleting || isPublishing) && <LoadingOverlay />}

      {/* Publish Confirmation Modal */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish Story"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to publish <strong>&quot;{storyToPublish?.title}&quot;</strong>?
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will make the story visible to all users.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setPublishModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePublishDraft}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Publish
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Story Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Story"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>&quot;{storyToDelete?.title}&quot;</strong>?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteStory}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Selected Stories Confirmation Modal */}
      <Modal
        isOpen={deleteSelectedModalOpen}
        onClose={() => setDeleteSelectedModalOpen(false)}
        title="Delete Multiple Stories"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>{selectedIds.length} selected {selectedIds.length === 1 ? 'story' : 'stories'}</strong>?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteSelectedModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete All
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}