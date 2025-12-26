'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ResourceFormData, RESOURCE_CATEGORIES } from '@/types/resources';
import { marked } from 'marked';
import { useI18n } from '@/i18n/I18nContext';
import { saveResource } from '@/services/resourceService';

export default function NewResourcePage() {
  const { strings } = useI18n();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState<ResourceFormData>({
    title: '',
    subtitle: '',
    slug: '',
    content: '',
    excerpt: '',
    imageUrl: '',
    imageAlt: '',
    status: 'draft',
    scheduledFor: '',
    tags: [],
    category: '',
    isPremium: false,
    seoTitle: '',
    seoDescription: '',
    featured: false,
    isPillStyle: false
  });

  const [tagInput, setTagInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-generate slug from title
  useEffect(() => {
    if (formData.title && !formData.slug) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.title, formData.slug]);

  // Auto-generate excerpt from content
  useEffect(() => {
    if (formData.content && !formData.excerpt) {
      const plainText = formData.content.replace(/[#*`\[\]]/g, '').trim();
      const excerpt = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
      setFormData(prev => ({ ...prev, excerpt }));
    }
  }, [formData.content, formData.excerpt]);

  const calculateReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      if (!formData.title.trim()) {
        setErrorMessage('Title is required');
        return;
      }

      if (!formData.content.trim()) {
        setErrorMessage('Content is required');
        return;
      }

      const resourceId = await saveResource(formData);

      // Success - redirect
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('resourceSuccessMessage',
          formData.status === 'draft' ? 'Resource created as draft' :
          formData.status === 'published' ? 'Resource published successfully' :
          'Resource scheduled successfully'
        );
      }
      router.push('/admin/resources');
    } catch (error: any) {
      console.error('Error creating resource:', error);

      let errorMsg = 'Failed to create resource. ';
      if (error.message?.includes('slug already exists')) {
        errorMsg = 'This URL slug is already in use. Please choose a different slug.';
      } else if (error.message?.includes('permission')) {
        errorMsg = 'You don\'t have permission to create resources.';
      } else {
        errorMsg += error.message || 'Please try again.';
      }
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ResourceFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingImage(true);

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: uploadFormData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      handleInputChange('imageUrl', data.url);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setErrorMessage('Failed to upload image. ' + (error.message || 'Please try again.'));
    } finally {
      setUploadingImage(false);
    }
  };

  const insertImageToContent = () => {
    if (!formData.imageUrl) return;
    const imageMarkdown = `![${formData.imageAlt || 'Image'}](${formData.imageUrl})`;
    setFormData(prev => ({ ...prev, content: prev.content + '\n\n' + imageMarkdown }));
  };

  const insertCodeBlock = () => {
    const codeBlock = '\n```\n// Your code here\n```\n';
    setFormData(prev => ({ ...prev, content: prev.content + codeBlock }));
  };

  const insertTable = () => {
    const table = '\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n';
    setFormData(prev => ({ ...prev, content: prev.content + table }));
  };

  const readingTime = calculateReadingTime(formData.content);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {strings.admin?.resources?.newResource || 'Create New Resource'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {strings.admin?.resources?.description || 'Create educational resources and study materials'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mb-6">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={() => router.push('/admin/resources')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Basic Information</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter resource title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => handleInputChange('subtitle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional subtitle"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="url-friendly-slug"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  URL: /resources/{formData.slug}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select category</option>
                  {RESOURCE_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Excerpt
              </label>
              <textarea
                value={formData.excerpt}
                onChange={(e) => handleInputChange('excerpt', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                placeholder="Brief description for cards and SEO (auto-generated from content if empty)"
              />
            </div>
          </div>

          {/* Content Editor */}
          <div className="bg-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Content {readingTime > 0 && `(~${readingTime} min read)`}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={insertCodeBlock}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Code Block
                </button>
                <button
                  type="button"
                  onClick={insertTable}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={insertImageToContent}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                  disabled={!formData.imageUrl}
                >
                  Insert Image
                </button>
              </div>
            </div>

            {showPreview ? (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-dark-900 min-h-[400px] prose prose-sm max-w-none dark:prose-invert">
                <div dangerouslySetInnerHTML={{ __html: marked(formData.content) as string }} />
              </div>
            ) : (
              <textarea
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Write your content in Markdown..."
              />
            )}
          </div>

          {/* Image */}
          <div className="bg-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Featured Image</h2>

            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className={`inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 cursor-pointer ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {uploadingImage ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload from Computer
                  </>
                )}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Max file size: 5MB. Supported formats: JPG, PNG, GIF, WebP
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-dark-850 px-2 text-gray-500 dark:text-gray-400">or use URL</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://example.com/image.jpg"
                  disabled={uploadingImage}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Image Alt Text
                </label>
                <input
                  type="text"
                  value={formData.imageAlt}
                  onChange={(e) => handleInputChange('imageAlt', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Descriptive alt text"
                />
              </div>
            </div>

            {formData.imageUrl && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Preview:</p>
                <img
                  src={formData.imageUrl}
                  alt={formData.imageAlt || 'Preview'}
                  className="max-w-xs rounded-lg border border-gray-300 dark:border-gray-600"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="bg-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tags</h2>

            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Add a tag and press Enter"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                Add
              </button>
            </div>

            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1.5 text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Publishing Options */}
          <div className="bg-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Publishing Options</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>

              {formData.status === 'scheduled' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Scheduled For
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledFor}
                    onChange={(e) => handleInputChange('scheduledFor', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => handleInputChange('featured', e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">Featured post</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isPremium}
                  onChange={(e) => handleInputChange('isPremium', e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">Premium content</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isPillStyle}
                  onChange={(e) => handleInputChange('isPillStyle', e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">Pill style display</span>
              </label>
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white dark:bg-dark-850 rounded-lg p-6 border border-gray-200 dark:border-gray-700 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">SEO</h2>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                SEO Title
              </label>
              <input
                type="text"
                value={formData.seoTitle}
                onChange={(e) => handleInputChange('seoTitle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Custom title for search engines (defaults to main title)"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formData.seoTitle.length}/60 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                SEO Description
              </label>
              <textarea
                value={formData.seoDescription}
                onChange={(e) => handleInputChange('seoDescription', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                placeholder="Custom description for search engines (defaults to excerpt)"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formData.seoDescription.length}/160 characters
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push('/admin/resources')}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Resource'}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {errorMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-850 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-line">{errorMessage}</p>
              <button
                onClick={() => setErrorMessage(null)}
                className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
