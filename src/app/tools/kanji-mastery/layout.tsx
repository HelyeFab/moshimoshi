import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Mastery Tool - Progressive Learning System for 2136 Jōyō Kanji',
  description: 'Master all 2136 jōyō kanji with progressive learning system. Intelligent algorithm adapts to your level, tracks mastery progress, and optimizes review scheduling. Complete kanji mastery from JLPT N5 to N1 with smart study sessions.',
  keywords: [
    'kanji mastery system',
    'progressive kanji learning',
    'jōyō kanji mastery',
    '2136 kanji learning',
    'intelligent kanji study',
    'kanji mastery tool',
    'adaptive kanji learning',
    'kanji progress tracking',
    'complete kanji mastery',
    'smart kanji study',
    'kanji learning algorithm',
    'systematic kanji learning',
  ],
  openGraph: {
    title: 'Kanji Mastery Tool - Progressive Learning System for 2136 Jōyō Kanji',
    description: 'Master all 2136 jōyō kanji with intelligent progressive learning and adaptive algorithm',
    url: 'https://moshimoshi.app/tools/kanji-mastery',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/tools/kanji-mastery',
  },
}

export default function KanjiMasteryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
