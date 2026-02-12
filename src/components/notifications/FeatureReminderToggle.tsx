'use client'

import { Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { deriveFeatureReminderKey, type FeatureReminderKey } from '@/lib/notifications/feature-reminders'
import { useFeatureReminderToggle } from '@/hooks/useFeatureReminderToggle'
import { useI18n } from '@/i18n/I18nContext'
import Tooltip from '@/components/ui/Tooltip'

interface FeatureReminderToggleProps {
  featureKey?: FeatureReminderKey
  className?: string
}

export default function FeatureReminderToggle({ featureKey, className = '' }: FeatureReminderToggleProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const resolvedFeatureKey = featureKey ?? deriveFeatureReminderKey(pathname)
  const { enabled, loading, isConfigured, canToggle, isGlobalDisabled, toggle } = useFeatureReminderToggle(resolvedFeatureKey)

  if (!resolvedFeatureKey || !isConfigured) {
    return null
  }

  const tooltipContent = isGlobalDisabled
    ? t('pwa.notifications.featureReminderToggle.tooltipDisabled')
    : t('pwa.notifications.featureReminderToggle.tooltip', {
        state: enabled
          ? t('pwa.notifications.featureReminderToggle.on')
          : t('pwa.notifications.featureReminderToggle.off'),
      })
  const isVisuallyEnabled = enabled && !isGlobalDisabled

  return (
    <div className={`inline-flex ${className}`}>
      <Tooltip content={tooltipContent}>
        <button
          type="button"
          onClick={toggle}
          disabled={loading || !canToggle}
          className={`inline-flex items-center justify-center p-2 rounded-full text-xs font-semibold transition-colors border ${
            isVisuallyEnabled
              ? 'bg-primary-500 text-white border-primary-500 hover:bg-primary-600'
              : 'bg-white/80 dark:bg-dark-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-dark-500 hover:bg-gray-100 dark:hover:bg-dark-600'
          } ${loading || !canToggle ? 'opacity-70 cursor-not-allowed' : ''}`}
          aria-pressed={isVisuallyEnabled}
          aria-label={t('pwa.notifications.featureReminderToggle.ariaLabel')}
        >
          <Bell className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  )
}
