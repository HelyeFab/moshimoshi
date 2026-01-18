'use client'

import { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'

type PracticeLinkPrefetchProps = {
  href: string
  label: string
  pointId: string
  level: string
  className?: string
}

export default function PracticeLinkPrefetch({
  href,
  label,
  pointId,
  level,
  className,
}: PracticeLinkPrefetchProps) {
  const linkRef = useRef<HTMLAnchorElement | null>(null)

  const prefetchLite = useCallback(() => {
    fetch(`/data/grammar/exercises/${level}/${pointId}.lite.json`).catch(() => {})
  }, [level, pointId])

  useEffect(() => {
    const node = linkRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          prefetchLite()
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [prefetchLite])

  return (
    <Link
      ref={linkRef}
      href={href}
      onMouseEnter={prefetchLite}
      className={className}
    >
      {label}
    </Link>
  )
}
