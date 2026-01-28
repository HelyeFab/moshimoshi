'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import Modal from '@/components/ui/Modal'
import { uploadAnnouncementImage, isValidImageUrl } from '@/lib/utils/imageUpload'
import type { Announcement, AnnouncementStatus } from '@/lib/announcements/types'
import { PhotoIcon, LinkIcon, XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { DoshiMascot } from '@/components/ui/DoshiMascot'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { marked } from 'marked'

export default function AnnouncementsPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [announcementToDelete, setAnnouncementToDelete] = useState<{
    id: string
    title: string
  } | null>(null)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null)
  const [analyticsAnnouncement, setAnalyticsAnnouncement] = useState<Announcement | null>(null)

  // Fetch announcements on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchAnnouncements()
    }
  }, [user])

  const fetchAnnouncements = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }

      const response = await fetch('/api/admin/announcements', {
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch announcements')
      }

      setAnnouncements(data.announcements || [])
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load announcements')
      }
      console.error('[Announcements] Fetch error:', err)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const handleCreate = async (data: CreateAnnouncementData) => {
    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to create announcement')
      }

      await fetchAnnouncements()
      setShowModal(false)
      setSuccessMessage('Announcement created successfully!')
      setSuccessModalOpen(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create announcement')
      setErrorModalOpen(true)
      console.error('[Announcements] Create error:', err)
    }
  }

  const handleEdit = async (id: string, data: CreateAnnouncementData) => {
    try {
      const response = await fetch(`/api/admin/announcements/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to update announcement')
      }

      await fetchAnnouncements()
      setEditingAnnouncement(null)
      setSuccessMessage('Announcement updated successfully!')
      setSuccessModalOpen(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update announcement')
      setErrorModalOpen(true)
      console.error('[Announcements] Edit error:', err)
    }
  }

  const handleStatusChange = async (id: string, status: AnnouncementStatus) => {
    try {
      const response = await fetch(`/api/admin/announcements/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to update status')
      }

      await fetchAnnouncements()
      setSuccessMessage(
        status === 'published'
          ? 'Announcement published!'
          : status === 'archived'
            ? 'Announcement archived'
            : status === 'draft'
              ? 'Announcement unpublished'
              : 'Status updated'
      )
      setSuccessModalOpen(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update status')
      setErrorModalOpen(true)
      console.error('[Announcements] Status change error:', err)
    }
  }

  const handleDeleteClick = (id: string, title: string) => {
    setAnnouncementToDelete({ id, title })
    setDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!announcementToDelete) return

    try {
      const response = await fetch(`/api/admin/announcements/${announcementToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to delete announcement')
      }

      setDeleteModalOpen(false)
      setAnnouncementToDelete(null)
      await fetchAnnouncements()
      setSuccessMessage('Announcement deleted')
      setSuccessModalOpen(true)
    } catch (err) {
      setDeleteModalOpen(false)
      setAnnouncementToDelete(null)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete announcement')
      setErrorModalOpen(true)
      console.error('[Announcements] Delete error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Feature Announcements
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage feature announcements shown to users on app load
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Announcement
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => fetchAnnouncements()}
              className="mt-2 text-sm text-red-700 dark:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 p-8 text-center">
            <div className="text-4xl mb-4">📢</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No announcements yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first feature announcement to notify users about new features.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
            >
              Create Announcement
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {announcements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                onEdit={() => setEditingAnnouncement(announcement)}
                onDelete={() => handleDeleteClick(announcement.id, announcement.title)}
                onPublish={() => handleStatusChange(announcement.id, 'published')}
                onUnpublish={() => handleStatusChange(announcement.id, 'draft')}
                onArchive={() => handleStatusChange(announcement.id, 'archived')}
                onPreview={() => setPreviewAnnouncement(announcement)}
                onViewAnalytics={() => setAnalyticsAnnouncement(announcement)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showModal || editingAnnouncement) && (
        <AnnouncementModal
          onClose={() => {
            setShowModal(false)
            setEditingAnnouncement(null)
          }}
          onSave={(data) => {
            if (editingAnnouncement) {
              handleEdit(editingAnnouncement.id, data)
            } else {
              handleCreate(data)
            }
          }}
          announcement={editingAnnouncement}
        />
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setAnnouncementToDelete(null)
        }}
        title="Delete Announcement"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete &quot;{announcementToDelete?.title}&quot;?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setDeleteModalOpen(false)
                setAnnouncementToDelete(null)
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">❌</div>
            <p className="text-gray-700 dark:text-gray-300">{errorMessage}</p>
          </div>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setErrorModalOpen(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Success"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">✅</div>
            <p className="text-gray-700 dark:text-gray-300">{successMessage}</p>
          </div>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setSuccessModalOpen(false)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewAnnouncement && (
          <AnnouncementPreview
            announcement={previewAnnouncement}
            onClose={() => setPreviewAnnouncement(null)}
          />
        )}
      </AnimatePresence>

      {/* Analytics Modal */}
      <AnimatePresence>
        {analyticsAnnouncement && (
          <AnnouncementAnalyticsModal
            announcement={analyticsAnnouncement}
            onClose={() => setAnalyticsAnnouncement(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Announcement Card Component
 */
function AnnouncementCard({
  announcement,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
  onArchive,
  onPreview,
  onViewAnalytics,
}: {
  announcement: Announcement
  onEdit: () => void
  onDelete: () => void
  onPublish: () => void
  onUnpublish: () => void
  onArchive: () => void
  onPreview: () => void
  onViewAnalytics: () => void
}) {
  const [analytics, setAnalytics] = useState<{
    views: number
    dismissals: number
    dismissalRate: number
  } | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const statusColors = {
    draft: 'bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200',
    published: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    archived: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  // Fetch analytics for published/archived announcements
  useEffect(() => {
    if (announcement.status === 'published' || announcement.status === 'archived') {
      const fetchAnalytics = async () => {
        setLoadingAnalytics(true)
        try {
          const response = await fetch(`/api/admin/announcements/analytics/${announcement.id}`, {
            credentials: 'include',
          })

          const data = await response.json()
          if (data.success && data.analytics) {
            setAnalytics({
              views: data.analytics.totalViews,
              dismissals: data.analytics.totalDismissals,
              dismissalRate: data.analytics.dismissalRate,
            })
          }
        } catch (error) {
          console.error('[AnnouncementCard] Failed to fetch analytics:', error)
        } finally {
          setLoadingAnalytics(false)
        }
      }

      fetchAnalytics()
    }
  }, [announcement.id, announcement.status])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700 overflow-hidden"
    >
      {/* Image preview */}
      {announcement.imageUrl && (
        <div className="aspect-video bg-gray-100 dark:bg-dark-700">
          <img
            src={announcement.imageUrl}
            alt={announcement.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4">
        {/* Header with status badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
            {announcement.title}
          </h3>
          <span
            className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[announcement.status]}`}
          >
            {announcement.status.toUpperCase()}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
          {announcement.description}
        </p>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span>Feature: {announcement.featureId}</span>
          <span>Created: {formatDate(announcement.createdAt)}</span>
        </div>

        {/* Analytics - only show for published/archived */}
        {(announcement.status === 'published' || announcement.status === 'archived') && (
          <div className="mb-3 p-2.5 bg-gray-50 dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-600">
            {loadingAnalytics ? (
              <div className="flex items-center justify-center py-1">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Loading analytics...</span>
              </div>
            ) : analytics ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Views
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {analytics.views.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Dismissed
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {analytics.dismissals.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200 dark:border-dark-600">
                  <span className="text-gray-700 dark:text-gray-300">Engagement Rate</span>
                  <span className="font-semibold text-primary-600 dark:text-primary-400">
                    {analytics.dismissalRate.toFixed(1)}%
                  </span>
                </div>
                <button
                  onClick={onViewAnalytics}
                  className="w-full mt-1.5 py-1.5 px-2 bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded transition-colors"
                >
                  View Details
                </button>
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                No analytics data yet
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {/* Preview button - always available */}
          <button
            onClick={onPreview}
            className="w-full py-2 px-3 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </button>

          <div className="flex gap-2">
            {announcement.status === 'draft' && (
              <>
                <button
                  onClick={onEdit}
                  className="flex-1 py-2 px-3 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={onPublish}
                  className="flex-1 py-2 px-3 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Publish
                </button>
                <button
                  onClick={onDelete}
                  className="p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                  aria-label="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </>
            )}
            {announcement.status === 'published' && (
              <>
                <button
                  onClick={onUnpublish}
                  className="flex-1 py-2 px-3 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                >
                  Unpublish
                </button>
                <button
                  onClick={onArchive}
                  className="flex-1 py-2 px-3 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm font-medium rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/30 transition-colors"
                >
                  Archive
                </button>
              </>
            )}
            {announcement.status === 'archived' && (
              <button
                onClick={onPublish}
                className="flex-1 py-2 px-3 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm font-medium rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
              >
                Re-publish
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Create/Edit Announcement Modal
 */
interface CreateAnnouncementData {
  title: string
  content: string
  imageUrl: string
  featureId: string
  status?: AnnouncementStatus
}

function AnnouncementModal({
  onClose,
  onSave,
  announcement,
}: {
  onClose: () => void
  onSave: (data: CreateAnnouncementData) => void
  announcement?: Announcement | null
}) {
  const isEditing = !!announcement
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<CreateAnnouncementData>(() => {
    if (announcement) {
      return {
        title: announcement.title,
        content: announcement.content || announcement.description || '',
        imageUrl: announcement.imageUrl,
        featureId: announcement.featureId,
        status: announcement.status,
      }
    }
    return {
      title: '',
      content: '',
      imageUrl: '',
      featureId: '',
      status: 'draft',
    }
  })

  const [validationError, setValidationError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showMarkdownImport, setShowMarkdownImport] = useState(false)
  const [markdownInput, setMarkdownInput] = useState('')
  const [importError, setImportError] = useState('')

  // Handle markdown import
  const handleImportMarkdown = () => {
    try {
      setImportError('')
      if (!markdownInput.trim()) {
        setImportError('Please paste some markdown content')
        return
      }

      // Convert markdown to HTML
      const htmlContent = marked.parse(markdownInput, {
        gfm: true,
        breaks: true,
      }) as string

      setFormData((prev) => ({ ...prev, content: htmlContent }))
      setMarkdownInput('')
      setShowMarkdownImport(false)
    } catch (err) {
      setImportError('Failed to parse markdown')
      console.error('Markdown parse error:', err)
    }
  }

  // Handle content change from rich text editor
  const handleContentChange = (html: string) => {
    setFormData((prev) => ({ ...prev, content: html }))
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setUploading(true)

    try {
      const url = await uploadAnnouncementImage(file)
      setFormData((prev) => ({ ...prev, imageUrl: url }))
    } catch (err: any) {
      console.error('Upload error:', err)
      setUploadError(err.message || 'Failed to upload image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleUrlSubmit = () => {
    setUploadError(null)

    if (!urlInput.trim()) {
      setUploadError('Please enter a URL')
      return
    }

    if (!isValidImageUrl(urlInput)) {
      setUploadError('Please enter a valid image URL')
      return
    }

    setFormData((prev) => ({ ...prev, imageUrl: urlInput.trim() }))
    setUrlInput('')
    setShowUrlInput(false)
  }

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: '' }))
    setUploadError(null)
  }

  const handleSubmit = async () => {
    setValidationError(null)

    if (!formData.title.trim()) {
      setValidationError('Title is required')
      return
    }

    if (!formData.content.trim()) {
      setValidationError('Content is required')
      return
    }

    if (!formData.featureId.trim()) {
      setValidationError('Feature ID is required')
      return
    }

    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-dark-800 rounded-t-2xl md:rounded-xl w-full md:max-w-xl max-h-[90vh] flex flex-col"
      >
        {/* Mobile drag indicator */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-dark-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          {validationError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., New Kanji Learning Mode"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              maxLength={200}
            />
          </div>

          {/* Content Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Content *
              </label>
              <button
                type="button"
                onClick={() => setShowMarkdownImport(true)}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1"
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                Import Markdown
              </button>
            </div>

            <RichTextEditor
              content={formData.content}
              onChange={handleContentChange}
              placeholder="Write your announcement content..."
              minHeight="200px"
            />
          </div>

          {/* Markdown Import Modal */}
          {showMarkdownImport && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
              <div className="bg-white dark:bg-dark-800 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Import Markdown
                  </h3>
                  <button
                    onClick={() => {
                      setShowMarkdownImport(false)
                      setMarkdownInput('')
                      setImportError('')
                    }}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                  {importError && (
                    <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>
                    </div>
                  )}
                  <textarea
                    value={markdownInput}
                    onChange={(e) => setMarkdownInput(e.target.value)}
                    placeholder="Paste your markdown content here..."
                    className="w-full h-64 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Supports GitHub Flavored Markdown (headings, lists, bold, italic, links, etc.)
                  </p>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
                  <button
                    onClick={() => {
                      setShowMarkdownImport(false)
                      setMarkdownInput('')
                      setImportError('')
                    }}
                    className="flex-1 py-2 px-4 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportMarkdown}
                    className="flex-1 py-2 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feature ID */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Feature ID *
            </label>
            <input
              type="text"
              value={formData.featureId}
              onChange={(e) => setFormData((prev) => ({ ...prev, featureId: e.target.value }))}
              placeholder="e.g., kanji-mastery-v2"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              maxLength={100}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              A unique identifier for tracking this feature announcement
            </p>
          </div>

          {/* Image Upload */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Image (Optional)
            </label>

            {/* Preview */}
            {formData.imageUrl && (
              <div className="relative group">
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove image"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Upload Options */}
            {!formData.imageUrl && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors disabled:opacity-50"
                >
                  <PhotoIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {uploading ? 'Uploading...' : 'Upload from computer'}
                  </span>
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-dark-800 text-gray-500">or</span>
                  </div>
                </div>

                {!showUrlInput ? (
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
                  >
                    <LinkIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Use image URL</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && (e.preventDefault(), handleUrlSubmit())
                      }
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 px-3 py-2 bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={handleUrlSubmit}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUrlInput(false)
                        setUrlInput('')
                        setUploadError(null)
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                <span>Optimizing and uploading image...</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="flex-1 py-2.5 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Create'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Sparkle component for decoration (matching user-facing overlay)
 */
function PreviewSparkle({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        delay,
        ease: 'easeInOut',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 0L12.5 7.5L20 10L12.5 12.5L10 20L7.5 12.5L0 10L7.5 7.5L10 0Z" />
      </svg>
    </motion.div>
  )
}

/**
 * Announcement Preview Component
 * Shows exactly how the announcement will appear to users
 */
function AnnouncementPreview({
  announcement,
  onClose,
}: {
  announcement: Announcement
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      {/* Admin badge */}
      <div className="absolute top-4 left-4 px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-full flex items-center gap-2 z-10">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Preview Mode
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
        aria-label="Close preview"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      {/* Floating sparkles decoration */}
      <PreviewSparkle className="absolute top-[15%] left-[20%] text-yellow-400" delay={0} />
      <PreviewSparkle className="absolute top-[25%] right-[15%] text-primary-400" delay={0.5} />
      <PreviewSparkle className="absolute bottom-[30%] left-[15%] text-pink-400" delay={1} />
      <PreviewSparkle className="absolute bottom-[20%] right-[20%] text-yellow-400" delay={1.5} />

      {/* Content card - exactly like user-facing overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-dark-800 rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-gray-200/50 dark:border-dark-600/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {/* Gradient header decoration */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-primary-500/20 via-pink-500/10 to-yellow-500/20 dark:from-primary-500/10 dark:via-pink-500/5 dark:to-yellow-500/10 pointer-events-none" />

        {/* NEW badge - positioned at top right of card */}
        <motion.div
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: -12 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 400 }}
          className="absolute top-4 right-4 px-3 py-1 bg-gradient-to-r from-primary-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg z-10"
        >
          NEW!
        </motion.div>

        {/* Doshi mascot - positioned at top */}
        <div className="relative flex justify-center pt-6">
          <motion.div
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <DoshiMascot size="large" variant="animated" mood="excited" />
          </motion.div>
        </div>

        {/* Image (if provided) */}
        {announcement.imageUrl && (
          <div className="relative mx-4 mt-4 rounded-xl overflow-hidden shadow-lg">
            <img
              src={announcement.imageUrl}
              alt=""
              className="w-full aspect-video object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="relative p-6 pt-4">
          {/* Title with gradient accent */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
            {announcement.title}
          </h2>

          {/* HTML Content */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none mb-6 text-center [&>*]:text-gray-600 [&>*]:dark:text-gray-400 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-gray-800 [&_h1]:dark:text-gray-200 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-800 [&_h2]:dark:text-gray-200 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:dark:text-gray-200 [&_ul]:text-left [&_ol]:text-left"
            dangerouslySetInnerHTML={{ __html: announcement.content || announcement.description || '' }}
          />

          {/* Got it button with gradient */}
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2"
          >
            <span>Got it</span>
            <span className="text-lg">✨</span>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Announcement Analytics Modal
 * Shows detailed analytics for an announcement
 */
function AnnouncementAnalyticsModal({
  announcement,
  onClose,
}: {
  announcement: Announcement
  onClose: () => void
}) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/admin/announcements/analytics/${announcement.id}`, {
          credentials: 'include',
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || 'Failed to fetch analytics')
        }

        setAnalytics(data.analytics)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
        console.error('[AnnouncementAnalyticsModal] Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [announcement.id])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-gray-200/50 dark:border-dark-600/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Analytics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-1">
              {announcement.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading analytics...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
              <button
                onClick={onClose}
                className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
              >
                Close
              </button>
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Views</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {analytics.totalViews.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {analytics.uniqueViewers.toLocaleString()} unique viewers
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">Total Dismissals</span>
                  </div>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                    {analytics.totalDismissals.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {analytics.dismissalRate.toFixed(1)}% engagement rate
                  </p>
                </div>
              </div>

              {/* Engagement Rate Card */}
              <div className="bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 p-5 rounded-xl border border-primary-200 dark:border-primary-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Engagement Rate</h3>
                  <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {analytics.dismissalRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(analytics.dismissalRate, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Percentage of viewers who dismissed the announcement
                </p>
              </div>

              {/* Breakdown by User Type */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Breakdown by User Type
                </h3>

                {/* Views Breakdown */}
                <div className="bg-gray-50 dark:bg-dark-900 p-4 rounded-lg border border-gray-200 dark:border-dark-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Views</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {analytics.totalViews.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">🔐 Authenticated Users</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {analytics.viewsByType.authenticated.toLocaleString()}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          ({analytics.totalViews > 0 ? Math.round((analytics.viewsByType.authenticated / analytics.totalViews) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">👤 Guest Users</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {analytics.viewsByType.guest.toLocaleString()}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          ({analytics.totalViews > 0 ? Math.round((analytics.viewsByType.guest / analytics.totalViews) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dismissals Breakdown */}
                <div className="bg-gray-50 dark:bg-dark-900 p-4 rounded-lg border border-gray-200 dark:border-dark-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dismissals</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {analytics.totalDismissals.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">🔐 Authenticated Users</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {analytics.dismissalsByType.authenticated.toLocaleString()}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          ({analytics.totalDismissals > 0 ? Math.round((analytics.dismissalsByType.authenticated / analytics.totalDismissals) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">👤 Guest Users</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {analytics.dismissalsByType.guest.toLocaleString()}
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          ({analytics.totalDismissals > 0 ? Math.round((analytics.dismissalsByType.guest / analytics.totalDismissals) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">About Analytics</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Analytics are tracked in real-time. Each unique viewer is counted once per announcement.
                      Engagement rate shows the percentage of viewers who dismissed the announcement after viewing it.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-gray-600 dark:text-gray-400">No analytics data available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
