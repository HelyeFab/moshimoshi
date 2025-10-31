import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Study Timer - Pomodoro Timer for Focused Learning',
  description: 'Stay focused with Japanese study timer. Pomodoro technique for vocabulary, kanji, and shadowing practice. Track study sessions, manage breaks, and maximize learning efficiency.',
  keywords: [
    'Japanese study timer',
    'pomodoro Japanese learning',
    'focused study timer',
    'Japanese learning pomodoro',
    'study session tracker',
    'language learning timer',
    'Japanese study time management',
    'focused Japanese practice',
    'productivity timer Japanese',
    'study break management',
  ],
  openGraph: {
    title: 'Japanese Study Timer - Pomodoro Timer for Focused Learning',
    description: 'Stay focused with Japanese study timer using pomodoro technique for maximum efficiency',
    url: 'https://moshimoshi.app/study-timer',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/study-timer',
  },
}

export default function StudyTimerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
