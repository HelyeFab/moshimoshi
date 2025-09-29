'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

interface Props {
  kanji: string
  difficulty: Difficulty
  correctStrokes: number[]
  showHint: boolean
  onStrokeClick: (strokeIndex: number, totalStrokes: number) => void
  lastClickedStroke: number | null
  isCorrect: boolean | null
}

export default function StrokeGuides({
  kanji,
  difficulty,
  correctStrokes,
  showHint,
  onStrokeClick,
  lastClickedStroke,
  isCorrect,
}: Props) {
  const [, setSvgContent] = useState<string | null>(null)
  const [strokePaths, setStrokePaths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadKanjiData()
  }, [kanji])

  const loadKanjiData = async () => {
    if (!kanji) {
      setLoading(false)
      setError('No kanji selected')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get the Unicode code point
      const codePoint = kanji.charCodeAt(0).toString(16).padStart(5, '0')
      const response = await fetch(`/data/kanjivg/${codePoint}.svg`)

      if (!response.ok) {
        throw new Error('Kanji data not found')
      }

      const svgText = await response.text()
      setSvgContent(svgText)

      // Parse the SVG to extract stroke paths
      const parser = new DOMParser()
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml')
      // Select only the stroke paths (those with IDs starting with 'kvg:' and ending with '-s' followed by a number)
      const paths = svgDoc.querySelectorAll('path[id^="kvg:"][id*="-s"]')
      const pathData = Array.from(paths).map(path => path.getAttribute('d') || '')

      setStrokePaths(pathData)
    } catch (err) {
      setError('Failed to load kanji data')
      console.error('Error loading kanji:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-80 h-80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error || strokePaths.length === 0) {
    return (
      <div className="w-80 h-80 flex items-center justify-center text-muted-foreground">
        <p>Unable to load stroke data</p>
      </div>
    )
  }

  const getStrokeColor = (index: number) => {
    if (correctStrokes.includes(index)) {
      return '#10b981' // Green for completed
    }
    if (lastClickedStroke === index) {
      return isCorrect ? '#10b981' : '#ef4444' // Green or red for feedback
    }
    if (showHint && index === correctStrokes.length) {
      return 'var(--palette-primary-500)' // Primary color for hint
    }
    return '#9ca3af' // Gray for incomplete
  }

  const shouldShowNumbers = difficulty === 'easy' || difficulty === 'medium'
  const shouldShowAllStrokes = difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard'

  return (
    <div className="relative w-80 h-80 mx-auto cursor-pointer select-none">
      <svg
        viewBox="0 0 109 109"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background guide box */}
        <rect
          x="0"
          y="0"
          width="109"
          height="109"
          fill="none"
          stroke="rgb(229, 231, 235)"
          strokeWidth="1"
        />
        <line
          x1="54.5"
          y1="0"
          x2="54.5"
          y2="109"
          stroke="rgb(229, 231, 235)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
        <line
          x1="0"
          y1="54.5"
          x2="109"
          y2="54.5"
          stroke="rgb(229, 231, 235)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />

        {/* Render strokes */}
        {strokePaths.map((path, index) => {
          const isCompleted = correctStrokes.includes(index)
          const isNext = index === correctStrokes.length
          const isClickable = !isCompleted && (shouldShowAllStrokes || isNext || showHint)
          const isAnimating = lastClickedStroke === index

          // Only show if it should be visible
          if (!shouldShowAllStrokes && !isCompleted && !isNext && !showHint) {
            return null
          }

          return (
            <g key={index}>
              <motion.path
                d={path}
                fill="none"
                stroke={getStrokeColor(index)}
                strokeWidth={isCompleted ? 4 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={
                  isCompleted
                    ? 1
                    : isNext || showHint
                    ? 0.8
                    : shouldShowAllStrokes
                    ? 0.3
                    : 0
                }
                style={{
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => isClickable && onStrokeClick(index, strokePaths.length)}
                whileHover={
                  isClickable
                    ? {
                        strokeWidth: 5,
                        opacity: 1,
                      }
                    : undefined
                }
                initial={isAnimating ? { scale: 1 } : false}
                animate={
                  isAnimating
                    ? isCorrect
                      ? { scale: [1, 1.2, 1] }
                      : { x: [0, -5, 5, -5, 5, 0] }
                    : {}
                }
                transition={{ duration: 0.5 }}
              />

              {/* Stroke numbers */}
              {shouldShowNumbers && !isCompleted && shouldShowAllStrokes && (
                <text
                  x={getStrokeNumberPosition(path).x}
                  y={getStrokeNumberPosition(path).y}
                  fill="var(--palette-primary-600)"
                  fontSize="12"
                  fontWeight="bold"
                  pointerEvents="none"
                  className="select-none"
                >
                  {index + 1}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Helper function to find a good position for stroke numbers
function getStrokeNumberPosition(pathData: string) {
  // Extract the first move command coordinates
  const match = pathData.match(/M\s*(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/)
  if (match) {
    return {
      x: parseFloat(match[1]) - 5,
      y: parseFloat(match[2]) - 5,
    }
  }
  return { x: 10, y: 10 }
}