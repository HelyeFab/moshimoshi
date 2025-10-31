import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Textbook Vocabulary - Genki, Minna no Nihongo, Tobira Word Lists',
  description: 'Complete vocabulary lists for popular Japanese textbooks. Master Genki I & II, Minna no Nihongo 1 & 2 (50 lessons), Tobira, Japanese from Zero, and Marugoto vocabulary with SRS flashcards and audio. Perfect companion for classroom Japanese learning with all textbook words organized by lesson.',
  keywords: [
    'Genki vocabulary list',
    'Minna no Nihongo vocabulary',
    'Japanese textbook vocabulary',
    'Genki 1 word list',
    'Genki 2 vocabulary',
    'Minna no Nihongo 50 lessons',
    'Tobira vocabulary list',
    'Japanese from Zero vocabulary',
    'Marugoto word list',
    'textbook Japanese words',
    'Genki flashcards',
    'Minna no Nihongo flashcards',
    'Japanese classroom vocabulary',
    'textbook companion app',
    'Genki study companion',
  ],
  openGraph: {
    title: 'Japanese Textbook Vocabulary - Genki, Minna no Nihongo, Tobira',
    description: 'Complete vocabulary lists for Genki, Minna no Nihongo, and all major Japanese textbooks with SRS practice',
    url: 'https://moshimoshi.app/textbook-vocabulary',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/textbook-vocabulary',
  },
}

export default function TextbookVocabularyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
