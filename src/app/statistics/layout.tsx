import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Learning Statistics - Detailed Analytics & Progress Charts',
  description: 'Analyze your Japanese learning with detailed statistics. Track review accuracy, study time, vocabulary growth, kanji retention, and shadowing progress. Data-driven insights for better learning.',
  keywords: [
    'Japanese learning statistics',
    'Japanese study analytics',
    'learning progress charts',
    'vocabulary growth tracking',
    'kanji retention statistics',
    'study time analytics',
    'review accuracy tracking',
    'Japanese learning insights',
    'language learning analytics',
    'progress visualization',
  ],
  openGraph: {
    title: 'Japanese Learning Statistics - Detailed Analytics & Progress Charts',
    description: 'Analyze your Japanese learning with detailed statistics, charts, and data-driven insights',
    url: 'https://moshimoshi.app/statistics',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/statistics',
  },
}

export default function StatisticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
