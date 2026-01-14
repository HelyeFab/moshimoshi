'use client'

import { useCallback } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { a2hsManager } from '@/lib/pwa/a2hs'
import PageHeader from '@/components/ui/PageHeader'
import Navbar from '@/components/layout/Navbar'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useAuth } from '@/hooks/useAuth'

const SESSION_TOAST_KEY = 'pwa_install_toast_shown'
const STORAGE_KEYS = [
  'pwa_install_dismissed',
  'pwa_last_prompt',
  'pwa_installed',
  'pwa_visit_count',
]

export default function TestInstallToastPage() {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { user } = useAuth()

  const handleShowToast = useCallback(() => {
    const message = a2hsManager.getPlatform() === 'ios'
      ? t('pwa.install.toast.iosMessage')
      : t('pwa.install.toast.message')

    showToast(message, 'info', 8000, {
      label: t('pwa.install.toast.action'),
      onClick: () => {
        if (typeof window === 'undefined') return
        window.dispatchEvent(new CustomEvent('pwa:install-request'))
      }
    })
  }, [showToast, t])

  const handleReset = useCallback(() => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(SESSION_TOAST_KEY)
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    showToast(t('pwa.install.toastTest.resetSuccess'), 'success', 4000)
  }, [showToast, t])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={t('pwa.install.toastTest.title')}
        description={t('pwa.install.toastTest.description')}
        backHref="/dashboard"
      />

      <div className="container mx-auto px-4 pb-10">
        <div className="max-w-xl space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('pwa.install.toastTest.note')}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleShowToast}
              className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              {t('pwa.install.toastTest.showButton')}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('pwa.install.toastTest.resetButton')}
            </button>
          </div>
        </div>
      </div>

      <MobileNavSpacer />
    </div>
  )
}
