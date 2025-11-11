import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reading Routes - Japanese Reading Practice Game',
  description: 'Improve your Japanese reading skills with this path-finding game. Practice kanji and kana recognition while navigating through challenging routes. Make reading fun.',
  keywords: [
    'Japanese reading game',
    'kanji reading practice',
    'Japanese reading comprehension',
    'reading practice game',
    'kanji reading game',
    'learn Japanese reading',
    'reading comprehension Japanese',
    'Japanese path game',
  ],
  openGraph: {
    title: 'Reading Routes - Japanese Reading Practice Game',
    description: 'Improve your Japanese reading skills with this engaging path-finding game',
    url: 'https://moshimoshi.app/games/reading-routes',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/games/reading-routes',
  },
}

export default function ReadingRoutesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
