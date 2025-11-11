import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Simon - Memory Game for Learning Kanji',
  description: 'Master kanji recognition with this memory-based learning game. Follow the pattern, remember kanji sequences, and improve your Japanese character recall. Play free online.',
  keywords: [
    'kanji memory game',
    'kanji learning game',
    'kanji recognition game',
    'Japanese memory game',
    'learn kanji game',
    'kanji practice game',
    'remember kanji',
    'kanji recall game',
    'Japanese character memory',
  ],
  openGraph: {
    title: 'Kanji Simon - Memory Game for Learning Kanji',
    description: 'Master kanji recognition with this memory-based learning game',
    url: 'https://moshimoshi.app/games/kanji-simon',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/games/kanji-simon',
  },
}

export default function KanjiSimonLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
