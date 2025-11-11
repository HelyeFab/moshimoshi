import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Session Complete - Japanese Word Learning',
  description: 'Vocabulary learning session completed. Review your progress and continue your Japanese learning journey.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/learn/word-learning/complete',
  },
}

export default function WordLearningCompleteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
