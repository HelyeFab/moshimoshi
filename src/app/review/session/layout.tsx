import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Review Session - Active SRS Practice',
  description: 'Practice Japanese with active SRS review session. Review vocabulary, kanji, and grammar with intelligent spaced repetition. Optimize retention with smart scheduling algorithm.',
  keywords: [
    'Japanese review session',
    'SRS review practice',
    'Japanese flashcard review',
    'active recall Japanese',
    'spaced repetition session',
    'Japanese study session',
    'kanji review practice',
    'vocabulary review session',
  ],
  openGraph: {
    title: 'Japanese Review Session - Active SRS Practice',
    description: 'Practice Japanese with intelligent SRS review session and active recall',
    url: 'https://moshimoshi.app/review/session',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/review/session',
  },
}

export default function ReviewSessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
