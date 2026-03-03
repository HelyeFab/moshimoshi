'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { motion } from 'framer-motion'
import Modal from '@/components/ui/Modal'
import { TemplatePreviewModal } from '@/components/admin/email-templates'
import type { EmailTemplateClient, TemplateStatus, TemplateCategory } from '@/lib/email/templates/types'

type StatusFilter = 'all' | TemplateStatus

interface StarterTemplate {
  id: string
  name: string
  description: string
  subject: string
  html: string
  text: string
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

const statusColors: Record<TemplateStatus, string> = {
  draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  archived: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
}

const categoryLabels: Record<TemplateCategory, string> = {
  marketing: 'Marketing',
  transactional: 'Transactional',
  notification: 'Notification',
  custom: 'Custom',
}

export default function EmailTemplatesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplateClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [templateToPreview, setTemplateToPreview] = useState<EmailTemplateClient | null>(null)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // Starter templates
  const [starterModalOpen, setStarterModalOpen] = useState(false)
  const [starterTemplates, setStarterTemplates] = useState<StarterTemplate[]>([])
  const [loadingStarters, setLoadingStarters] = useState(false)

  useEffect(() => {
    if (user) {
      fetchTemplates()
    }
  }, [user, statusFilter])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = statusFilter === 'all'
        ? '/api/admin/templates'
        : `/api/admin/templates?status=${statusFilter}`

      const response = await fetch(url, {
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch templates')
      }

      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (templateId: string, templateName: string) => {
    setTemplateToDelete({ id: templateId, name: templateName })
    setDeleteModalOpen(true)
  }

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return

    try {
      const response = await fetch(`/api/admin/templates/${templateToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete template')
      }

      setDeleteModalOpen(false)
      setTemplateToDelete(null)
      setSuccessMessage('Template deleted successfully!')
      setSuccessModalOpen(true)
      await fetchTemplates()
    } catch (err) {
      setDeleteModalOpen(false)
      setTemplateToDelete(null)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete template')
      setErrorModalOpen(true)
    }
  }

  const handlePreviewClick = (template: EmailTemplateClient) => {
    setTemplateToPreview(template)
    setPreviewModalOpen(true)
  }

  const handleDuplicate = async (template: EmailTemplateClient) => {
    try {
      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          slug: `${template.slug}-copy-${Date.now()}`,
          description: template.description,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          variables: template.variables,
          category: template.category,
          status: 'draft',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to duplicate template')
      }

      setSuccessMessage('Template duplicated successfully!')
      setSuccessModalOpen(true)
      await fetchTemplates()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to duplicate template')
      setErrorModalOpen(true)
    }
  }

  const handleNewTemplateClick = async () => {
    try {
      setLoadingStarters(true)
      const response = await fetch('/api/admin/templates/starters', {
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch starters')
      }

      setStarterTemplates(data.templates || [])
      setStarterModalOpen(true)
    } catch (err) {
      // If starters fail to load, just navigate to new template
      console.error('Failed to load starters:', err)
      router.push('/admin/email-templates/new/edit')
    } finally {
      setLoadingStarters(false)
    }
  }

  const handleCreateFromStarter = async (starter: StarterTemplate) => {
    try {
      const baseSlug = toKebabCase(starter.id || starter.name || 'template')
      const slug = `${baseSlug}-${Date.now()}`

      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: `${starter.name} - New`,
          slug,
          description: starter.description,
          subject: starter.subject,
          htmlContent: starter.html,
          textContent: starter.text,
          variables: [],
          category: 'marketing',
          status: 'draft',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create template')
      }

      setStarterModalOpen(false)
      const createdTemplateId = data.templateId || data.template?.id
      if (!createdTemplateId) {
        throw new Error('Template created but response did not include templateId')
      }
      router.push(`/admin/email-templates/${createdTemplateId}/edit`)
    } catch (err) {
      setStarterModalOpen(false)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create template')
      setErrorModalOpen(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Email Templates
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create and manage reusable email templates with variable support
            </p>
          </div>
          <button
            onClick={handleNewTemplateClick}
            disabled={loadingStarters}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {loadingStarters ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-xl">+</span>
            )}
            New Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex gap-2">
          {(['all', 'active', 'draft', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          <p className="font-medium">Error loading templates</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Templates Grid */}
      {templates.length === 0 && !error ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No templates yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first email template to get started
          </p>
          <button
            onClick={handleNewTemplateClick}
            disabled={loadingStarters}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {loadingStarters ? 'Loading...' : 'Create Template'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => router.push(`/admin/email-templates/${template.id}/edit`)}
              onPreview={() => handlePreviewClick(template)}
              onDuplicate={() => handleDuplicate(template)}
              onDelete={() => handleDeleteClick(template.id, template.name)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Template"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete{' '}
            <strong>&quot;{templateToDelete?.name}&quot;</strong>?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteTemplate}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
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
            <div className="flex-shrink-0 text-2xl">X</div>
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
            <div className="flex-shrink-0 text-2xl">OK</div>
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
      {templateToPreview && (
        <TemplatePreviewModal
          isOpen={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false)
            setTemplateToPreview(null)
          }}
          templateId={templateToPreview.id}
          templateName={templateToPreview.name}
          customVariables={templateToPreview.variables || []}
        />
      )}

      {/* Starter Template Selection Modal */}
      <Modal
        isOpen={starterModalOpen}
        onClose={() => setStarterModalOpen(false)}
        title="Create New Template"
        size="lg"
      >
        <div className="space-y-6">
          <p className="text-gray-600 dark:text-gray-400">
            Start from scratch or choose a starter template to get going quickly.
          </p>

          {/* Blank Template Option */}
          <button
            onClick={() => {
              setStarterModalOpen(false)
              router.push('/admin/email-templates/new/edit')
            }}
            className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-2xl group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30">
                📝
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Blank Template
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Start from scratch with a clean slate
                </p>
              </div>
            </div>
          </button>

          {/* Starter Templates */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Starter Templates
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
              {starterTemplates.map((starter) => (
                <button
                  key={starter.id}
                  onClick={() => handleCreateFromStarter(starter)}
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 hover:shadow-md transition-all text-left"
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {starter.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {starter.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setStarterModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Template Card Component
 */
function TemplateCard({
  template,
  onEdit,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  template: EmailTemplateClient
  onEdit: () => void
  onPreview: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {template.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
            {template.slug}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[template.status]}`}
        >
          {template.status.toUpperCase()}
        </span>
      </div>

      {template.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {template.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {categoryLabels[template.category]}
        </span>
        <span>Updated {formatDate(template.updatedAt)}</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onEdit}
          className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors text-sm font-medium"
        >
          Edit
        </button>
        <button
          onClick={onPreview}
          className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium"
        >
          Preview
        </button>
        <button
          onClick={onDuplicate}
          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        >
          Duplicate
        </button>
        {template.status !== 'active' && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
          >
            Delete
          </button>
        )}
      </div>
    </motion.div>
  )
}
