'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { TemplateVariable, PreviewTemplateResponse } from '@/lib/email/templates/types'
import { SYSTEM_VARIABLES } from '@/lib/email/templates/types'

interface TemplatePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  templateId: string
  templateName: string
  customVariables: TemplateVariable[]
}

type ViewMode = 'html' | 'text'
type ViewportSize = 'desktop' | 'mobile'

export function TemplatePreviewModal({
  isOpen,
  onClose,
  templateId,
  templateName,
  customVariables,
}: TemplatePreviewModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('html')
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewTemplateResponse | null>(null)
  const [sampleData, setSampleData] = useState<Record<string, string>>({})

  // Initialize sample data with defaults
  useEffect(() => {
    if (isOpen) {
      const defaults: Record<string, string> = {}
      for (const v of SYSTEM_VARIABLES) {
        defaults[v.name] = v.defaultValue || ''
      }
      for (const v of customVariables) {
        defaults[v.name] = v.defaultValue || ''
      }
      setSampleData(defaults)
    }
  }, [isOpen, customVariables])

  // Fetch preview when modal opens or sample data changes
  const fetchPreview = async () => {
    if (!isOpen || !templateId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/templates/${templateId}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ variables: sampleData }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to generate preview')
      }

      setPreview(data.preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  // Deduplicate variables - custom variables take precedence over system variables
  // IMPORTANT: This must be before the early return to avoid hooks ordering issues
  const allVariables = useMemo(() => {
    const variableMap = new Map<string, typeof SYSTEM_VARIABLES[0]>()
    // Add system variables first
    SYSTEM_VARIABLES.forEach((v) => variableMap.set(v.name, v))
    // Custom variables override system variables with same name
    customVariables.forEach((v) => variableMap.set(v.name, v))
    return Array.from(variableMap.values())
  }, [customVariables])

  // Fetch on open and when sample data changes (debounced)
  useEffect(() => {
    if (isOpen && templateId) {
      const timer = setTimeout(fetchPreview, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, templateId, sampleData])

  // Early return AFTER all hooks are called
  if (!isOpen) return null

  const handleSampleDataChange = (name: string, value: string) => {
    setSampleData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Template Preview
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {templateName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* View Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('html')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'html'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                HTML Preview
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'text'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Plain Text
              </button>
            </div>

            {/* Viewport Size Toggle (HTML only) */}
            {viewMode === 'html' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setViewportSize('desktop')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewportSize === 'desktop'
                      ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Desktop View"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewportSize('mobile')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewportSize === 'mobile'
                      ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Mobile View"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            )}

            {/* Subject Preview */}
            {preview && (
              <div className="flex-1 text-right">
                <span className="text-sm text-gray-500 dark:text-gray-400">Subject: </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {preview.subject}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sample Data Editor */}
          <div className="w-72 border-r border-gray-200 dark:border-gray-700 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Sample Data
            </h3>
            <div className="space-y-3">
              {allVariables.map((variable) => (
                <div key={variable.name}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {variable.label}
                    {variable.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type="text"
                    value={sampleData[variable.name] || ''}
                    onChange={(e) => handleSampleDataChange(variable.name, e.target.value)}
                    placeholder={variable.defaultValue || `{{${variable.name}}}`}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={fetchPreview}
              disabled={loading}
              className="mt-4 w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh Preview'}
            </button>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-gray-900">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-4 rounded-lg">
                <p className="font-medium">Error loading preview</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && preview && (
              <div className="flex justify-center">
                {viewMode === 'html' ? (
                  <div
                    className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all ${
                      viewportSize === 'mobile' ? 'w-[375px]' : 'w-full max-w-3xl'
                    }`}
                  >
                    <iframe
                      srcDoc={preview.html}
                      title="Email Preview"
                      className="w-full h-[600px] border-0"
                      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    />
                  </div>
                ) : (
                  <pre className="bg-white dark:bg-gray-800 rounded-lg p-6 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono overflow-auto max-h-[600px] w-full max-w-3xl">
                    {preview.text}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}
