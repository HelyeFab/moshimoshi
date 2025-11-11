import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Study Goals - Set Japanese Learning Objectives & Milestones',
  description: 'Set and track Japanese study goals. Create JLPT preparation targets, daily review objectives, vocabulary milestones, and shadowing practice goals. Stay motivated with progress tracking.',
  keywords: [
    'Japanese study goals',
    'learning objectives Japanese',
    'JLPT preparation goals',
    'daily study targets',
    'vocabulary goals',
    'Japanese learning milestones',
    'study goal tracking',
    'language learning objectives',
    'Japanese practice targets',
    'motivational goal setting',
  ],
  openGraph: {
    title: 'Study Goals - Set Japanese Learning Objectives & Milestones',
    description: 'Set and track Japanese study goals with JLPT targets and daily objectives',
    url: 'https://moshimoshi.app/study-goals',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/study-goals',
  },
}

export default function StudyGoalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
