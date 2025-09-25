'use client';

import { useState, useEffect } from 'react';
import { BlogPost } from '@/services/blogService';
import { Timestamp } from 'firebase/firestore';
import { useI18n } from '@/i18n/I18nContext';

interface BlogEditorProps {
  post?: BlogPost;
  onSave: (post: Partial<BlogPost>) => Promise<void>;
  saving?: boolean;
  onCancel: () => void;
}

export function BlogEditor({ post, onSave, saving = false, onCancel }: BlogEditorProps) {
  const { t, strings } = useI18n();
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
  const [preview, setPreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'cover' | 'ogImage') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      // For now, we'll just use a placeholder URL
      // TODO: Implement proper image upload service
      const url = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        [field]: url,
      }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(t('admin.blog.errors.imageUploadFailed'));
    } finally {
      setUploadingImage(false);
    }
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
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <label htmlFor="title" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('admin.blog.fields.title')} *
            </label>
            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('admin.blog.placeholders.title')}
            />
          </div>

          {/* Slug */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <label htmlFor="slug" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('admin.blog.fields.slug')} *
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
                placeholder={t('admin.blog.placeholders.slug')}
              />
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="content" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('admin.blog.fields.content')} * (Markdown)
              </label>
              <button
                type="button"
                onClick={() => setPreview(!preview)}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                {preview ? t('admin.blog.buttons.edit') : t('admin.blog.buttons.preview')}
              </button>
            </div>
            {preview ? (
              <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-dark-900 rounded-lg p-4 min-h-[400px]">
                <div dangerouslySetInnerHTML={{
                  __html: formData.content.replace(/\n/g, '<br />')
                }} />
              </div>
            ) : (
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleChange}
                required
                rows={20}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                placeholder={t('admin.blog.placeholders.content')}
              />
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('admin.blog.hints.markdownSupport')}
            </p>
          </div>

          {/* Excerpt */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <label htmlFor="excerpt" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {t('admin.blog.fields.excerpt')}
            </label>
            <textarea
              id="excerpt"
              name="excerpt"
              value={formData.excerpt}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('admin.blog.placeholders.excerpt')}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publishing */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">{t('admin.blog.sections.publishing')}</h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="status" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('admin.blog.fields.status')}
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="draft">{t('admin.blog.status.draft')}</option>
                  <option value="published">{t('admin.blog.status.published')}</option>
                  <option value="scheduled">{t('admin.blog.status.scheduled')}</option>
                </select>
              </div>

              {formData.status === 'scheduled' && (
                <>
                  <div>
                    <label htmlFor="publishDate" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {t('admin.blog.fields.publishDate')}
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
                  <div>
                    <label htmlFor="publishTime" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {t('admin.blog.fields.publishTime')}
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
                </>
              )}

              <div>
                <label htmlFor="author" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('admin.blog.fields.author')}
                </label>
                <input
                  id="author"
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">{t('admin.blog.sections.tags')}</h3>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={t('admin.blog.placeholders.addTag')}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                {t('admin.blog.buttons.add')}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-primary-500 hover:text-primary-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">{t('admin.blog.sections.seo')}</h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="seoTitle" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('admin.blog.fields.seoTitle')}
                </label>
                <input
                  id="seoTitle"
                  type="text"
                  name="seoTitle"
                  value={formData.seoTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={t('admin.blog.placeholders.seoTitle')}
                />
              </div>

              <div>
                <label htmlFor="seoDescription" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('admin.blog.fields.seoDescription')}
                </label>
                <textarea
                  id="seoDescription"
                  name="seoDescription"
                  value={formData.seoDescription}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={t('admin.blog.placeholders.seoDescription')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || uploadingImage}
          className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          {saving ? t('common.saving') : post ? t('admin.blog.buttons.update') : t('admin.blog.buttons.create')}
        </button>
      </div>
    </form>
  );
}