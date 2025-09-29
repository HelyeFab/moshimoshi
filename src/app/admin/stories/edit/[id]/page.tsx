'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { storyService } from '@/lib/services/StoryService';
import Navbar from '@/components/layout/Navbar';
import { Story } from '@/types/story';
import { JLPTLevel } from '@/types/aiStory';
import { STORY_THEMES } from '@/types/story';
import { ChevronLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

interface PageData {
  text: string;
  translation: string;
  imageUrl?: string;
}

export default function EditStoryPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();

  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [title, setTitle] = useState('');
  const [titleJa, setTitleJa] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState<string>(STORY_THEMES[0]);
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [pages, setPages] = useState<PageData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [isSaving, setIsSaving] = useState(false);

  // Load story data
  useEffect(() => {
    const loadStory = async () => {
      try {
        const storyData = await storyService.getStory(storyId);
        if (!storyData) {
          showToast({
            message: 'Story not found',
            type: 'error'
          });
          router.push('/admin/stories');
          return;
        }

        setStory(storyData);
        setTitle(storyData.title);
        setTitleJa(storyData.titleJa);
        setDescription(storyData.description);
        setTheme(storyData.theme);
        setJlptLevel(storyData.jlptLevel);
        setStatus(storyData.status);
        setTags(storyData.tags || []);

        // Convert story pages to editable format
        setPages(storyData.pages.map(page => ({
          text: page.text,
          translation: page.translation,
          imageUrl: page.imageUrl || ''
        })));
      } catch (error) {
        console.error('Error loading story:', error);
        showToast({
          message: 'Failed to load story',
          type: 'error'
        });
        router.push('/admin/stories');
      } finally {
        setLoading(false);
      }
    };

    if (storyId) {
      loadStory();
    }
  }, [storyId, router, showToast]);

  const handleAddPage = () => {
    setPages([...pages, { text: '', translation: '', imageUrl: '' }]);
  };

  const handleRemovePage = (index: number) => {
    if (pages.length > 1) {
      setPages(pages.filter((_, i) => i !== index));
    }
  };

  const handlePageChange = (index: number, field: keyof PageData, value: string) => {
    const newPages = [...pages];
    newPages[index] = { ...newPages[index], [field]: value };
    setPages(newPages);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!title || !titleJa || !description) {
      showToast({
        message: 'Please fill in all required fields',
        type: 'error'
      });
      return;
    }

    if (pages.some(p => !p.text || !p.translation)) {
      showToast({
        message: 'All pages must have Japanese text and translation',
        type: 'error'
      });
      return;
    }

    setIsSaving(true);
    try {
      const formattedPages = pages.map((page, index) => ({
        pageNumber: index + 1,
        text: page.text,
        translation: page.translation,
        imageUrl: page.imageUrl || '',
        imageAlt: `Page ${index + 1}`,
        vocabularyNotes: story?.pages[index]?.vocabularyNotes || {},
        grammarNotes: story?.pages[index]?.grammarNotes || {}
      }));

      await storyService.updateStory(storyId, {
        title,
        titleJa,
        description,
        jlptLevel,
        theme,
        tags,
        pages: formattedPages,
        status,
        // Preserve quiz if it exists
        quiz: story?.quiz || []
      });

      showToast({
        message: 'Story updated successfully!',
        type: 'success'
      });

      router.push('/admin/stories');
    } catch (error) {
      console.error('Error updating story:', error);
      showToast({
        message: 'Failed to update story',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return;
    }

    try {
      await storyService.deleteStory(storyId);
      showToast({
        message: 'Story deleted successfully',
        type: 'success'
      });
      router.push('/admin/stories');
    } catch (error) {
      console.error('Error deleting story:', error);
      showToast({
        message: 'Failed to delete story',
        type: 'error'
      });
    }
  };

  if (!user || !user.isAdmin) {
    return null;
  }

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-dark">
      <Navbar user={user} showUserMenu={true} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/stories"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Stories
          </Link>
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Edit Story
            </h1>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete Story
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-lg space-y-6">
          {/* Status */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title (English) *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                placeholder="Enter English title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title (Japanese) *
              </label>
              <input
                type="text"
                value={titleJa}
                onChange={(e) => setTitleJa(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                placeholder="Enter Japanese title with furigana"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use ruby tags for furigana: &lt;ruby&gt;漢字&lt;rt&gt;かんじ&lt;/rt&gt;&lt;/ruby&gt;
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              rows={3}
              placeholder="Brief description of the story"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              >
                {STORY_THEMES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                JLPT Level
              </label>
              <select
                value={jlptLevel}
                onChange={(e) => setJlptLevel(e.target.value as JLPTLevel)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
              >
                <option value="N5">N5 (Beginner)</option>
                <option value="N4">N4 (Elementary)</option>
                <option value="N3">N3 (Intermediate)</option>
                <option value="N2">N2 (Upper Intermediate)</option>
                <option value="N1">N1 (Advanced)</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                placeholder="Add a tag"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Pages */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Story Pages
              </h2>
              <button
                onClick={handleAddPage}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <PlusIcon className="w-4 h-4" />
                Add Page
              </button>
            </div>

            <div className="space-y-6">
              {pages.map((page, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Page {index + 1}
                    </h3>
                    {pages.length > 1 && (
                      <button
                        onClick={() => handleRemovePage(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Japanese Text *
                      </label>
                      <textarea
                        value={page.text}
                        onChange={(e) => handlePageChange(index, 'text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                        rows={4}
                        placeholder="Enter Japanese text with ruby tags for furigana"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        English Translation *
                      </label>
                      <textarea
                        value={page.translation}
                        onChange={(e) => handlePageChange(index, 'translation', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                        rows={3}
                        placeholder="Enter English translation"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Image URL (optional)
                      </label>
                      <input
                        type="text"
                        value={page.imageUrl}
                        onChange={(e) => handlePageChange(index, 'imageUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Display */}
          {story && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Story Statistics</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Views:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{story.viewCount}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Completions:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{story.completionCount}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Quiz Questions:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{story.quiz?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => router.push('/admin/stories')}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}