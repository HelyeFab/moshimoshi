 'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GrammarPoint } from '@/lib/grammar/types'

interface RelatedPointsProps {
  pointIds: string[]
  locale: string
  level?: string
}

export function RelatedPoints({ pointIds, locale, level = 'n5' }: RelatedPointsProps) {
  const [relatedPoints, setRelatedPoints] = useState<GrammarPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadRelated = async () => {
      try {
        const responses = await Promise.all(
          pointIds.map((id) => fetch(`/data/grammar/points/${level}/${id}.json`))
        )
        const json = await Promise.all(
          responses.map(async (response, index) => {
            if (!response.ok) {
              throw new Error(`Failed to load related point ${pointIds[index]}`)
            }
            return response.json() as Promise<GrammarPoint>
          })
        )
        if (isMounted) {
          setRelatedPoints(json)
        }
      } catch (error) {
        if (isMounted) {
          setRelatedPoints([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    if (pointIds.length > 0) {
      loadRelated()
    } else {
      setLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [pointIds, level])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {loading
        ? [...Array(Math.min(4, Math.max(pointIds.length, 1)))].map((_, index) => (
            <div
              key={`related-skeleton-${index}`}
              className="h-20 bg-gray-100 dark:bg-dark-700/60 rounded-lg border border-gray-200 dark:border-dark-600 animate-pulse"
            />
          ))
        : relatedPoints.map((point) => (
            <Link
              key={point.id}
              href={`/${locale}/learn/grammar/${point.id}`}
              className="block p-4 bg-gray-50 dark:bg-dark-700 rounded-lg border border-gray-200 dark:border-dark-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-dark-600 transition-colors"
            >
              <div className="font-bold text-gray-900 dark:text-gray-100">
                {point.title.ja}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {point.title.en}
              </div>
            </Link>
          ))}
    </div>
  )
}
