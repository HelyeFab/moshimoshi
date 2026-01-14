'use client'

import { useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { useI18n } from '@/i18n/I18nContext'
import { a2hsManager } from '@/lib/pwa/a2hs'

const SESSION_TOAST_KEY = 'pwa_install_toast_shown'
const TOAST_DURATION_MS = 8000

export function PWAInstallToast() {
  const { showToast } = useToast()
  const { t } = useI18n()

  const handleInstall = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('pwa:install-request'))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (a2hsManager.isAppInstalled()) return
    if (sessionStorage.getItem(SESSION_TOAST_KEY) === 'true') return
    if (!a2hsManager.shouldShowPrompt()) return

    sessionStorage.setItem(SESSION_TOAST_KEY, 'true')
    a2hsManager.markPromptShown()

    const message = a2hsManager.getPlatform() === 'ios'
      ? t('pwa.install.toast.iosMessage')
      : t('pwa.install.toast.message')

    showToast(message, 'info', TOAST_DURATION_MS, {
      label: t('pwa.install.toast.action'),
      onClick: handleInstall,
    })
  }, [handleInstall, showToast, t])

  return null
}
