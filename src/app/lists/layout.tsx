import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Custom Japanese Study Lists - Personalized Vocabulary & Kanji',
  description: 'Create custom Japanese study lists for vocabulary, kanji, and grammar. Organize your learning materials, share lists with others, and track progress. Personalized Japanese learning.',
  keywords: [
    'Japanese study lists',
    'custom vocabulary lists',
    'Japanese kanji lists',
    'personalized Japanese learning',
    'vocabulary organization',
    'Japanese study planner',
    'custom flashcard lists',
    'organized Japanese study',
    'JLPT study lists',
    'Japanese learning organization',
  ],
  openGraph: {
    title: 'Custom Japanese Study Lists - Personalized Vocabulary & Kanji',
    description: 'Create and organize custom Japanese study lists for vocabulary, kanji, and grammar',
    url: 'https://moshimoshi.app/lists',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/lists',
  },
}

export default function ListsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
