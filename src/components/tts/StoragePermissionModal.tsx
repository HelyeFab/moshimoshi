'use client'

import { useState, useEffect, useCallback } from 'react'
import { HardDrive, X, Check, AlertCircle, Database } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'

interface StoragePermissionModalProps {
  /** Called when permission is granted or denied */
  onComplete?: (granted: boolean) => void
  /** If true, auto-show modal when storage is not persistent */
  autoPrompt?: boolean
  /** Delay before auto-showing (ms) */
  autoPromptDelay?: number
}

// Storage manager for tracking permission state
const STORAGE_KEY = 'tts_storage_permission_prompted'
const STORAGE_DISMISSED_KEY = 'tts_storage_permission_dismissed'

export function StoragePermissionModal({
  onComplete,
  autoPrompt = true,
  autoPromptDelay = 3000,
}: StoragePermissionModalProps) {
  const { t } = useI18n()
  const [showModal, setShowModal] = useState(false)
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(
    null
  )

  // Check if storage API is supported
  const isSupported = typeof navigator !== 'undefined' && navigator.storage?.persist

  // Check current persistence status
  const checkPersistence = useCallback(async () => {
    if (!isSupported) return false

    try {
      const persisted = await navigator.storage.persisted()
      setIsPersisted(persisted)

      // Also get storage estimate
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate()
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        })
      }

      return persisted
    } catch (error) {
      console.warn('[StoragePermission] Failed to check persistence:', error)
      return false
    }
  }, [isSupported])

  // Auto-prompt logic
  useEffect(() => {
    if (!isSupported || !autoPrompt) return

    const checkAndPrompt = async () => {
      const persisted = await checkPersistence()

      // Don't prompt if already persisted
      if (persisted) return

      // Don't prompt if user dismissed recently (within 7 days)
      const dismissedAt = localStorage.getItem(STORAGE_DISMISSED_KEY)
      if (dismissedAt) {
        const dismissedDate = new Date(dismissedAt)
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceDismissed < 7) return
      }

      // Don't prompt if already prompted this session
      const promptedThisSession = sessionStorage.getItem(STORAGE_KEY)
      if (promptedThisSession) return

      // Show modal after delay
      setTimeout(() => {
        setShowModal(true)
        sessionStorage.setItem(STORAGE_KEY, 'true')
      }, autoPromptDelay)
    }

    checkAndPrompt()
  }, [isSupported, autoPrompt, autoPromptDelay, checkPersistence])

  const handleRequestPermission = async () => {
    if (!isSupported) return

    setRequesting(true)

    try {
      const granted = await navigator.storage.persist()
      setIsPersisted(granted)

      console.log(`[StoragePermission] Persistent storage: ${granted ? 'granted' : 'denied'}`)

      onComplete?.(granted)

      if (granted) {
        setShowModal(false)
      }
    } catch (error) {
      console.error('[StoragePermission] Failed to request persistence:', error)
      onComplete?.(false)
    } finally {
      setRequesting(false)
    }
  }

  const handleDismiss = () => {
    setShowModal(false)
    localStorage.setItem(STORAGE_DISMISSED_KEY, new Date().toISOString())
    onComplete?.(false)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  // Don't render if not supported
  if (!isSupported) return null

  return (
    <Modal
      isOpen={showModal}
      onClose={handleDismiss}
      title={
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary-500" />
          <span>{t('tts.storage.permission.title') || 'Keep Audio Offline'}</span>
        </div>
      }
      size="sm"
    >
      <div className="space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('tts.storage.permission.description') ||
            'Allow Moshimoshi to store audio files permanently for offline use. This ensures your cached audio is not deleted by the browser.'}
        </p>

        {/* Storage estimate */}
        {storageEstimate && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t('tts.storage.currentUsage') || 'Current storage usage'}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{
                  width: `${Math.min((storageEstimate.usage / storageEstimate.quota) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            {t('common.benefits') || 'Benefits'}
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                {t('tts.storage.benefits.offline') || 'Audio works offline without re-downloading'}
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                {t('tts.storage.benefits.persistent') || "Browser won't delete cached audio"}
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                {t('tts.storage.benefits.faster') || 'Instant playback for previously heard audio'}
              </span>
            </li>
          </ul>
        </div>

        {/* Current status indicator */}
        {isPersisted !== null && (
          <div
            className={`p-3 rounded-lg ${
              isPersisted
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-yellow-50 dark:bg-yellow-900/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {isPersisted ? (
                <>
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    {t('tts.storage.status.granted') || 'Storage is persistent'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    {t('tts.storage.status.notGranted') || 'Storage may be cleared by browser'}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleRequestPermission}
            disabled={requesting || isPersisted === true}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-sm"
          >
            <HardDrive className="w-4 h-4" />
            {requesting
              ? t('common.processing') || 'Processing...'
              : isPersisted
                ? t('tts.storage.permission.granted') || 'Already Enabled'
                : t('tts.storage.permission.allow') || 'Enable Offline Storage'}
          </button>

          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium text-sm transition-colors"
          >
            {t('common.later') || 'Later'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Hook to check and request persistent storage
 * Can be used programmatically without showing the modal
 */
export function usePersistentStorage() {
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && !!navigator.storage?.persist
    setIsSupported(supported)

    if (supported) {
      navigator.storage
        .persisted()
        .then(setIsPersisted)
        .catch(() => setIsPersisted(false))
    }
  }, [])

  const requestPersistence = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    try {
      const granted = await navigator.storage.persist()
      setIsPersisted(granted)
      return granted
    } catch {
      return false
    }
  }, [isSupported])

  return {
    isPersisted,
    isSupported,
    requestPersistence,
  }
}
