'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslation } from '@/i18n/I18nContext'

interface PresetAvatarPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (avatarUrl: string) => void
  currentAvatar?: string
}

export default function PresetAvatarPicker({
  isOpen,
  onClose,
  onSelect,
  currentAvatar,
}: PresetAvatarPickerProps) {
  const { strings } = useTranslation()
  const [avatars, setAvatars] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)

  // Fetch preset avatars
  useEffect(() => {
    if (isOpen) {
      fetchAvatars()
    }
  }, [isOpen])

  const fetchAvatars = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/preset-avatars')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to load avatars')
      }

      setAvatars(data.avatars)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (avatarUrl: string) => {
    setSelectedAvatar(avatarUrl)
  }

  const handleConfirm = () => {
    if (selectedAvatar) {
      onSelect(selectedAvatar)
      onClose()
    }
  }

  // Get avatar name from path for display
  const getAvatarName = (path: string) => {
    const filename = path.split('/').pop()?.replace('.svg', '') || ''
    // Format: "002-cat" -> "Cat"
    return filename.split('-').slice(1).join(' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Group avatars by collection
  const groupedAvatars = avatars.reduce((acc, avatar) => {
    const collection = avatar.split('/')[2] // Get collection name from path
    if (!acc[collection]) {
      acc[collection] = []
    }
    acc[collection].push(avatar)
    return acc
  }, {} as Record<string, string[]>)

  const collectionNames: Record<string, string> = {
    '6583464-face-animal': `🦁 ${strings.account.presetAvatarPicker.collections.animals}`,
    '3906540-chubby-cat-emoticon': `😺 ${strings.account.presetAvatarPicker.collections.cats}`,
    '14939659-cute-hamster-wear-costume': `🐹 ${strings.account.presetAvatarPicker.collections.hamsters}`,
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {strings.account.presetAvatarPicker.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {strings.account.presetAvatarPicker.subtitle}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
                    {error}
                  </div>
                )}

                {!loading && !error && (
                  <div className="space-y-8">
                    {Object.entries(groupedAvatars).map(([collection, collectionAvatars]) => (
                      <div key={collection}>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          {collectionNames[collection] || collection}
                        </h3>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                          {collectionAvatars.map((avatar) => {
                            const isSelected = selectedAvatar === avatar
                            const isCurrent = currentAvatar === avatar

                            return (
                              <motion.button
                                key={avatar}
                                onClick={() => handleSelect(avatar)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`
                                  relative aspect-square rounded-xl p-2 transition-all
                                  ${isSelected
                                    ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                                    : isCurrent
                                    ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500'
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  }
                                `}
                                title={getAvatarName(avatar)}
                              >
                                <Image
                                  src={avatar}
                                  alt={getAvatarName(avatar)}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-contain"
                                />
                                {isCurrent && (
                                  <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    ✓
                                  </div>
                                )}
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedAvatar
                    ? strings.account.presetAvatarPicker.selected.replace('{name}', getAvatarName(selectedAvatar))
                    : strings.account.presetAvatarPicker.selectAvatar
                  }
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {strings.account.presetAvatarPicker.cancel}
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedAvatar}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {strings.account.presetAvatarPicker.confirm}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
