import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Learn Katakana - Interactive Japanese Katakana Practice',
  description: 'Master all 46 katakana characters with interactive flashcards, pronunciation guides, and practice exercises. Perfect for foreign words and names. Free katakana learning tool.',
  keywords: [
    'learn katakana',
    'katakana practice',
    'katakana flashcards',
    'Japanese katakana',
    'katakana chart',
    'katakana pronunciation',
    'katakana for beginners',
    'katakana writing practice',
    'Japanese alphabet katakana',
    'foreign words Japanese',
  ],
  openGraph: {
    title: 'Learn Katakana - Interactive Practice',
    description: 'Master all 46 katakana characters with interactive flashcards and exercises',
    url: 'https://moshimoshi.app/learn/katakana',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/learn/katakana',
  },
}

export default function KatakanaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
