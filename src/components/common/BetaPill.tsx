'use client'

import React from 'react'
import Tooltip from '@/components/ui/Tooltip'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

interface BetaPillProps {
  className?: string
  tooltipClassName?: string
}

export default function BetaPill({ className = '', tooltipClassName = '' }: BetaPillProps) {
  const { t } = useI18n()

  const stopParentNavigation = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <Tooltip
      content={t('youtubeShadowing.beta.tooltip')}
      position="top"
      className={cn('max-w-[220px] text-center leading-snug', tooltipClassName)}
      clickable
    >
      <div
        onClick={stopParentNavigation}
        className={cn(
          'inline-flex cursor-help select-none items-center rounded-full border border-amber-300/80 bg-amber-100/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 shadow-sm dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-200',
          className
        )}
        aria-label={`${t('youtubeShadowing.beta.label')}: ${t('youtubeShadowing.beta.tooltip')}`}
      >
        {t('youtubeShadowing.beta.label')}
      </div>
    </Tooltip>
  )
}
