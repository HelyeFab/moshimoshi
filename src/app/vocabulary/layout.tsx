import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Vocabulary - Learn Japanese Words & Phrases',
  description: 'Build your Japanese vocabulary with organized word lists, flashcards, and spaced repetition. Learn essential words, JLPT vocabulary, and common phrases.',
  keywords: [
    'Japanese vocabulary',
    'Japanese words',
    'learn Japanese words',
    'Japanese vocabulary list',
    'JLPT vocabulary',
    'Japanese phrases',
    'Japanese word flashcards',
    'vocabulary builder Japanese',
    'essential Japanese words',
    'common Japanese words',
  ],
  openGraph: {
    title: 'Japanese Vocabulary - Learn Japanese Words & Phrases',
    description: 'Build your Japanese vocabulary with organized word lists and spaced repetition',
    url: 'https://moshimoshi.app/vocabulary',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/vocabulary',
  },
}

export default function VocabularyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
