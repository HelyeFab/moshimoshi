import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Word Learning System - Vocabulary Mastery Program',
  description: 'Master Japanese vocabulary with intelligent word learning system. Learn new words with context, mnemonics, example sentences, and audio pronunciation. Structured vocabulary acquisition for all JLPT levels.',
  keywords: [
    'Japanese word learning',
    'vocabulary learning system',
    'learn Japanese words',
    'Japanese vocabulary program',
    'word mastery Japanese',
    'vocabulary acquisition',
    'learn Japanese vocabulary',
    'Japanese word study',
    'vocabulary learning method',
    'Japanese words with context',
  ],
  openGraph: {
    title: 'Japanese Word Learning System - Vocabulary Mastery Program',
    description: 'Master Japanese vocabulary with intelligent word learning system and structured practice',
    url: 'https://moshimoshi.app/learn/word-learning',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/learn/word-learning',
  },
}

export default function WordLearningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
