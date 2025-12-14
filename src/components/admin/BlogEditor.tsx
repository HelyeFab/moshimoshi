'use client'

import { useState, useEffect } from 'react'
import { BlogPost } from '@/services/blogService'
import { Timestamp } from 'firebase/firestore'
import { useI18n } from '@/i18n/I18nContext'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import Dropdown from '@/components/ui/Dropdown'
import matter from 'gray-matter'
import { marked } from 'marked'

interface BlogEditorProps {
  post?: BlogPost
  onSave: (post: Partial<BlogPost>) => Promise<void>
  saving?: boolean
  onCancel: () => void
}

export function BlogEditor({ post, onSave, saving = false, onCancel }: BlogEditorProps) {
  const { t } = useI18n()
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
    isFeatured: false,
  })

  const [tagInput, setTagInput] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [markdownInput, setMarkdownInput] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    if (post) {
      let publishDate: Date

      if (post.publishDate instanceof Timestamp) {
        publishDate = post.publishDate.toDate()
      } else if (post.publishDate) {
        publishDate = new Date(post.publishDate)
      } else {
        publishDate = new Date()
      }

      // Validate the date - if invalid, use current date
      if (isNaN(publishDate.getTime())) {
        publishDate = new Date()
      }

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
        isFeatured: post.isFeatured || false,
      })
    }
  }, [post])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))

    // Auto-generate slug from title
    if (name === 'title' && !post) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  const handleContentChange = (html: string) => {
    setFormData(prev => ({ ...prev, content: html }))
  }

  const handleCoverChange = (url: string) => {
    setFormData(prev => ({
      ...prev,
      cover: url,
      ogImage: url || prev.ogImage, // Auto-set OG image if not set
    }))
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }))
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }))
  }

  const handleImportMarkdown = async () => {
    try {
      setImportError('')

      // Parse frontmatter
      const { data: frontmatter, content } = matter(markdownInput)

      // Configure marked with table support
      const markedOptions = {
        gfm: true, // GitHub Flavored Markdown
        tables: true,
        breaks: true,
        pedantic: false,
        sanitize: false,
        smartLists: true,
        smartypants: false,
      }

      // Convert markdown to HTML (sync mode - using marked.parse to ensure string return)
      const htmlContent = marked.parse(content, markedOptions) as string

      // Debug: Log the converted HTML to see if tables are preserved
      console.log('Converted HTML:', htmlContent)
      console.log('Original markdown content:', content)

      // Parse publish date
      let publishDateTime = new Date()
      if (frontmatter.date) {
        publishDateTime = new Date(frontmatter.date)
      }

      // Map frontmatter to form data
      setFormData({
        title: frontmatter.title || '',
        slug: frontmatter.slug || '',
        content: htmlContent,
        excerpt: frontmatter.excerpt || '',
        author: frontmatter.author || 'Moshimoshi Team',
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        status: (frontmatter.status as 'draft' | 'published' | 'scheduled') || 'draft',
        publishDate: publishDateTime.toISOString().split('T')[0],
        publishTime: publishDateTime.toTimeString().slice(0, 5),
        seoTitle: frontmatter.seo?.title || frontmatter.seoTitle || '',
        seoDescription: frontmatter.seo?.description || frontmatter.seoDescription || '',
        cover: frontmatter.cover_image || frontmatter.cover || '',
        ogImage:
          frontmatter.og_image ||
          frontmatter.ogImage ||
          frontmatter.cover_image ||
          frontmatter.cover ||
          '',
        canonical: frontmatter.canonical || '',
        isFeatured: frontmatter.isFeatured || frontmatter.featured || false,
      })

      // Close modal and clear input
      setShowImportModal(false)
      setMarkdownInput('')
    } catch (error) {
      console.error('Error parsing markdown:', error)
      setImportError('Failed to parse markdown. Please check the format and try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Combine date and time for scheduled posts
    const publishDateTime = new Date(`${formData.publishDate}T${formData.publishTime}`)

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
      isFeatured: formData.isFeatured,
    }

    await onSave(postData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-dark-850 rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-y-auto scrollbar-hide">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Import from Markdown
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Paste your markdown with frontmatter below
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false)
                  setMarkdownInput('')
                  setImportError('')
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {importError && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
                {importError}
              </div>
            )}

            <textarea
              value={markdownInput}
              onChange={e => setMarkdownInput(e.target.value)}
              placeholder="---&#10;title: Your Blog Title&#10;slug: your-blog-slug&#10;date: 2025-10-04&#10;tags:&#10;  - Tag1&#10;  - Tag2&#10;excerpt: Your excerpt here&#10;cover_image: /path/to/image.jpg&#10;seo:&#10;  title: SEO Title&#10;  description: SEO Description&#10;---&#10;&#10;# Your Content Here&#10;&#10;Write your blog post content...&#10;&#10;| Column 1 | Column 2 | Column 3 |&#10;|----------|----------|----------|&#10;| Data 1   | Data 2   | Data 3   |&#10;| Data 4   | Data 5   | Data 6   |"
              className="w-full h-64 sm:h-96 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />

            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false)
                  setMarkdownInput('')
                  setImportError('')
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportMarkdown}
                disabled={!markdownInput.trim()}
                className="w-full sm:w-auto px-6 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        >
          <DocumentArrowDownIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Import from Markdown</span>
          <span className="sm:hidden">Import</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6">
        {/* Main Content - Takes more space on xl screens */}
        <div className="xl:col-span-8 space-y-4 md:space-y-6">
          {/* Title */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
            >
              Title *
            </label>
            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base md:text-sm break-words"
              placeholder="Enter post title"
            />
          </div>

          {/* Slug */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
            >
              URL Slug *
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400 text-sm sm:text-base whitespace-nowrap">
                /blog/
              </span>
              <input
                id="slug"
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                required
                className="flex-1 min-w-0 px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base md:text-sm break-all"
                placeholder="url-friendly-slug"
              />
            </div>
          </div>

          {/* Rich Text Editor */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Content *
            </label>
            <RichTextEditor
              content={formData.content}
              onChange={handleContentChange}
              placeholder="Start writing your blog post..."
              minHeight="600px"
            />
          </div>

          {/* Excerpt */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <label
              htmlFor="excerpt"
              className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
            >
              Excerpt
            </label>
            <textarea
              id="excerpt"
              name="excerpt"
              value={formData.excerpt}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base md:text-sm resize-y"
              placeholder="Brief description for previews and SEO"
            />
          </div>

          {/* Cover Image */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <ImageUploader
              value={formData.cover}
              onChange={handleCoverChange}
              label="Cover Image"
              helpText="This image will be displayed at the top of your blog post. Recommended size: 1920x1080px"
            />
          </div>
        </div>

        {/* Sidebar - Takes less space on xl screens */}
        <div className="xl:col-span-4 space-y-4 md:space-y-6">
          {/* Publishing */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              Publishing
            </h3>

            {/* Author */}
            <div className="mb-4">
              <label
                htmlFor="author"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Author
              </label>
              <input
                id="author"
                type="text"
                name="author"
                value={formData.author}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Moshimoshi Team"
              />
            </div>

            {/* Status */}
            <div className="mb-4">
              <Dropdown
                label="Status"
                value={formData.status}
                onChange={(value) => setFormData(prev => ({ ...prev, status: value as 'draft' | 'published' | 'scheduled' }))}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                  { value: 'scheduled', label: 'Scheduled' },
                ]}
              />
            </div>

            {/* Publish Date */}
            <div className="mb-4">
              <label
                htmlFor="publishDate"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Publish Date
              </label>
              <input
                id="publishDate"
                type="date"
                name="publishDate"
                value={formData.publishDate}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Publish Time */}
            <div className="mb-4">
              <label
                htmlFor="publishTime"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Publish Time
              </label>
              <input
                id="publishTime"
                type="time"
                name="publishTime"
                value={formData.publishTime}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Featured Post Checkbox */}
            <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <input
                id="isFeatured"
                type="checkbox"
                name="isFeatured"
                checked={formData.isFeatured}
                onChange={e => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                className="w-5 h-5 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
              />
              <label
                htmlFor="isFeatured"
                className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer flex-1"
              >
                ⭐ Feature this post
                <span className="block text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  Show as hero post on blog homepage
                </span>
              </label>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              {t('admin.blog.sections.tags') || 'Tags'}
            </h3>

            <div className="space-y-3">
              <div className="flex gap-2 items-stretch">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add a tag"
                  className="flex-1 min-w-0 px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="flex-shrink-0 px-3 sm:px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  Add
                </button>
              </div>

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-primary-900 dark:hover:text-primary-100 transition-colors"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              {t('admin.blog.sections.seo') || 'SEO'}
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="seoTitle"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {t('admin.blog.fields.seoTitle') || 'SEO Title'}
                </label>
                <input
                  id="seoTitle"
                  type="text"
                  name="seoTitle"
                  value={formData.seoTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Leave empty to use post title"
                />
              </div>

              <div>
                <label
                  htmlFor="seoDescription"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {t('admin.blog.fields.seoDescription') || 'SEO Description'}
                </label>
                <textarea
                  id="seoDescription"
                  name="seoDescription"
                  value={formData.seoDescription}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                  placeholder="Leave empty to use excerpt"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-gray-50 dark:bg-dark-900 pb-4 -mx-2 sm:-mx-4 lg:-mx-6 px-2 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 font-medium"
        >
          {t('common.cancel') || 'Cancel'}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 font-medium"
        >
          {saving
            ? t('common.saving') || 'Saving...'
            : post
              ? t('admin.blog.buttons.update') || 'Update Post'
              : t('admin.blog.buttons.create') || 'Create Post'}
        </button>
      </div>
    </form>
  )
}
