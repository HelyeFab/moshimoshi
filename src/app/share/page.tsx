'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, FileText, Link, X, Check, ChevronDown } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'

// Component that handles the share parameters
function ShareHandler() {
  const { t } = useI18n()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [showModal, setShowModal] = useState(true)
  const [selectedList, setSelectedList] = useState<string>('')
  const [createNewList, setCreateNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Extract shared content from URL parameters
  const sharedTitle = searchParams.get('title') || ''
  const sharedText = searchParams.get('text') || ''
  const sharedUrl = searchParams.get('url') || ''

  // Mock lists - in production, these would come from Firebase/IndexedDB
  const [lists, setLists] = useState([
    { id: 'words', name: 'My Words', type: 'words' },
    { id: 'sentences', name: 'My Sentences', type: 'sentences' },
    { id: 'practice', name: 'Practice List', type: 'mixed' }
  ])

  useEffect(() => {
    // If no content was shared, redirect to home
    if (!sharedTitle && !sharedText && !sharedUrl) {
      router.push('/')
    }
  }, [sharedTitle, sharedText, sharedUrl, router])

  const handleSave = async () => {
    if (!selectedList && !createNewList) {
      setError(t('pwa.share.selectList'))
      return
    }

    if (createNewList && !newListName.trim()) {
      setError('Please enter a list name')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // In production, this would save to IndexedDB or Firebase
      // For now, we'll simulate the save operation
      await new Promise(resolve => setTimeout(resolve, 1000))

      const contentToSave = {
        title: sharedTitle,
        text: sharedText,
        url: sharedUrl,
        savedAt: new Date().toISOString(),
        listId: createNewList ? `new-${Date.now()}` : selectedList
      }

      console.log('Saving shared content:', contentToSave)

      // Store in localStorage for demo purposes
      const existingItems = JSON.parse(localStorage.getItem('shared_items') || '[]')
      existingItems.push(contentToSave)
      localStorage.setItem('shared_items', JSON.stringify(existingItems))

      setSuccess(true)

      // Redirect after success
      setTimeout(() => {
        if (user) {
          router.push('/dashboard')
        } else {
          router.push('/')
        }
      }, 1500)
    } catch (error) {
      console.error('Failed to save shared content:', error)
      setError(t('pwa.share.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setShowModal(false)
    router.push('/')
  }

  if (!showModal) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-soft-white dark:bg-dark-850 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t('pwa.share.title')}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {t('pwa.share.description')}
          </p>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
            {sharedTitle && (
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Title</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{sharedTitle}</p>
                </div>
              </div>
            )}

            {sharedText && (
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Text</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-3">{sharedText}</p>
                </div>
              </div>
            )}

            {sharedUrl && (
              <div className="flex items-start gap-2">
                <Link className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">URL</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 truncate">{sharedUrl}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* List Selection */}
        <div className="p-6">
          {!createNewList ? (
            <>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                {t('pwa.share.selectList')}
              </label>

              <select
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{t('pwa.share.selectList')}</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setCreateNewList(true)}
                className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                {t('pwa.share.createNew')} →
              </button>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                New List Name
              </label>

              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Enter list name..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />

              <button
                onClick={() => {
                  setCreateNewList(false)
                  setNewListName('')
                }}
                className="mt-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ← Back to existing lists
              </button>
            </>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-4 h-4" />
                <p className="text-sm">{t('pwa.share.success')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            {t('common.cancel')}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('common.saving')}
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4" />
                {t('common.saved')}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t('pwa.share.addToList')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main page component with Suspense boundary
export default function SharePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-dark">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }>
        <ShareHandler />
      </Suspense>
    </div>
  )
}