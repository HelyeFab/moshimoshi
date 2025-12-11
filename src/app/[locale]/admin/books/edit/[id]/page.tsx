'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Book, JLPTLevel } from '@/types/book'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { useToast } from '@/components/ui/Toast/ToastContext'
import {
  ArrowLeftIcon,
  CheckIcon,
  PhotoIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { uploadBookCoverImage } from '@/lib/utils/imageUpload'

export default function EditBookPage() {
  const router = useRouter()
  const params = useParams()
  const bookId = params.id as string
  const { user, loading: sessionLoading } = useAuth()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [book, setBook] = useState<Partial<Book> | null>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [titleJa, setTitleJa] = useState('')
  const [bookName, setBookName] = useState('')
  const [author, setAuthor] = useState('')
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5')
  const [summary, setSummary] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [category, setCategory] = useState('')

  // Cover image handling
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isGeneratingCover, setIsGeneratingCover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/')
    }
  }, [user, sessionLoading, router])

  // Load book data
  useEffect(() => {
    if (!user?.isAdmin) return

    const loadBook = async () => {
      try {
        setLoading(true)

        // Try drafts first, then books
        let response = await fetch(`/api/admin/books/drafts?bookId=${bookId}`)
        let data = await response.json()

        if (!data.draft) {
          // Try published books
          response = await fetch(`/api/admin/books?bookId=${bookId}`)
          data = await response.json()
        }

        const bookData = data.draft || data.book

        if (!bookData) {
          showToast('Book not found', 'error')
          router.push('/admin/books')
          return
        }

        setBook(bookData)
        setTitle(bookData.title || '')
        setTitleJa(bookData.titleJa || '')
        setBookName(bookData.bookName || '')
        setAuthor(bookData.author || '')
        setJlptLevel(bookData.jlptLevel || 'N5')
        setSummary(bookData.summary || '')
        setCoverImageUrl(bookData.coverImageUrl || '')
        setCategory(bookData.category || '')
      } catch (error) {
        console.error('Error loading book:', error)
        showToast('Failed to load book', 'error')
        router.push('/admin/books')
      } finally {
        setLoading(false)
      }
    }

    loadBook()
  }, [bookId, user, router, showToast])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !titleJa.trim() || !bookName.trim()) {
      showToast('Please fill in required fields', 'error')
      return
    }

    try {
      setSaving(true)

      const updates: any = {
        title: title.trim(),
        titleJa: titleJa.trim(),
        bookName: bookName.trim(),
        jlptLevel,
        summary: summary.trim(),
      }

      // Only add optional fields if they have values
      if (author.trim()) updates.author = author.trim()
      if (coverImageUrl.trim()) updates.coverImageUrl = coverImageUrl.trim()
      if (category.trim()) updates.category = category.trim()

      const response = await fetch('/api/admin/books/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          bookId,
          updates,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update book')
      }

      showToast('Book updated successfully!', 'success')
      router.push('/admin/books')
    } catch (error) {
      console.error('Error saving book:', error)
      showToast('Failed to save changes', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle cover image file upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image must be less than 10MB', 'error')
      return
    }

    setIsUploadingCover(true)
    try {
      const uploadedUrl = await uploadBookCoverImage(file)
      setCoverImageUrl(uploadedUrl)
      showToast('Cover image uploaded successfully!', 'success')
    } catch (error) {
      console.error('Error uploading cover:', error)
      showToast('Failed to upload cover image', 'error')
    } finally {
      setIsUploadingCover(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle AI cover generation
  const handleGenerateCover = async () => {
    if (!bookName || !titleJa) {
      showToast('Book name and Japanese title are required for AI cover generation', 'error')
      return
    }

    setIsGeneratingCover(true)
    try {
      const response = await fetch('/api/admin/books/generate-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          bookId,
          bookName,
          titleJa,
          category,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate cover')
      }

      const data = await response.json()
      if (data.coverImageUrl) {
        setCoverImageUrl(data.coverImageUrl)
        showToast('AI cover generated successfully!', 'success')
      }
    } catch (error) {
      console.error('Error generating cover:', error)
      showToast(error instanceof Error ? error.message : 'Failed to generate cover', 'error')
    } finally {
      setIsGeneratingCover(false)
    }
  }

  // Handle cover removal
  const handleRemoveCover = () => {
    setCoverImageUrl('')
  }

  if (sessionLoading || loading) {
    return <LoadingOverlay />
  }

  if (!user || !user.isAdmin || !book) {
    return null
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/books"
          className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-4 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Library Books
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">✏️ Edit Book</h1>
        <p className="text-gray-600 dark:text-gray-400">Update book information and settings</p>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-dark-850 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-dark-700 space-y-6">
          {/* Status Badge */}
          <div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                book.status === 'published'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}
            >
              {book.status}
            </span>
          </div>

          {/* English Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              English Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Japanese Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Japanese Title *
            </label>
            <input
              type="text"
              value={titleJa}
              onChange={e => setTitleJa(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Book Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Original Book Name *
            </label>
            <input
              type="text"
              value={bookName}
              onChange={e => setBookName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="e.g., The Little Prince"
              required
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="e.g., Antoine de Saint-Exupéry"
            />
          </div>

          {/* JLPT Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              JLPT Level *
            </label>
            <select
              value={jlptLevel}
              onChange={e => setJlptLevel(e.target.value as JLPTLevel)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
            >
              <option value="N5">N5 (Beginner)</option>
              <option value="N4">N4 (Elementary)</option>
              <option value="N3">N3 (Intermediate)</option>
              <option value="N2">N2 (Advanced)</option>
              <option value="N1">N1 (Expert)</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="e.g., Fiction, Self-help, etc."
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Summary
            </label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
              placeholder="Brief summary in English"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Cover Image
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />

            {coverImageUrl ? (
              /* Cover Image Preview */
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="h-48 w-auto rounded-lg shadow-md border border-gray-200 dark:border-dark-600"
                    onError={e => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                    title="Remove cover"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingCover}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                  >
                    Change image
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    type="button"
                    onClick={handleGenerateCover}
                    disabled={isGeneratingCover}
                    className="text-sm text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
                  >
                    {isGeneratingCover ? 'Generating...' : 'Regenerate with AI'}
                  </button>
                </div>
              </div>
            ) : (
              /* No Cover - Upload Options */
              <div className="space-y-3">
                <div className="flex gap-3">
                  {/* Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingCover}
                    className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors disabled:opacity-50"
                  >
                    {isUploadingCover ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                    ) : (
                      <PhotoIcon className="w-8 h-8 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {isUploadingCover ? 'Uploading...' : 'Upload Image'}
                    </span>
                  </button>

                  {/* AI Generate Button */}
                  <button
                    type="button"
                    onClick={handleGenerateCover}
                    disabled={isGeneratingCover || !bookName}
                    className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-500 transition-colors disabled:opacity-50 bg-purple-50 dark:bg-purple-900/10"
                  >
                    {isGeneratingCover ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
                    ) : (
                      <SparklesIcon className="w-8 h-8 text-purple-400" />
                    )}
                    <span className="text-sm text-purple-600 dark:text-purple-400">
                      {isGeneratingCover ? 'Generating...' : 'Generate with AI'}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Upload an image (PNG, JPG, WebP up to 10MB) or generate one using AI (DALL-E 3)
                </p>
              </div>
            )}
          </div>

          {/* Note about content */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> To edit the book content itself, you'll need to regenerate it
              using the Generate Book Summary page.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Link
            href="/admin/books"
            className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
