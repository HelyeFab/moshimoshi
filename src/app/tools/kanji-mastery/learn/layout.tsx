import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Mastery Learning Session - Active Kanji Practice',
  description: 'Active kanji mastery learning session. Progressive kanji study with intelligent algorithm and adaptive difficulty. Master jōyō kanji systematically.',
  keywords: [
    'kanji learning session',
    'active kanji practice',
    'kanji mastery session',
    'progressive kanji study',
  ],
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/tools/kanji-mastery/learn',
  },
}

export default function KanjiMasteryLearnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
