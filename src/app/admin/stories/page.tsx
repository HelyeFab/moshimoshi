'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Story } from '@/types/story';
import { storyService } from '@/lib/services/StoryService';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { TrashIcon, PencilIcon, EyeIcon } from '@heroicons/react/24/outline';
import Navbar from '@/components/layout/Navbar';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

export default function AdminStoriesPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();
  const { showToast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/');
    }
  }, [user, sessionLoading, router]);

  // Load stories
  useEffect(() => {
    if (user?.isAdmin) {
      loadStories();
    }
  }, [user]);

  const loadStories = async () => {
    try {
      setLoading(true);
      const adminStories = await storyService.getAdminStories(100);
      setStories(adminStories);
    } catch (error) {
      console.error('Error loading stories:', error);
      showToast({
        message: 'Failed to load stories',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

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

  const handleDeleteStory = async (storyId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await storyService.deleteStory(storyId);
      setStories(prev => prev.filter(s => s.id !== storyId));
      setSelectedIds(prev => prev.filter(id => id !== storyId));
      showToast({
        message: 'Story deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting story:', error);
      showToast({
        message: 'Failed to delete story',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected stories?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      for (const id of selectedIds) {
        await storyService.deleteStory(id);
      }
      setStories(prev => prev.filter(s => !selectedIds.includes(s.id)));
      setSelectedIds([]);
      showToast({
        message: 'Selected stories deleted successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting stories:', error);
      showToast({
        message: 'Failed to delete stories',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (sessionLoading || loading) {
    return <LoadingOverlay />;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-dark">
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            AI Stories Management
          </h1>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/stories/generate"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
            >
              <span>✨</span>
              Generate with AI
            </Link>

            <Link
              href="/admin/stories/new"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create New Story
            </Link>

            {selectedIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Stories Table */}
        {stories.length === 0 ? (
          <div className="bg-white dark:bg-dark-850 rounded-lg p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No stories created yet
            </p>
            <Link
              href="/admin/stories/new"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              Create your first story
            </Link>
          </div>
        ) : (
          <div className="bg-soft-white dark:bg-dark-850 rounded-lg overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-900">
                  <tr>
                    <th className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === stories.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 dark:border-gray-600"
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
                          className="rounded border-gray-300 dark:border-gray-600"
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400">
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          story.status === 'published'
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
                          <Link
                            href={`/stories/${story.slug}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="View story"
                            target="_blank"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/admin/stories/edit/${story.id}`}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Edit story"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDeleteStory(story.id, story.title)}
                            disabled={isDeleting}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
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

      {/* Delete confirmation overlay */}
      {isDeleting && <LoadingOverlay />}
    </div>
  );
}