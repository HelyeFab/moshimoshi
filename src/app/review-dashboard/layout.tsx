import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese SRS Review Dashboard - Spaced Repetition System',
  description: 'Intelligent spaced repetition system (SRS) for Japanese vocabulary, kanji & grammar. Track your review schedule, manage flashcards, and optimize your learning with proven SM-2 algorithm.',
  keywords: [
    'Japanese SRS',
    'spaced repetition Japanese',
    'Japanese review system',
    'SRS dashboard',
    'Japanese flashcard review',
    'Anki alternative',
    'spaced repetition app',
    'Japanese memory system',
  ],
  openGraph: {
    title: 'Japanese SRS Review Dashboard - Spaced Repetition System',
    description: 'Intelligent spaced repetition system for Japanese with proven SM-2 algorithm',
    url: 'https://moshimoshi.app/review-dashboard',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/review-dashboard',
  },
}

export default function ReviewDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
