'use client'

import { useMemo } from 'react'
import { useI18n } from '@/i18n/I18nContext'

interface StrokeBuildupProps {
  svgData: string
  totalStrokes: number
  cellSize?: number
}

export default function StrokeBuildup({ svgData, totalStrokes, cellSize = 80 }: StrokeBuildupProps) {
  const { t } = useI18n()

  const buildupSteps = useMemo(() => {
    if (!svgData || totalStrokes === 0) return []

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(svgData, 'image/svg+xml')

      // Extract stroke paths - KanjiVG uses IDs like kvg:XXXXX-sN
      const allPaths = Array.from(doc.querySelectorAll('path[id]'))
      const strokePaths = allPaths.filter(path => {
        const id = path.getAttribute('id') || ''
        return /kvg:[0-9a-f]+-s\d+/.test(id)
      })

      // If no stroke paths found via ID pattern, try all paths in stroke groups
      const paths = strokePaths.length > 0
        ? strokePaths
        : Array.from(doc.querySelectorAll('g[id*="StrokePaths"] path, g[id*="kvg"] path'))

      if (paths.length === 0) return []

      // Build progressive SVGs: step K shows strokes 1..K
      const steps: string[] = []
      for (let k = 1; k <= paths.length; k++) {
        const visiblePaths = paths.slice(0, k).map(p => {
          const d = p.getAttribute('d') || ''
          // Highlight the latest stroke in red, previous ones in black
          const color = p === paths[k - 1] ? '#e53e3e' : '#000000'
          return `<path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
        }).join('')

        steps.push(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109" width="${cellSize}" height="${cellSize}">${visiblePaths}</svg>`
        )
      }

      return steps
    } catch {
      return []
    }
  }, [svgData, totalStrokes, cellSize])

  if (buildupSteps.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t('kanjiMasteryTool.drawingApproach.strokeBuildup')}
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-dark-600">
        {buildupSteps.map((svgHtml, index) => (
          <div
            key={index}
            className="flex-shrink-0 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 p-1 relative"
          >
            <div dangerouslySetInnerHTML={{ __html: svgHtml }} />
            <span className="absolute bottom-0.5 right-1 text-[10px] text-gray-400 dark:text-gray-500">
              {index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
