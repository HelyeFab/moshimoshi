import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Sentence Scramble Game - Grammar Practice & Word Order',
  description: 'Practice Japanese grammar with sentence scramble game. Learn proper word order, particles, and sentence structure through interactive exercises. Fun way to master Japanese grammar patterns.',
  keywords: [
    'Japanese sentence game',
    'grammar practice game',
    'Japanese word order',
    'sentence scramble Japanese',
    'Japanese grammar game',
    'particle practice game',
    'Japanese sentence structure',
    'learn Japanese grammar game',
    'sentence building Japanese',
    'interactive grammar practice',
  ],
  openGraph: {
    title: 'Japanese Sentence Scramble Game - Grammar Practice & Word Order',
    description: 'Practice Japanese grammar and word order with interactive sentence scramble game',
    url: 'https://moshimoshi.app/games/sentence-scramble',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/games/sentence-scramble',
  },
}

export default function SentenceScrambleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
