'use client';

import { useState, useEffect } from 'react';
import { BlogPost } from '@/services/blogService';
import { Timestamp } from 'firebase/firestore';
import { useI18n } from '@/i18n/I18nContext';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface BlogEditorProps {
  post?: BlogPost;
  onSave: (post: Partial<BlogPost>) => Promise<void>;
  saving?: boolean;
  onCancel: () => void;
}

export function BlogEditor({ post, onSave, saving = false, onCancel }: BlogEditorProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    author: 'Moshimoshi Team',
    tags: [] as string[],
    status: 'draft' as 'draft' | 'published' | 'scheduled',
    publishDate: new Date().toISOString().split('T')[0],
    publishTime: '09:00',
    seoTitle: '',
    seoDescription: '',
    cover: '',
    ogImage: '',
    canonical: '',
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (post) {
      const publishDate = post.publishDate instanceof Timestamp
        ? post.publishDate.toDate()
        : new Date(post.publishDate);

      setFormData({
        title: post.title || '',
        slug: post.slug || '',
        content: post.content || '',
        excerpt: post.excerpt || '',
        author: post.author || 'Moshimoshi Team',
        tags: post.tags || [],
        status: post.status || 'draft',
        publishDate: publishDate.toISOString().split('T')[0],
        publishTime: publishDate.toTimeString().slice(0, 5),
        seoTitle: post.seoTitle || '',
        seoDescription: post.seoDescription || '',
        cover: post.cover || '',
        ogImage: post.ogImage || '',
        canonical: post.canonical || '',
      });
    }
  }, [post]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Auto-generate slug from title
    if (name === 'title' && !post) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  };

  const handleContentChange = (html: string) => {
    setFormData(prev => ({ ...prev, content: html }));
  };

  const handleCoverChange = (url: string) => {
    setFormData(prev => ({
      ...prev,
      cover: url,
      ogImage: url || prev.ogImage, // Auto-set OG image if not set
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Combine date and time for scheduled posts
    const publishDateTime = new Date(`${formData.publishDate}T${formData.publishTime}`);

    const postData: Partial<BlogPost> = {
      title: formData.title,
      slug: formData.slug,
      content: formData.content,
      excerpt: formData.excerpt,
      author: formData.author,
      tags: formData.tags,
      status: formData.status,
      publishDate: publishDateTime,
      seoTitle: formData.seoTitle || formData.title,
      seoDescription: formData.seoDescription || formData.excerpt,
      cover: formData.cover,
      ogImage: formData.ogImage || formData.cover,
      canonical: formData.canonical,
    };

    await onSave(postData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <label htmlFor="title" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('admin.blog.fields.title') || 'Title'} *
            </label>
            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter post title"
            />
          </div>

          {/* Slug */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <label htmlFor="slug" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('admin.blog.fields.slug') || 'URL Slug'} *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">/blog/</span>
              <input
                id="slug"
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                required
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="url-friendly-slug"
              />
            </div>
          </div>

          {/* Rich Text Editor */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('admin.blog.fields.content') || 'Content'} *
            </label>
            <RichTextEditor
              content={formData.content}
              onChange={handleContentChange}
              placeholder="Start writing your blog post..."
              minHeight="500px"
            />
          </div>

          {/* Excerpt */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <label htmlFor="excerpt" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('admin.blog.fields.excerpt') || 'Excerpt'}
            </label>
            <textarea
              id="excerpt"
              name="excerpt"
              value={formData.excerpt}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Brief description for previews and SEO"
            />
          </div>

          {/* Cover Image */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <ImageUploader
              value={formData.cover}
              onChange={handleCoverChange}
              label={t('admin.blog.fields.coverImage') || 'Cover Image'}
              helpText="This image will be displayed at the top of your blog post. Recommended size: 1920x1080px"
            />
          </div>
        </div>

        {/* Sidebar - Right Column (1/3) */}
        <div className="space-y-6">
          {/* Publishing */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              {t('admin.blog.sections.publishing') || 'Publishing'}
            </h3>

            {/* Status */}
            <div className="mb-4">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.blog.fields.status') || 'Status'}
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="draft">{t('admin.blog.status.draft') || 'Draft'}</option>
                <option value="published">{t('admin.blog.status.published') || 'Published'}</option>
                <option value="scheduled">{t('admin.blog.status.scheduled') || 'Scheduled'}</option>
              </select>
            </div>

            {/* Publish Date */}
            <div className="mb-4">
              <label htmlFor="publishDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.blog.fields.publishDate') || 'Publish Date'}
              </label>
              <input
                id="publishDate"
                type="date"
                name="publishDate"
                value={formData.publishDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Publish Time */}
            <div>
              <label htmlFor="publishTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.blog.fields.publishTime') || 'Publish Time'}
              </label>
              <input
                id="publishTime"
                type="time"
                name="publishTime"
                value={formData.publishTime}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              {t('admin.blog.sections.tags') || 'Tags'}
            </h3>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag"
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm"
              >
                {t('admin.blog.buttons.add') || 'Add'}
              </button>
            </div>

            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-primary-900 dark:hover:text-primary-100"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* SEO */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              {t('admin.blog.sections.seo') || 'SEO'}
            </h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="seoTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.blog.fields.seoTitle') || 'SEO Title'}
                </label>
                <input
                  id="seoTitle"
                  type="text"
                  name="seoTitle"
                  value={formData.seoTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Leave empty to use post title"
                />
              </div>

              <div>
                <label htmlFor="seoDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.blog.fields.seoDescription') || 'SEO Description'}
                </label>
                <textarea
                  id="seoDescription"
                  name="seoDescription"
                  value={formData.seoDescription}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Leave empty to use excerpt"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {t('common.cancel') || 'Cancel'}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          {saving ? (t('common.saving') || 'Saving...') : (post ? (t('admin.blog.buttons.update') || 'Update Post') : (t('admin.blog.buttons.create') || 'Create Post'))}
        </button>
      </div>
    </form>
  );
}
