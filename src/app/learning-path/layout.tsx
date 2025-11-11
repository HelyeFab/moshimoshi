import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Learning Path - Personalized JLPT Study Roadmap',
  description: 'Follow a personalized Japanese learning path from beginner to JLPT N1. Structured roadmap with kanji, vocabulary, grammar, and shadowing milestones. Adaptive curriculum based on your progress.',
  keywords: [
    'Japanese learning path',
    'JLPT study roadmap',
    'Japanese learning curriculum',
    'beginner to advanced Japanese',
    'personalized learning path',
    'Japanese study plan',
    'JLPT preparation roadmap',
    'structured Japanese learning',
    'adaptive Japanese curriculum',
    'Japanese learning journey',
  ],
  openGraph: {
    title: 'Japanese Learning Path - Personalized JLPT Study Roadmap',
    description: 'Follow a structured, personalized learning path from beginner to JLPT N1 mastery',
    url: 'https://moshimoshi.app/learning-path',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/learning-path',
  },
}

export default function LearningPathLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
