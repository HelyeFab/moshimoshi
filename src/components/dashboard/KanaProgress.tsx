'use client'

import { useEffect, useState } from 'react'

interface KanaProgressProps {
  type: 'hiragana' | 'katakana' | 'combined'
}

export default function KanaProgress({ type }: KanaProgressProps) {
  const [progress, setProgress] = useState(0)
  
  useEffect(() => {
    // Read progress from localStorage
    if (typeof window !== 'undefined') {
      const savedProgress = localStorage.getItem('kana-progress')
      if (savedProgress) {
        try {
          const progressData = JSON.parse(savedProgress)
          const totalChars = 46 // Basic hiragana/katakana count
          const learned = Object.values(progressData).filter(
            (item: any) => item.status === 'learned'
          ).length
          setProgress(Math.round((learned / totalChars) * 100))
        } catch (e) {
          console.error('Failed to parse kana progress:', e)
        }
      }
    }
  }, [type])
  
  return progress
}