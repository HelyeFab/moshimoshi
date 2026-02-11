'use client'

import { useState, useEffect, useCallback } from 'react'
import { Database, HardDrive, Check, AlertCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { storageManager } from '@/lib/flashcards/StorageManager'
import { useToast } from '@/components/ui/Toast/ToastContext'

interface FlashcardsStoragePermissionModalProps {
  onComplete?: (granted: boolean) => void
  autoPrompt?: boolean
  autoPromptDelay?: number
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const STORAGE_KEY = 'flashcards_storage_permission_prompted'
const STORAGE_DISMISSED_KEY = 'flashcards_storage_permission_dismissed'

export function FlashcardsStoragePermissionModal({
  onComplete,
  autoPrompt = true,
  autoPromptDelay = 2500,
  isOpen,
  onOpenChange,
}: FlashcardsStoragePermissionModalProps) {
  const { t } = useI18n()
  const { showToast } = useToast()
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(
    null
  )
  const showModal = isOpen ?? internalOpen
  const setShowModal = useCallback(
    (open: boolean) => {
      if (isOpen === undefined) {
        setInternalOpen(open)
      }
      onOpenChange?.(open)
    },
    [isOpen, onOpenChange]
  )

  const isSupported = typeof navigator !== 'undefined' && navigator.storage?.persist

  const checkPersistence = useCallback(async () => {
    if (!isSupported) return false

    try {
      const persisted = await navigator.storage.persisted()
      setIsPersisted(persisted)

      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate()
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        })
      }

      return persisted
    } catch (error) {
      console.warn('[FlashcardsStoragePermission] Failed to check persistence:', error)
      return false
    }
  }, [isSupported])

  useEffect(() => {
    if (!isSupported || !autoPrompt) return

    const checkAndPrompt = async () => {
      const persisted = await checkPersistence()
      if (persisted) return

      const dismissedAt = localStorage.getItem(STORAGE_DISMISSED_KEY)
      if (dismissedAt) {
        const dismissedDate = new Date(dismissedAt)
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceDismissed < 7) return
      }

      const promptedThisSession = sessionStorage.getItem(STORAGE_KEY)
      if (promptedThisSession) return

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
      const granted = await storageManager.requestPersistence()
      setIsPersisted(granted)
      onComplete?.(granted)

      if (granted) {
        setShowModal(false)
      } else {
        setShowModal(false)
        localStorage.setItem(STORAGE_DISMISSED_KEY, new Date().toISOString())
        showToast(
          t('flashcards.storage.permission.denied') ||
            'Offline storage was not enabled by your browser.',
          'info'
        )
      }
    } catch (error) {
      console.error('[FlashcardsStoragePermission] Failed to request persistence:', error)
      onComplete?.(false)
      setShowModal(false)
      localStorage.setItem(STORAGE_DISMISSED_KEY, new Date().toISOString())
      showToast(
        t('flashcards.storage.permission.error') ||
          'Unable to enable offline storage right now.',
        'error'
      )
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

  if (!isSupported) return null

  return (
    <Modal
      isOpen={showModal}
      onClose={handleDismiss}
      title={
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary-500" />
          <span>{t('flashcards.storage.permission.title') || 'Keep Flashcards Offline'}</span>
        </div>
      }
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('flashcards.storage.permission.description') ||
            'Allow Moshimoshi to store flashcards permanently so your decks stay available offline.'}
        </p>

        {storageEstimate && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t('flashcards.storage.currentUsage') || 'Current storage usage'}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatBytes(storageEstimate.usage)}
                {storageEstimate.quota ? ` / ${formatBytes(storageEstimate.quota)}` : ''}
              </span>
            </div>
            {storageEstimate.quota ? (
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min((storageEstimate.usage / storageEstimate.quota) * 100, 100)}%`,
                  }}
                />
              </div>
            ) : null}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            {t('common.benefits') || 'Benefits'}
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                {t('flashcards.storage.benefits.offline') ||
                  'Study decks offline without re-downloading'}
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                {t('flashcards.storage.benefits.persistent') ||
                  "Browser won't delete your decks"}
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                {t('flashcards.storage.benefits.safer') ||
                  'Protects large imports from eviction'}
              </span>
            </li>
          </ul>
        </div>

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
                    {t('flashcards.storage.status.granted') || 'Storage is persistent'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    {t('flashcards.storage.status.notGranted') ||
                      'Storage may be cleared by browser'}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

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
                ? t('flashcards.storage.permission.granted') || 'Already Enabled'
                : t('flashcards.storage.permission.allow') || 'Enable Offline Storage'}
          </button>

          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium text-sm transition-colors"
          >
            {t('flashcards.storage.permission.later') || 'Later'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
