import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Learning Dashboard - Track Your Progress',
  description: 'View your Japanese learning statistics, daily streaks, XP progress, and achievements. Access kanji browser, vocabulary review, and YouTube shadowing from one place.',
  keywords: [
    'Japanese learning dashboard',
    'Japanese progress tracker',
    'JLPT study tracker',
    'kanji progress',
    'Japanese learning statistics',
    'daily streak tracker',
    'Japanese XP system',
  ],
  openGraph: {
    title: 'Japanese Learning Dashboard',
    description: 'Track your Japanese learning progress, streaks, and achievements',
    url: 'https://moshimoshi.app/dashboard',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/dashboard',
  },
  robots: {
    index: false, // Don't index dashboard pages (user-specific content)
    follow: true,
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
