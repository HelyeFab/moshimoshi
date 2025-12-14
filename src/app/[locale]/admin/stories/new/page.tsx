'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { storyService } from '@/lib/services/StoryService';
import { JLPTLevel } from '@/types/ai-story';
import { STORY_THEMES } from '@/types/story';
import { ChevronLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import Dropdown from '@/components/ui/Dropdown';

interface StoryPage {
  text: string;
  translation: string;
  imageUrl?: string;
}

export default function NewStoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [titleJa, setTitleJa] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState<string>(STORY_THEMES[0]);
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [pages, setPages] = useState<StoryPage[]>([
    { text: '', translation: '', imageUrl: '' }
  ]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddPage = () => {
    setPages([...pages, { text: '', translation: '', imageUrl: '' }]);
  };

  const handleRemovePage = (index: number) => {
    if (pages.length > 1) {
      setPages(pages.filter((_, i) => i !== index));
    }
  };

  const handlePageChange = (index: number, field: keyof StoryPage, value: string) => {
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

  const handleSave = async (status: 'draft' | 'published') => {
    if (!title || !titleJa || !description) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (pages.some(p => !p.text || !p.translation)) {
      showToast('All pages must have Japanese text and translation', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

      const formattedPages = pages.map((page, index) => ({
        pageNumber: index + 1,
        text: page.text,
        translation: page.translation,
        imageUrl: page.imageUrl || '',
        imageAlt: `Page ${index + 1}`,
        vocabularyNotes: {},
        grammarNotes: {}
      }));

      await storyService.saveStory({
        title,
        titleJa,
        description,
        jlptLevel,
        theme,
        tags,
        pages: formattedPages,
        quiz: [],
        authorId: user?.uid || 'admin',
        status,
        viewCount: 0,
        completionCount: 0,
        slug,
        isAIGenerated: false
      });

      showToast(`Story ${status === 'published' ? 'published' : 'saved as draft'} successfully!`, 'success');

      router.push('/admin/stories');
    } catch (error) {
      console.error('Error saving story:', error);
      showToast('Failed to save story', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/stories"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Stories
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create New Story
          </h1>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-dark-700 space-y-6">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
              rows={3}
              placeholder="Brief description of the story"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Dropdown
                label="Theme"
                value={theme}
                onChange={(value) => setTheme(value)}
                options={STORY_THEMES.map(t => ({ value: t, label: t }))}
              />
            </div>

            <div>
              <Dropdown
                label="JLPT Level"
                value={jlptLevel}
                onChange={(value) => setJlptLevel(value as JLPTLevel)}
                options={[
                  { value: 'N5', label: 'N5 (Beginner)' },
                  { value: 'N4', label: 'N4 (Elementary)' },
                  { value: 'N3', label: 'N3 (Intermediate)' },
                  { value: 'N2', label: 'N2 (Upper Intermediate)' },
                  { value: 'N1', label: 'N1 (Advanced)' },
                ]}
              />
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                placeholder="Add a tag"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-200 transition-colors"
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
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Page
              </button>
            </div>

            <div className="space-y-6">
              {pages.map((page, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-dark-800"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Page {index + 1}
                    </h3>
                    {pages.length > 1 && (
                      <button
                        onClick={() => handleRemovePage(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => router.push('/admin/stories')}
              className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSave('draft')}
                disabled={isSaving}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleSave('published')}
                disabled={isSaving}
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Publish Story
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}