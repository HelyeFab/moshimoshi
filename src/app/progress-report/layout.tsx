import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Progress Report - Japanese Learning Dashboard & Insights',
  description: 'View comprehensive Japanese learning progress reports. Weekly and monthly analytics, vocabulary retention rates, kanji mastery levels, shadowing hours, and JLPT readiness assessment.',
  keywords: [
    'Japanese progress report',
    'learning dashboard Japanese',
    'Japanese study insights',
    'weekly progress tracking',
    'vocabulary retention report',
    'kanji mastery report',
    'JLPT readiness assessment',
    'Japanese learning analytics',
    'study progress visualization',
    'learning insights dashboard',
  ],
  openGraph: {
    title: 'Progress Report - Japanese Learning Dashboard & Insights',
    description: 'View comprehensive progress reports with analytics, retention rates, and JLPT readiness',
    url: 'https://moshimoshi.app/progress-report',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/progress-report',
  },
}

export default function ProgressReportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
