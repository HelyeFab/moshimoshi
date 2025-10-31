import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Word Learning Session - Active Vocabulary Practice',
  description: 'Active Japanese vocabulary learning session. Learn new words with context, mnemonics, example sentences, and audio pronunciation. Structured word acquisition practice.',
  keywords: [
    'Japanese word session',
    'vocabulary learning session',
    'active word practice',
    'Japanese vocabulary session',
    'word learning practice',
  ],
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/learn/word-learning/session',
  },
}

export default function WordLearningSessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
