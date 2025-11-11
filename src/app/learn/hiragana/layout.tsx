import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Learn Hiragana - Interactive Japanese Hiragana Practice',
  description: 'Master all 46 hiragana characters with interactive flashcards, pronunciation guides, and practice exercises. Free hiragana learning tool for beginners.',
  keywords: [
    'learn hiragana',
    'hiragana practice',
    'hiragana flashcards',
    'Japanese alphabet',
    'hiragana chart',
    'hiragana pronunciation',
    'hiragana for beginners',
    'hiragana writing practice',
    'Japanese kana',
  ],
  openGraph: {
    title: 'Learn Hiragana - Interactive Practice',
    description: 'Master all 46 hiragana characters with interactive flashcards and exercises',
    url: 'https://moshimoshi.app/learn/hiragana',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/learn/hiragana',
  },
}

export default function HiraganaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
