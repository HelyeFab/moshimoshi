'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { TrashIcon, PencilIcon, EyeIcon } from '@heroicons/react/24/outline'
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
  const [episodeToEdit, setEpisodeToEdit] = useState<{ id: string; title: string; titleJa: string } | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTitleJa, setEditTitleJa] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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

  const openEditModal = (id: string, title: string, titleJa: string) => {
    setEpisodeToEdit({ id, title, titleJa })
    setEditTitle(title)
    setEditTitleJa(titleJa)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!episodeToEdit) return

    try {
      setIsSaving(true)
      const response = await fetch('/api/admin/comics/episodes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: episodeToEdit.id,
          updates: {
            title: editTitle,
            titleJa: editTitleJa,
          },
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
                                onClick={() => openEditModal(item.id, item.title, item.titleJa || '')}
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
    </>
  )
}
