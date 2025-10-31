import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profile - Track Your Japanese Learning Journey',
  description: 'View your Japanese learning profile. Track study streaks, JLPT progress, vocabulary mastery, kanji knowledge, and shadowing hours. Comprehensive learning statistics and achievements.',
  keywords: [
    'Japanese learning profile',
    'track Japanese progress',
    'Japanese study statistics',
    'learning journey tracker',
    'JLPT progress tracking',
    'vocabulary mastery tracker',
    'kanji knowledge profile',
    'study streak tracker',
    'Japanese learner profile',
    'language learning dashboard',
  ],
  openGraph: {
    title: 'Profile - Track Your Japanese Learning Journey',
    description: 'View comprehensive Japanese learning statistics, achievements, and progress tracking',
    url: 'https://moshimoshi.app/profile',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/profile',
  },
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
