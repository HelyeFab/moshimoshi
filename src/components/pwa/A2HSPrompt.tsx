'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'
import { a2hsManager } from '@/lib/pwa/a2hs'
import { useI18n } from '@/i18n/I18nContext'
import { canCurrentUser } from '@/lib/pwa/entitlements'

export function A2HSPrompt() {
  const { t } = useI18n()
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptAvailable, setPromptAvailable] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop')

  useEffect(() => {
    // Check if user can use this feature
    if (!canCurrentUser('shareTarget')) {
      return
    }

    // Check platform
    const instructions = a2hsManager.getInstallInstructions()
    setPlatform(instructions.platform as 'ios' | 'android' | 'desktop')

    // Subscribe to availability changes
    const unsubscribe = a2hsManager.onAvailabilityChange((available) => {
      setPromptAvailable(available)

      // Auto-show prompt if conditions are met
      if (available && a2hsManager.shouldShowPrompt()) {
        setTimeout(() => {
          setShowPrompt(true)
          a2hsManager.markPromptShown()
        }, 3000) // Show after 3 seconds
      }
    })

    // Check initial availability
    if (a2hsManager.canPrompt() && a2hsManager.shouldShowPrompt()) {
      setTimeout(() => {
        setShowPrompt(true)
        a2hsManager.markPromptShown()
      }, 3000)
    }

    return () => {
      unsubscribe()
    }
  }, [])

  const handleInstall = async () => {
    const result = await a2hsManager.prompt()

    if (result === 'not-available') {
      // For iOS, keep showing the instructions
      if (platform === 'ios') {
        return
      }
    }

    // Close prompt after action
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    a2hsManager.dismissPrompt()
    setShowPrompt(false)
  }

  if (!showPrompt || a2hsManager.isAppInstalled()) {
    return null
  }

  const instructions = a2hsManager.getInstallInstructions()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm">
      <div className="bg-soft-white dark:bg-dark-850 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('pwa.install.title')}
          </h3>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label={t('common.dismiss')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {t('pwa.install.description')}
          </p>

          {/* Benefits */}
          <ul className="space-y-2 mb-4">
            <li className="flex items-start text-sm text-gray-700 dark:text-gray-200">
              <span className="text-primary-500 mr-2">✓</span>
              {t('pwa.install.benefits.offline')}
            </li>
            <li className="flex items-start text-sm text-gray-700 dark:text-gray-200">
              <span className="text-primary-500 mr-2">✓</span>
              {t('pwa.install.benefits.faster')}
            </li>
            <li className="flex items-start text-sm text-gray-700 dark:text-gray-200">
              <span className="text-primary-500 mr-2">✓</span>
              {t('pwa.install.benefits.notifications')}
            </li>
          </ul>

          {/* Platform-specific instructions for iOS */}
          {platform === 'ios' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                {t('pwa.install.ios.instructions')}
              </p>
              <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <span className="font-semibold mr-2">{index + 1}.</span>
                    <span>
                      {index === 0 && (
                        <>
                          {t('pwa.install.ios.step1')} <Share className="inline w-3 h-3 mx-1" />
                        </>
                      )}
                      {index === 1 && t('pwa.install.ios.step2')}
                      {index === 2 && t('pwa.install.ios.step3')}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {platform !== 'ios' && (
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium text-sm"
              >
                {platform === 'android' ? (
                  <Plus className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {t('pwa.install.button')}
              </button>
            )}

            <button
              onClick={handleDismiss}
              className={`${
                platform === 'ios' ? 'flex-1' : ''
              } px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium text-sm transition-colors`}
            >
              {t('pwa.install.later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}