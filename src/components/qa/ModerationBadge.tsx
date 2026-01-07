'use client'

import { Clock, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

interface ModerationBadgeProps {
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  showIcon?: boolean
  size?: 'sm' | 'md'
}

/**
 * ModerationBadge Component
 * Shows moderation status with appropriate styling
 */
export default function ModerationBadge({
  status,
  reason,
  showIcon = true,
  size = 'md',
}: ModerationBadgeProps) {
  const { t } = useI18n()

  const config = {
    pending: {
      label: t('qa.moderation.pending'),
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    },
    approved: {
      label: t('qa.moderation.approved'),
      icon: CheckCircle,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    rejected: {
      label: t('qa.moderation.rejected'),
      icon: XCircle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
  }[status]

  const Icon = config.icon
  const sizeClass = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className="flex flex-col gap-1">
      <Badge
        variant="secondary"
        className={cn(
          'w-fit',
          sizeClass,
          config.className
        )}
      >
        <div className="flex items-center gap-1.5">
          {showIcon && <Icon className="w-3.5 h-3.5" />}
          <span>{config.label}</span>
        </div>
      </Badge>

      {/* Show rejection reason if available */}
      {status === 'rejected' && reason && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
          {t('qa.moderation.reason')}: {reason}
        </p>
      )}
    </div>
  )
}
