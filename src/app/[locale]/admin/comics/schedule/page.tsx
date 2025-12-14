'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import Modal from '@/components/ui/Modal'
import Dropdown from '@/components/ui/Dropdown'
import { ComicQueueItem, EPISODE_THEMES, COMIC_CHARACTERS, JLPTLevel } from '@/types/comic'

const JLPT_LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function AdminComicsSchedulePage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useAuth()
  const { showToast } = useToast()

  // Queue state
  const [queue, setQueue] = useState<ComicQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [selectedTheme, setSelectedTheme] = useState('')
  const [customTheme, setCustomTheme] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>(['moshi-master'])
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5')
  const [customTitleEn, setCustomTitleEn] = useState('')
  const [customTitleJa, setCustomTitleJa] = useState('')

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ComicQueueItem | null>(null)

  // Check admin access
  useEffect(() => {
    if (!sessionLoading && (!user || !user.isAdmin)) {
      router.push('/')
    }
  }, [user, sessionLoading, router])

  // Load queue
  const loadQueue = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/comics/queue?status=pending')
      if (!response.ok) throw new Error('Failed to load queue')
      const data = await response.json()
      setQueue(data.queue || [])
    } catch (error) {
      console.error('Error loading queue:', error)
      showToast('Failed to load queue', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (user?.isAdmin) {
      loadQueue()
    }
  }, [user, loadQueue])

  // Get theme details when selected
  const selectedThemeData = EPISODE_THEMES.find(t => t.theme === selectedTheme)

  // Auto-select default characters when theme changes (only for preset themes)
  useEffect(() => {
    if (selectedThemeData && selectedTheme !== 'custom') {
      setSelectedCharacters([...selectedThemeData.characters])
    }
  }, [selectedTheme, selectedThemeData])

  // Toggle character selection
  const toggleCharacter = (characterId: string) => {
    // Moshi must always be selected
    if (characterId === 'moshi-master') return

    setSelectedCharacters(prev =>
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    )
  }

  // Add to queue
  const handleAddToQueue = async () => {
    const isCustom = selectedTheme === 'custom'

    if (!selectedTheme) {
      showToast('Please select a theme', 'error')
      return
    }

    if (isCustom && !customTheme.trim()) {
      showToast('Please enter a custom theme', 'error')
      return
    }

    if (isCustom && !customLocation.trim()) {
      showToast('Please enter a location', 'error')
      return
    }

    if (selectedCharacters.length === 0) {
      showToast('Please select at least one character', 'error')
      return
    }

    try {
      setIsSubmitting(true)

      // Determine theme and location based on selection
      const theme = isCustom ? customTheme.trim() : selectedTheme
      const location = isCustom ? customLocation.trim() : (selectedThemeData?.location || '')
      const titleEn = customTitleEn || (isCustom ? '' : selectedThemeData?.titleEn || '')
      const titleJa = customTitleJa || (isCustom ? '' : selectedThemeData?.titleJa || '')

      const response = await fetch('/api/admin/comics/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          location,
          titleEn,
          titleJa,
          characterIds: selectedCharacters,
          jlptLevel,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add to queue')
      }

      showToast('Episode added to queue!', 'success')

      // Reset form
      setSelectedTheme('')
      setCustomTheme('')
      setCustomLocation('')
      setSelectedCharacters(['moshi-master'])
      setJlptLevel('N5')
      setCustomTitleEn('')
      setCustomTitleJa('')

      // Reload queue
      await loadQueue()
    } catch (error) {
      console.error('Error adding to queue:', error)
      showToast(error instanceof Error ? error.message : 'Failed to add to queue', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete from queue
  const handleDelete = async () => {
    if (!itemToDelete) return

    try {
      const response = await fetch('/api/admin/comics/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemToDelete.id }),
      })

      if (!response.ok) throw new Error('Failed to delete')

      showToast('Removed from queue', 'success')
      setDeleteModalOpen(false)
      setItemToDelete(null)
      await loadQueue()
    } catch (error) {
      showToast('Failed to delete', 'error')
    }
  }

  // Move item in queue
  const handleMove = async (item: ComicQueueItem, direction: 'up' | 'down') => {
    const currentIndex = queue.findIndex(q => q.id === item.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= queue.length) return

    const targetItem = queue[targetIndex]

    // Swap priorities
    try {
      await Promise.all([
        fetch('/api/admin/comics/queue', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, priority: targetItem.priority }),
        }),
        fetch('/api/admin/comics/queue', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetItem.id, priority: item.priority }),
        }),
      ])

      await loadQueue()
    } catch (error) {
      showToast('Failed to reorder', 'error')
    }
  }

  if (sessionLoading || loading) {
    return <LoadingOverlay />
  }

  if (!user || !user.isAdmin) {
    return null
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <Link href="/admin/comics" className="hover:text-primary-600 dark:hover:text-primary-400">
            Comics
          </Link>
          <span>/</span>
          <span>Schedule</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Schedule Comic Episodes
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Queue upcoming episodes for the Sunday scheduler. Episodes will be generated in order.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Add to Queue Form */}
        <div className="bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <PlusIcon className="w-5 h-5 text-primary-500" />
            Add Episode to Queue
          </h2>

          <div className="space-y-6">
            {/* Theme Selection */}
            <div>
              <Dropdown
                label="Theme & Location"
                value={selectedTheme}
                onChange={(value) => setSelectedTheme(value)}
                placeholder="Select a theme..."
                options={[
                  { value: 'custom', label: 'Custom Theme...' },
                  ...EPISODE_THEMES.map(theme => ({
                    value: theme.theme,
                    label: `${theme.titleEn} - ${theme.location}`
                  }))
                ]}
              />
              {selectedTheme === 'custom' && (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={customTheme}
                    onChange={e => setCustomTheme(e.target.value)}
                    placeholder="Theme (e.g., 'supermarket', 'hospital', 'beach')"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="text"
                    value={customLocation}
                    onChange={e => setCustomLocation(e.target.value)}
                    placeholder="Location (e.g., 'Okinawa Beach', 'Tokyo Hospital')"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
              {selectedThemeData && selectedTheme !== 'custom' && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {selectedThemeData.titleJa}
                </p>
              )}
            </div>

            {/* Character Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <UserGroupIcon className="w-4 h-4 inline mr-1" />
                Characters
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COMIC_CHARACTERS.map(char => (
                  <label
                    key={char.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCharacters.includes(char.id)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${char.id === 'moshi-master' ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCharacters.includes(char.id)}
                      onChange={() => toggleCharacter(char.id)}
                      disabled={char.id === 'moshi-master'}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {char.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {char.nameJa} • {char.role}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Moshi is always included. Select up to 3 additional characters.
              </p>
            </div>

            {/* JLPT Level */}
            <div>
              <Dropdown
                label="JLPT Level"
                value={jlptLevel}
                onChange={(value) => setJlptLevel(value as JLPTLevel)}
                options={[
                  { value: 'N5', label: 'N5 (Beginner)' },
                  { value: 'N4', label: 'N4 (Elementary)' },
                  { value: 'N3', label: 'N3 (Intermediate)' },
                  { value: 'N2', label: 'N2 (Pre-Advanced)' },
                  { value: 'N1', label: 'N1 (Advanced)' },
                ]}
              />
            </div>

            {/* Custom Title Override (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Title (Optional)
              </label>
              <input
                type="text"
                value={customTitleEn}
                onChange={e => setCustomTitleEn(e.target.value)}
                placeholder="English title override..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors mb-2"
              />
              <input
                type="text"
                value={customTitleJa}
                onChange={e => setCustomTitleJa(e.target.value)}
                placeholder="日本語タイトル..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors font-japanese"
              />
            </div>

            {/* Add Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleAddToQueue}
              disabled={isSubmitting || !selectedTheme || (selectedTheme === 'custom' && (!customTheme.trim() || !customLocation.trim()))}
              className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <PlusIcon className="w-5 h-5" />
                  Add to Queue
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Right: Queue Display */}
        <div className="bg-white dark:bg-dark-850 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary-500" />
            Upcoming Episodes ({queue.length})
          </h2>

          {queue.length === 0 ? (
            <div className="text-center py-12">
              <SparklesIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">No episodes in queue</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Add episodes to be generated by the Sunday scheduler
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-bold">
                          {index + 1}
                        </span>
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {item.titleEn || EPISODE_THEMES.find(t => t.theme === item.theme)?.titleEn || `${item.theme} at ${item.location}`}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {item.location} • {item.jlptLevel}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.characterIds.map(charId => {
                          const char = COMIC_CHARACTERS.find(c => c.id === charId)
                          return (
                            <span
                              key={charId}
                              className="inline-flex items-center px-2 py-0.5 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                            >
                              {char?.name || charId}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMove(item, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMove(item, 'down')}
                        disabled={index === queue.length - 1}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDownIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setItemToDelete(item)
                          setDeleteModalOpen(true)
                        }}
                        className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remove"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>How it works:</strong> The scheduler runs every Sunday at 00:00 UTC.
              It will pick the first item from this queue. If the queue is empty, it will
              auto-generate based on the episode number.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Remove from Queue"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to remove{' '}
            <strong>
              &quot;{itemToDelete?.titleEn || EPISODE_THEMES.find(t => t.theme === itemToDelete?.theme)?.titleEn || `${itemToDelete?.theme} at ${itemToDelete?.location}`}&quot;
            </strong>{' '}
            from the queue?
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
