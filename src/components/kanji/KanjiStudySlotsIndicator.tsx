'use client'

interface KanjiStudySlotsStatus {
  plan: string
  unlockedCount: number
  remaining: number
  limit: number
  isUnlimited: boolean
  canStudy: boolean
}

interface KanjiStudySlotsIndicatorProps {
  status: KanjiStudySlotsStatus | null
  loading?: boolean
  compact?: boolean
  title: string
  helper: string
  guestMessage: string
  unlimitedLabel: string
  unlockedLabel: string
  remainingLabel: string
  usedLabel: string
}

export default function KanjiStudySlotsIndicator({
  status,
  loading = false,
  compact = false,
  title,
  helper,
  guestMessage,
  unlimitedLabel,
  unlockedLabel,
  remainingLabel,
  usedLabel,
}: KanjiStudySlotsIndicatorProps) {
  if (compact) {
    if (loading) {
      return <div className="h-9 w-36 animate-pulse rounded-full bg-green-200/60 dark:bg-green-900/30" />
    }

    if (!status) return null

    const isGuest = status.plan === 'guest' || !status.canStudy
    const label = isGuest
      ? guestMessage
      : status.isUnlimited
        ? unlimitedLabel
        : `${status.unlockedCount}/${status.limit}`

    return (
      <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-green-300 bg-green-100/80 px-3 py-1.5 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
        <span
          className={
            status.isUnlimited
              ? 'truncate text-xs font-semibold uppercase tracking-wide'
              : isGuest
                ? 'truncate text-xs font-semibold'
                : 'truncate text-sm font-bold leading-none tabular-nums'
          }
        >
          {label}
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-xl border border-primary-200 bg-white/95 p-4 shadow-sm dark:border-primary-900/50 dark:bg-dark-800/95">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-dark-600" />
        <div className="mt-3 h-3 w-56 animate-pulse rounded bg-gray-200 dark:bg-dark-600" />
      </div>
    )
  }

  if (!status) return null

  const isGuest = status.plan === 'guest' || !status.canStudy
  const progressPercent =
    !status.isUnlimited && status.limit > 0
      ? Math.min(100, Math.round((status.unlockedCount / status.limit) * 100))
      : 0

  return (
    <div className="mb-6 rounded-xl border border-primary-200 bg-white/95 p-4 shadow-sm dark:border-primary-900/50 dark:bg-dark-800/95">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
            {title}
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isGuest ? guestMessage : helper}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status.isUnlimited ? (
            <div className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {unlimitedLabel}
            </div>
          ) : (
            <div className="min-w-[120px] text-right">
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {status.unlockedCount} / {status.limit}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{unlockedLabel}</div>
            </div>
          )}
        </div>
      </div>

      {!isGuest && !status.isUnlimited && status.limit > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
            <span>{status.remaining} {remainingLabel}</span>
            <span>{progressPercent}% {usedLabel}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-green-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
