import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kana Drop - Hiragana & Katakana Learning Game',
  description: 'Learn hiragana and katakana through a fun falling-character game. Test your kana recognition skills with this addictive Japanese learning game. Play free online.',
  keywords: [
    'kana drop game',
    'hiragana game',
    'katakana game',
    'Japanese character game',
    'learn hiragana game',
    'learn katakana game',
    'kana recognition game',
    'Japanese alphabet game',
    'falling character game',
  ],
  openGraph: {
    title: 'Kana Drop - Hiragana & Katakana Learning Game',
    description: 'Learn hiragana and katakana through a fun falling-character game',
    url: 'https://moshimoshi.app/games/kana-drop',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/games/kana-drop',
  },
}

export default function KanaDropLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
