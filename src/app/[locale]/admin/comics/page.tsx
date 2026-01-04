'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { TrashIcon, PencilIcon, EyeIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import Modal from '@/components/ui/Modal'
import { ComicEpisode } from '@/types/comic'

export default function AdminComicsPage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useAuth()
  const { showToast } = useToast()
  const [episodes, setEpisodes] = useState<ComicEpisode[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [episodeToPublish, setEpisodeToPublish] = useState<{ id: string; title: string } | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [episodeToDelete, setEpisodeToDelete] = useState<{ id: string; title: string } | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [episodeToEdit, setEpisodeToEdit] = useState<{ id: string; title: string; titleJa: string; panels: any[] } | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTitleJa, setEditTitleJa] = useState('')
  const [editPanelOrders, setEditPanelOrders] = useState<number[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Panel regeneration state
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false)
  const [episodeToRegenerate, setEpisodeToRegenerate] = useState<{
    id: string;
    title: string;
    panels: any[];
    seriesId: string;
    theme: string;
    location: string;
  } | null>(null)
  const [selectedPanelNumber, setSelectedPanelNumber] = useState(1)
  const [customPrompt, setCustomPrompt] = useState('')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerationProgress, setRegenerationProgress] = useState('')
  const [newPanelImageUrl, setNewPanelImageUrl] = useState<string | null>(null)

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/')
    }
  }, [user, sessionLoading, router])

  const loadEpisodes = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch published episodes and drafts
      const [episodesResponse, draftsResponse] = await Promise.all([
        fetch('/api/admin/comics/episodes?limit=100'),
        fetch('/api/admin/comics/drafts?limit=100'),
      ])

      const episodesData = episodesResponse.ok ? await episodesResponse.json() : { episodes: [] }
      const draftsData = draftsResponse.ok ? await draftsResponse.json() : { drafts: [] }

      setEpisodes(episodesData.episodes || [])
      setDrafts(draftsData.drafts || [])
    } catch (error) {
      console.error('Error loading comics:', error)
      showToast('Failed to load comics', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (user?.isAdmin) {
      loadEpisodes()
    }
  }, [user, loadEpisodes])

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const allItems = [
    ...episodes.map(ep => ({ ...ep, isDraft: false })),
    ...drafts.map(d => ({
      id: d.id,
      title: d.outline?.title || `Episode ${d.episodeNumber}`,
      titleJa: d.outline?.titleJa || '',
      episodeNumber: d.episodeNumber,
      theme: d.theme || 'Unknown',
      location: d.location || '',
      panels: d.panels || [],
      status: 'draft' as const,
      isDraft: true,
      createdAt: d.createdAt,
    })),
  ]

  const openDeleteModal = (id: string, title: string) => {
    setEpisodeToDelete({ id, title })
    setDeleteModalOpen(true)
  }

  const handleDeleteEpisode = async () => {
    if (!episodeToDelete) return

    try {
      setDeleteModalOpen(false)
      setIsDeleting(true)
      const response = await fetch('/api/admin/comics/episodes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: episodeToDelete.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete episode')
      }

      await loadEpisodes()
      showToast('Episode deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting episode:', error)
      showToast('Failed to delete episode', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const openEditModal = (id: string, title: string, titleJa: string, panels: any[] = []) => {
    setEpisodeToEdit({ id, title, titleJa, panels })
    setEditTitle(title)
    setEditTitleJa(titleJa)
    // Initialize panel orders: [1, 2, 3, 4, 5, 6]
    setEditPanelOrders(panels.map((_, i) => i + 1))
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!episodeToEdit) return

    try {
      setIsSaving(true)

      // Build updates object
      const updates: Record<string, any> = {
        title: editTitle,
        titleJa: editTitleJa,
      }

      // Check if panel order changed
      const originalOrder = episodeToEdit.panels.map((_, i) => i + 1)
      const orderChanged = editPanelOrders.some((order, i) => order !== originalOrder[i])

      if (orderChanged && episodeToEdit.panels.length > 0) {
        // Reorder panels based on new order numbers
        // Create array of [newOrder, originalIndex] pairs, sort by newOrder
        const orderPairs = editPanelOrders.map((order, idx) => ({ order, idx }))
        orderPairs.sort((a, b) => a.order - b.order)

        // Reorder panels and update panelNumber
        const reorderedPanels = orderPairs.map((pair, newIdx) => ({
          ...episodeToEdit.panels[pair.idx],
          panelNumber: newIdx + 1,
        }))

        updates.panels = reorderedPanels
      }

      const response = await fetch('/api/admin/comics/episodes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: episodeToEdit.id,
          updates,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update episode')
      }

      setEditModalOpen(false)
      await loadEpisodes()
      showToast('Episode updated successfully', 'success')
    } catch (error) {
      console.error('Error updating episode:', error)
      showToast('Failed to update episode', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const openPublishModal = (id: string, title: string) => {
    setEpisodeToPublish({ id, title })
    setPublishModalOpen(true)
  }

  const handlePublishDraft = async () => {
    if (!episodeToPublish) return

    try {
      setPublishModalOpen(false)
      setIsPublishing(true)
      const response = await fetch('/api/admin/comics/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: episodeToPublish.id }),
      })

      if (!response.ok) {
        throw new Error('Failed to publish episode')
      }

      showToast('Episode published successfully!', 'success')
      await loadEpisodes()
    } catch (error) {
      console.error('Error publishing episode:', error)
      showToast('Failed to publish episode', 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  const openRegenerateModal = (episode: any) => {
    setEpisodeToRegenerate({
      id: episode.id,
      title: episode.title,
      panels: episode.panels || [],
      seriesId: episode.seriesId || 'moshi-goes-to-japan',
      theme: episode.theme || '',
      location: episode.location || '',
    })
    setSelectedPanelNumber(1)
    setCustomPrompt('')
    setNewPanelImageUrl(null)
    setRegenerationProgress('')
    setRegenerateModalOpen(true)
  }

  const handleRegeneratePanel = async () => {
    if (!episodeToRegenerate) return

    try {
      setIsRegenerating(true)
      setRegenerationProgress(`Regenerating panel ${selectedPanelNumber}... (this may take 30-60 seconds)`)

      // Call the dedicated regeneration API
      const response = await fetch('/api/admin/comics/regenerate-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: episodeToRegenerate.id,
          panelNumber: selectedPanelNumber,
          customPrompt: customPrompt.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Regeneration failed')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Regeneration failed')
      }

      setRegenerationProgress('')
      setNewPanelImageUrl(result.imageUrl)
      setIsRegenerating(false)
      showToast('Panel regenerated successfully! Review and close when ready.', 'success')

      // Reload episodes in background to update the list
      await loadEpisodes()

      // DON'T auto-close - let user review and close manually
    } catch (error) {
      console.error('Error regenerating panel:', error)
      showToast(error instanceof Error ? error.message : 'Failed to regenerate panel', 'error')
      setIsRegenerating(false)
      setRegenerationProgress('')
    }
  }

  const handleCloseRegenerateModal = () => {
    setRegenerateModalOpen(false)
    setIsRegenerating(false)
    setRegenerationProgress('')
    setNewPanelImageUrl(null)
    setCustomPrompt('')
  }

  if (sessionLoading || loading) {
    return <LoadingOverlay />
  }

  if (!user || !user.isAdmin) {
    return null
  }

  return (
    <>
      <div className="max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Moshi Comics Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Manage &quot;Moshi Goes to Japan&quot; comic episodes
          </p>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/comics/schedule"
              className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-sm"
            >
              <span>📅</span>
              Schedule Episodes
            </Link>
            <Link
              href="/admin/comics/generate"
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-lg transition-all flex items-center gap-2 shadow-sm"
            >
              <span>🦝</span>
              Generate Now
            </Link>
          </div>
        </div>

        {/* Episodes Table */}
        {allItems.length === 0 ? (
          <div className="bg-white dark:bg-dark-850 rounded-lg p-12 text-center shadow-sm border border-gray-200 dark:border-dark-700">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No comic episodes yet</p>
            <Link
              href="/admin/comics/generate"
              className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 underline transition-colors"
            >
              Generate your first episode
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-850 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-dark-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === allItems.length && allItems.length > 0}
                        onChange={() => {
                          if (selectedIds.length === allItems.length) {
                            setSelectedIds([])
                          } else {
                            setSelectedIds(allItems.map(i => i.id))
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Episode
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Theme
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Panels
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Status
                    </th>
                    <th className="text-left p-4 font-medium text-gray-900 dark:text-gray-100">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map(item => (
                    <tr
                      key={item.id}
                      className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-800"
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            EP {item.episodeNumber}: {item.title}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {item.titleJa}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-gray-900 dark:text-gray-100">
                        {item.theme}
                        {item.location && (
                          <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">
                            ({item.location})
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-900 dark:text-gray-100">
                        {item.panels?.length || 0}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === 'published'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : item.status === 'draft'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {item.isDraft ? (
                            <button
                              onClick={() => openPublishModal(item.id, item.title)}
                              disabled={isPublishing}
                              className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300 rounded transition-colors disabled:opacity-50"
                              title="Publish episode"
                            >
                              Publish
                            </button>
                          ) : (
                            <>
                              <Link
                                href={`/comics/${item.id}`}
                                className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                title="View episode"
                                target="_blank"
                              >
                                <EyeIcon className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => openRegenerateModal(item)}
                                disabled={isRegenerating}
                                className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors disabled:opacity-50"
                                title="Regenerate panel"
                              >
                                <SparklesIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(item.id, item.title, item.titleJa || '', item.panels || [])}
                                disabled={isSaving}
                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                                title="Edit episode"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openDeleteModal(item.id, item.title)}
                            disabled={isDeleting}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete episode"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {(isDeleting || isPublishing || isSaving) && <LoadingOverlay />}

      {/* Publish Confirmation Modal */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish Episode"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to publish <strong>&quot;{episodeToPublish?.title}&quot;</strong>?
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will make the episode visible to all users.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setPublishModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePublishDraft}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Publish
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Episode"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>&quot;{episodeToDelete?.title}&quot;</strong>?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteEpisode}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Episode Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Episode"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title (English)
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Episode title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title (Japanese)
            </label>
            <input
              type="text"
              value={editTitleJa}
              onChange={(e) => setEditTitleJa(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="エピソードタイトル"
            />
          </div>

          {/* Panel Reordering */}
          {episodeToEdit?.panels && episodeToEdit.panels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Panel Order
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Change numbers to reorder panels (e.g., swap 2↔3)
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {episodeToEdit.panels.map((panel, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    {panel.imageUrl && (
                      <img
                        src={panel.imageUrl}
                        alt={`Panel ${idx + 1}`}
                        className="w-12 h-16 object-cover rounded mb-1 border border-gray-200 dark:border-gray-700"
                      />
                    )}
                    <input
                      type="number"
                      min={1}
                      max={episodeToEdit.panels.length}
                      value={editPanelOrders[idx] || idx + 1}
                      onChange={(e) => {
                        const newOrders = [...editPanelOrders]
                        newOrders[idx] = parseInt(e.target.value) || idx + 1
                        setEditPanelOrders(newOrders)
                      }}
                      className="w-12 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Regenerate Panel Modal */}
      <Modal
        isOpen={regenerateModalOpen}
        onClose={() => !isRegenerating && handleCloseRegenerateModal()}
        title={`Regenerate Panel - ${episodeToRegenerate?.title || ''}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Panel Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select Panel to Regenerate
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {episodeToRegenerate?.panels.map((panel, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPanelNumber(idx + 1)}
                  disabled={isRegenerating}
                  className={`relative flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                    selectedPanelNumber === idx + 1
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                  } ${isRegenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {panel.imageUrl && (
                    <img
                      src={panel.imageUrl}
                      alt={`Panel ${idx + 1}`}
                      className="w-full h-20 object-cover rounded mb-1"
                    />
                  )}
                  <span className={`text-xs font-medium ${
                    selectedPanelNumber === idx + 1
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    Panel {idx + 1}
                  </span>
                  {selectedPanelNumber === idx + 1 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Current Panel Preview */}
          {episodeToRegenerate?.panels[selectedPanelNumber - 1]?.imageUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Panel {selectedPanelNumber}
              </label>
              <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <img
                  src={episodeToRegenerate.panels[selectedPanelNumber - 1].imageUrl}
                  alt={`Current panel ${selectedPanelNumber}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Scene: {episodeToRegenerate.panels[selectedPanelNumber - 1].sceneDescription}
              </p>
            </div>
          )}

          {/* Custom Prompt (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Instructions (Optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isRegenerating}
              placeholder="e.g., 'make Yuki smile more', 'add cherry blossoms in background', 'change to evening lighting'"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave empty to regenerate with the same prompt
            </p>
          </div>

          {/* Progress Message */}
          {regenerationProgress && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-200 border-t-purple-600"></div>
                <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                  {regenerationProgress}
                </p>
              </div>
            </div>
          )}

          {/* New Panel Preview (After Generation) */}
          {newPanelImageUrl && (
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
                    Panel Regenerated Successfully!
                  </h3>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Episode has been updated. Review the new panel below.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                {/* Old Panel */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Before
                  </label>
                  <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                    <img
                      src={episodeToRegenerate?.panels[selectedPanelNumber - 1]?.imageUrl}
                      alt="Old panel"
                      className="w-full h-full object-cover opacity-75"
                    />
                  </div>
                </div>

                {/* New Panel */}
                <div>
                  <label className="block text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                    After ✨
                  </label>
                  <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border-2 border-green-500">
                    <img
                      src={newPanelImageUrl}
                      alt="New panel"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-green-200 dark:border-green-800">
                <a
                  href={`/comics/${episodeToRegenerate?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 underline"
                >
                  View full episode →
                </a>
                <button
                  onClick={handleCloseRegenerateModal}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!newPanelImageUrl && (
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseRegenerateModal}
                disabled={isRegenerating}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegenerating ? 'Please wait...' : 'Cancel'}
              </button>
              <button
                onClick={handleRegeneratePanel}
                disabled={isRegenerating}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/25"
              >
                {isRegenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Regenerating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4" />
                    Regenerate Panel
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
