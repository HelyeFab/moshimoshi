import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Families - Learn Related Kanji Groups & Character Clusters',
  description: 'Explore kanji families and character groups sharing phonetic components, semantic meanings, or visual patterns. Master kanji faster by learning related characters together. Discover phono-semantic compound families and keisei character relationships across all JLPT levels.',
  keywords: [
    'kanji families',
    'related kanji groups',
    'kanji character clusters',
    'phonetic kanji families',
    'semantic kanji groups',
    'keisei characters',
    'phono-semantic compounds',
    'kanji family relationships',
    'grouped kanji learning',
    'kanji family system',
    'related character learning',
    'kanji cluster analysis',
    'character family patterns',
    'kanji phonetic series',
  ],
  openGraph: {
    title: 'Kanji Families - Learn Related Kanji Groups & Character Clusters',
    description: 'Master kanji faster by learning related character families and phonetic groups together',
    url: 'https://moshimoshi.app/kanji-connection/families',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/kanji-connection/families',
  },
}

export default function KanjiFamiliesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
