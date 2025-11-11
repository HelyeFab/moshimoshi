import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Learning Games - Fun Educational Games for Japanese',
  description: 'Master Japanese through engaging games: Kana Drop, Kanji Simon, Reading Routes, Sentence Scramble & Stroke Order practice. Make learning Japanese fun and effective.',
  keywords: [
    'Japanese learning games',
    'Japanese language games',
    'learn Japanese games',
    'Japanese educational games',
    'kanji games',
    'hiragana games',
    'Japanese practice games',
    'fun Japanese learning',
    'interactive Japanese games',
    'Japanese study games',
  ],
  openGraph: {
    title: 'Japanese Learning Games - Fun Educational Games',
    description: 'Master Japanese through engaging games: Kana Drop, Kanji Simon, Reading Routes & more',
    url: 'https://moshimoshi.app/games',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/games',
  },
}

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
