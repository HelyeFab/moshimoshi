'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { motion } from 'framer-motion'
import Modal from '@/components/ui/Modal'
import { TemplateEditor, TemplatePreviewModal } from '@/components/admin/email-templates'
import { VariableInsertButton } from '@/components/admin/email-templates/VariableInsertButton'
import { generatePlainText } from '@/lib/email/templates/variables'
import type {
  EmailTemplateClient,
  TemplateVariable,
  TemplateCategory,
  TemplateStatus,
  VariableType,
} from '@/lib/email/templates/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditTemplatePage({ params }: PageProps) {
  const { id: templateId } = use(params)
  const isNew = templateId === 'new'
  const { user } = useAuth()
  const router = useRouter()

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('<p>Hello {{name}},</p><p>Your email content here...</p>')
  const [textContent, setTextContent] = useState('Hello {{name}},\n\nYour email content here...')
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [category, setCategory] = useState<TemplateCategory>('marketing')
  const [status, setStatus] = useState<TemplateStatus>('draft')

  // UI state
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Variable editor state
  const [editingVariable, setEditingVariable] = useState<TemplateVariable | null>(null)
  const [variableModalOpen, setVariableModalOpen] = useState(false)

  // Fetch template if editing
  useEffect(() => {
    if (!isNew && user) {
      fetchTemplate()
    }
  }, [isNew, user, templateId])

  const fetchTemplate = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/templates/${templateId}`, {
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch template')
      }

      const template = data.template as EmailTemplateClient
      setName(template.name)
      setSlug(template.slug)
      setDescription(template.description || '')
      setSubject(template.subject)
      setHtmlContent(template.htmlContent)
      setTextContent(template.textContent)
      setVariables(template.variables || [])
      setCategory(template.category)
      setStatus(template.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setErrorMessage('Template name is required')
      setErrorModalOpen(true)
      return
    }
    if (!slug.trim()) {
      setErrorMessage('Slug is required')
      setErrorModalOpen(true)
      return
    }
    if (!subject.trim()) {
      setErrorMessage('Subject is required')
      setErrorModalOpen(true)
      return
    }
    if (!htmlContent.trim()) {
      setErrorMessage('HTML content is required')
      setErrorModalOpen(true)
      return
    }
    if (!textContent.trim()) {
      setErrorMessage('Plain text content is required')
      setErrorModalOpen(true)
      return
    }

    try {
      setSaving(true)

      const body = {
        name,
        slug,
        description,
        subject,
        htmlContent,
        textContent,
        variables,
        category,
        status,
      }

      const response = await fetch(
        isNew ? '/api/admin/templates' : `/api/admin/templates/${templateId}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to save template')
      }

      setSuccessMessage(isNew ? 'Template created successfully!' : 'Template saved successfully!')
      setSuccessModalOpen(true)

      if (isNew && data.templateId) {
        // Redirect to edit page of new template
        setTimeout(() => {
          router.push(`/admin/email-templates/${data.templateId}/edit`)
        }, 1000)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save template')
      setErrorModalOpen(true)
    } finally {
      setSaving(false)
    }
  }

  const handleGeneratePlainText = () => {
    const generated = generatePlainText(htmlContent)
    setTextContent(generated)
  }

  const handleAddVariable = () => {
    setEditingVariable({
      name: '',
      label: '',
      type: 'string',
      defaultValue: '',
      required: false,
    })
    setVariableModalOpen(true)
  }

  const handleEditVariable = (variable: TemplateVariable) => {
    setEditingVariable({ ...variable })
    setVariableModalOpen(true)
  }

  const handleSaveVariable = () => {
    if (!editingVariable) return

    if (!editingVariable.name.trim() || !editingVariable.label.trim()) {
      setErrorMessage('Variable name and label are required')
      setErrorModalOpen(true)
      return
    }

    if (!/^\w+$/.test(editingVariable.name)) {
      setErrorMessage('Variable name must be alphanumeric with underscores only')
      setErrorModalOpen(true)
      return
    }

    const existingIndex = variables.findIndex((v) => v.name === editingVariable.name)
    if (existingIndex >= 0) {
      // Update existing
      const newVariables = [...variables]
      newVariables[existingIndex] = editingVariable
      setVariables(newVariables)
    } else {
      // Add new
      setVariables([...variables, editingVariable])
    }

    setVariableModalOpen(false)
    setEditingVariable(null)
  }

  const handleDeleteVariable = (variableName: string) => {
    setVariables(variables.filter((v) => v.name !== variableName))
  }

  const handleInsertVariableInSubject = (variableText: string) => {
    setSubject((prev) => prev + variableText)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading template...</p>
        </div>
      </div>
    )
  }

  if (error && !isNew) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">Error</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load template
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/admin/email-templates')}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Back to Templates
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/admin/email-templates')}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2 flex items-center gap-1"
            >
              &larr; Back to Templates
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isNew ? 'Create Template' : 'Edit Template'}
            </h1>
          </div>
          <div className="flex gap-3">
            {!isNew && (
              <button
                onClick={() => setPreviewModalOpen(true)}
                className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors font-medium"
              >
                Preview
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Form Sections */}
      <div className="space-y-8">
        {/* Section 1: Basic Info */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Welcome Series - Day 1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Slug *
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="e.g., welcome-day-1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this template's purpose..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="marketing">Marketing</option>
                <option value="transactional">Transactional</option>
                <option value="notification">Notification</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TemplateStatus)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </motion.section>

        {/* Section 2: Subject Line */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Subject Line
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Welcome to Moshimoshi, {{name}}!"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <VariableInsertButton
              customVariables={variables}
              onInsert={handleInsertVariableInSubject}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            You can use variables like {'{{name}}'} in the subject line
          </p>
        </motion.section>

        {/* Section 3: Content Editor */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Email Content
            </h2>
            <button
              onClick={handleGeneratePlainText}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Generate Plain Text from HTML
            </button>
          </div>
          <TemplateEditor
            htmlContent={htmlContent}
            textContent={textContent}
            onHtmlChange={setHtmlContent}
            onTextChange={setTextContent}
            customVariables={variables}
            minHeight="350px"
          />
        </motion.section>

        {/* Section 4: Variables Manager */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Custom Variables
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Define custom variables that can be used in this template
              </p>
            </div>
            <button
              onClick={handleAddVariable}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium text-sm"
            >
              + Add Variable
            </button>
          </div>

          {variables.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">
                No custom variables defined yet
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                System variables (email, name, etc.) are always available
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {variables.map((variable) => (
                <div
                  key={variable.name}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-green-600 dark:text-green-400">
                      {`{{${variable.name}}}`}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">{variable.label}</span>
                    <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {variable.type}
                    </span>
                    {variable.required && (
                      <span className="text-xs text-red-500">Required</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditVariable(variable)}
                      className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteVariable(variable.name)}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* Variable Edit Modal */}
      <Modal
        isOpen={variableModalOpen}
        onClose={() => {
          setVariableModalOpen(false)
          setEditingVariable(null)
        }}
        title={editingVariable?.name ? 'Edit Variable' : 'Add Variable'}
        size="md"
      >
        {editingVariable && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Variable Name *
              </label>
              <input
                type="text"
                value={editingVariable.name}
                onChange={(e) =>
                  setEditingVariable({
                    ...editingVariable,
                    name: e.target.value.replace(/[^\w]/g, ''),
                  })
                }
                placeholder="e.g., productName"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Alphanumeric and underscores only. Will be used as {'{{variableName}}'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Label *
              </label>
              <input
                type="text"
                value={editingVariable.label}
                onChange={(e) =>
                  setEditingVariable({ ...editingVariable, label: e.target.value })
                }
                placeholder="e.g., Product Name"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <select
                value={editingVariable.type}
                onChange={(e) =>
                  setEditingVariable({
                    ...editingVariable,
                    type: e.target.value as VariableType,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="string">String</option>
                <option value="url">URL</option>
                <option value="date">Date</option>
                <option value="number">Number</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Value (for preview)
              </label>
              <input
                type="text"
                value={editingVariable.defaultValue || ''}
                onChange={(e) =>
                  setEditingVariable({ ...editingVariable, defaultValue: e.target.value })
                }
                placeholder="Sample value for previews"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingVariable.required}
                onChange={(e) =>
                  setEditingVariable({ ...editingVariable, required: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Required variable
              </span>
            </label>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setVariableModalOpen(false)
                  setEditingVariable(null)
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVariable}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Save Variable
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">{errorMessage}</p>
          <div className="flex justify-end">
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
          <p className="text-gray-700 dark:text-gray-300">{successMessage}</p>
          <div className="flex justify-end">
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
      {!isNew && (
        <TemplatePreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          templateId={templateId}
          templateName={name}
          customVariables={variables}
        />
      )}
    </div>
  )
}
