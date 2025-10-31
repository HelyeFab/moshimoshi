import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Learning Achievements - Track Your Progress & Milestones',
  description: 'Unlock achievements and track Japanese learning milestones. Earn badges for kanji mastery, vocabulary progress, and study streaks. Visual progress tracking and motivation system.',
  keywords: [
    'Japanese learning achievements',
    'language learning badges',
    'Japanese progress tracking',
    'study milestones',
    'Japanese learning motivation',
    'achievement system',
    'gamified progress tracking',
    'Japanese study badges',
    'learning milestones Japanese',
    'progress rewards',
  ],
  openGraph: {
    title: 'Japanese Learning Achievements - Track Your Progress & Milestones',
    description: 'Unlock achievements and track your Japanese learning progress with badges and milestones',
    url: 'https://moshimoshi.app/achievements',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/achievements',
  },
}

export default function AchievementsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
