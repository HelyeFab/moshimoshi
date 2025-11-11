import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Moodboards - Visual Kanji Learning & Memory Palace Method',
  description: 'Learn kanji through visual moodboards and spatial memory techniques. Create visual associations, mnemonic stories, and memory palaces for kanji. Revolutionary visual learning approach.',
  keywords: [
    'visual kanji learning',
    'kanji moodboard',
    'mnemonic kanji',
    'kanji visualization',
    'spatial memory kanji',
    'memory palace kanji',
    'visual kanji method',
    'kanji visual association',
    'creative kanji learning',
    'kanji imagery',
  ],
  openGraph: {
    title: 'Kanji Moodboards - Visual Kanji Learning & Memory Palace Method',
    description: 'Learn kanji through visual moodboards, mnemonics, and spatial memory techniques',
    url: 'https://moshimoshi.app/kanji-moods',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/kanji-moods',
  },
}

export default function KanjiMoodsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
