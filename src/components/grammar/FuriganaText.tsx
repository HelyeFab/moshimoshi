'use client'

import { useEffect, useState } from 'react'
import { generateFuriganaWithCache } from '@/utils/furigana'

interface FuriganaTextProps {
  text: string
  showFurigana: boolean
  className?: string
  as?: 'span' | 'div'
}

export default function FuriganaText({
  text,
  showFurigana,
  className = '',
  as = 'span',
}: FuriganaTextProps) {
  const [furiganaHtml, setFuriganaHtml] = useState<string>(text)

  useEffect(() => {
    let isMounted = true

    const run = async () => {
      if (!showFurigana || !text) {
        if (isMounted) setFuriganaHtml(text)
        return
      }
      if (!/[\u4E00-\u9FAF]/.test(text)) {
        if (isMounted) setFuriganaHtml(text)
        return
      }
      try {
        const result = await generateFuriganaWithCache(text)
        if (isMounted) setFuriganaHtml(result)
      } catch {
        if (isMounted) setFuriganaHtml(text)
      }
    }

    run()

    return () => {
      isMounted = false
    }
  }, [text, showFurigana])

  const Component = as

  if (!showFurigana) {
    return <Component className={className}>{text}</Component>
  }

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: furiganaHtml }}
    />
  )
}
