'use client'

import { useI18n } from '@/i18n/I18nContext'

interface ReadingReferenceCellProps {
  onyomi: string[]
  kunyomi: string[]
}

export default function ReadingReferenceCell({
  onyomi,
  kunyomi,
}: ReadingReferenceCellProps) {
  const { t } = useI18n()

  return (
    <div className="w-full flex flex-col items-center justify-center bg-amber-50 dark:bg-amber-900/20 rounded-lg border-2 border-amber-200 dark:border-amber-800/50 px-2 py-2 min-h-[60px] overflow-hidden">
      {onyomi.length > 0 && (
        <div className="text-center w-full mb-1">
          <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">
            {t('kanjiMasteryTool.drawingApproach.onyomi')}
          </span>
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
            {onyomi.join(', ')}
          </p>
        </div>
      )}
      {kunyomi.length > 0 && (
        <div className="text-center w-full">
          <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">
            {t('kanjiMasteryTool.drawingApproach.kunyomi')}
          </span>
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
            {kunyomi.join(', ')}
          </p>
        </div>
      )}
      {onyomi.length === 0 && kunyomi.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">-</p>
      )}
    </div>
  )
}
