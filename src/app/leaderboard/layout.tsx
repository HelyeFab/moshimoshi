import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Learning Leaderboard - Gamified Language Competition',
  description: 'Compete with Japanese learners worldwide on our global leaderboard. Track rankings, earn achievements, and stay motivated through gamified learning. Join the competitive community.',
  keywords: [
    'Japanese learning leaderboard',
    'gamified Japanese learning',
    'competitive language learning',
    'Japanese learning rankings',
    'language learning competition',
    'gamification learning',
    'Japanese learner rankings',
    'motivational learning',
    'Japanese study competition',
    'language learning gamification',
  ],
  openGraph: {
    title: 'Japanese Learning Leaderboard - Gamified Language Competition',
    description: 'Compete with learners worldwide and track your Japanese learning progress on global leaderboard',
    url: 'https://moshimoshi.app/leaderboard',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/leaderboard',
  },
}

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
