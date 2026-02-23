'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

interface DeckCreationQuotaBannerProps {
  current: number
  limit: number
  allow?: boolean
  className?: string
}

export function DeckCreationQuotaBanner({
  current,
  limit,
  allow = true,
  className,
}: DeckCreationQuotaBannerProps) {
  const { t } = useI18n()
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div
      aria-live="polite"
      className={cn(
        'rounded-lg border px-3 py-2 text-xs sm:text-sm',
        allow
          ? 'bg-soft-white dark:bg-dark-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
        className
      )}
    >
      <div className="font-medium">
        {t('flashcards.limits.deckCreationsMonthlyQuotaProgress', {
          current: Math.min(current, limit),
          limit,
        })}
      </div>
      <div className="opacity-80">{t('entitlements.limits.resetsNextMonth')}</div>
      <button
        type="button"
        aria-expanded={showHelp}
        onClick={() => setShowHelp(value => !value)}
        className={cn(
          'mt-2 text-left underline underline-offset-2 decoration-current/40 hover:decoration-current focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-sm',
          'text-[11px] sm:text-xs'
        )}
      >
        {t('flashcards.limits.deckCreationsMonthlyQuotaHelpToggle')}
      </button>
      {showHelp && (
        <p className="mt-2 text-[11px] sm:text-xs leading-relaxed opacity-90">
          {t('flashcards.limits.deckCreationsMonthlyQuotaHelpText')}
        </p>
      )}
    </div>
  )
}
