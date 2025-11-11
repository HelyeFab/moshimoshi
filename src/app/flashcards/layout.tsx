import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese SRS Flashcards - Smart Spaced Repetition System',
  description: 'Master Japanese with intelligent SRS flashcards. Advanced spaced repetition algorithm for vocabulary, kanji, and grammar. The best Anki alternative for Japanese learners.',
  keywords: [
    'Japanese flashcards',
    'SRS flashcards',
    'Anki alternative',
    'spaced repetition flashcards',
    'Japanese vocabulary flashcards',
    'kanji flashcards',
    'smart flashcards Japanese',
    'Japanese SRS app',
    'intelligent flashcards',
    'Japanese memory retention',
  ],
  openGraph: {
    title: 'Japanese SRS Flashcards - Smart Spaced Repetition System',
    description: 'Master Japanese with intelligent SRS flashcards and advanced spaced repetition',
    url: 'https://moshimoshi.app/flashcards',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/flashcards',
  },
}

export default function FlashcardsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
