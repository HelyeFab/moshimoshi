'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { ArrowLeft } from 'lucide-react'
import { kanjiService } from '@/services/kanjiService'
import SimpleDrawingCanvas from '@/components/drawing-practice/SimpleDrawingCanvas'
import StrokeBuildup from '@/components/drawing-practice/StrokeBuildup'
import type { Kanji } from '@/types/kanji'

interface DrawingPracticeSheetProps {
  kanji: Kanji
  onBack: () => void
}

const TOTAL_CELLS = 12

export default function DrawingPracticeSheet({ kanji, onBack }: DrawingPracticeSheetProps) {
  const { t } = useI18n()
  const [svgData, setSvgData] = useState<string | null>(null)
  const [loadingSvg, setLoadingSvg] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingSvg(true)

    kanjiService.getStrokeOrderSVG(kanji.kanji).then(svg => {
      if (!cancelled) {
        setSvgData(svg)
        setLoadingSvg(false)
      }
    }).catch(() => {
      if (!cancelled) setLoadingSvg(false)
    })

    return () => { cancelled = true }
  }, [kanji.kanji])

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('kanjiMasteryTool.drawingApproach.backToSelection')}
      </button>

      {/* Kanji info card */}
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-start gap-6">
          {/* Large kanji character */}
          <div className="flex-shrink-0 w-28 h-28 bg-gray-50 dark:bg-dark-700 rounded-xl flex items-center justify-center border border-gray-200 dark:border-dark-600">
            <span className="text-7xl font-serif text-gray-900 dark:text-gray-100">{kanji.kanji}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {kanji.meaning}
            </h2>
            <div className="space-y-1 text-sm">
              {kanji.onyomi.length > 0 && (
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t('kanjiMasteryTool.drawingApproach.onyomi')}:
                  </span>{' '}
                  {kanji.onyomi.join(', ')}
                </p>
              )}
              {kanji.kunyomi.length > 0 && (
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t('kanjiMasteryTool.drawingApproach.kunyomi')}:
                  </span>{' '}
                  {kanji.kunyomi.join(', ')}
                </p>
              )}
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {t('kanjiMasteryTool.drawingApproach.strokes')}:
                </span>{' '}
                {kanji.strokeCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stroke buildup */}
      {loadingSvg ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('kanjiMasteryTool.drawingApproach.loadingSvg')}
        </div>
      ) : svgData ? (
        <StrokeBuildup svgData={svgData} totalStrokes={kanji.strokeCount} />
      ) : (
        <div className="text-sm text-gray-400 dark:text-gray-500 italic">
          {t('kanjiMasteryTool.drawingApproach.unavailable')}
        </div>
      )}

      {/* Practice grid: 12 drawing cells each followed by a reading cell */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('kanjiMasteryTool.drawingApproach.practiceSheetTitle')} — {TOTAL_CELLS} {t('kanjiMasteryTool.drawingApproach.drawingCell')}
        </h3>

        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: TOTAL_CELLS }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              {/* Cell label */}
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {i + 1}/{TOTAL_CELLS}
              </span>

              {/* Drawing canvas - shows readings after drawing */}
              <SimpleDrawingCanvas
                width={120}
                height={120}
                ghostSVG={svgData ?? undefined}
                showGhost={i === 0}
                onyomi={kanji.onyomi}
                kunyomi={kanji.kunyomi}
                expectedStrokes={kanji.strokeCount}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
