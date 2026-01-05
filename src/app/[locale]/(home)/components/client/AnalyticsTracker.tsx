'use client'

import { useEffect } from 'react'

export default function AnalyticsTracker() {
  useEffect(() => {
    // Check if this is a unique visitor
    const hasVisitedLanding = localStorage.getItem('visited_landing')
    const isUniqueVisitor = !hasVisitedLanding

    // Track landing page visit (anonymous - no auth required)
    fetch('/api/waitlist/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 'landing', isUniqueVisitor }),
    }).catch((err) => console.error('Failed to track visit:', err))

    // Mark as visited for future page loads
    if (isUniqueVisitor) {
      localStorage.setItem('visited_landing', 'true')
    }
  }, [])

  return null // This component renders nothing
}
