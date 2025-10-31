import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Learn Japanese Numbers - Counting & Number System Practice',
  description: 'Master Japanese numbers and counting systems. Learn native and Sino-Japanese numbers, counters, dates, time, and phone numbers. Interactive practice with audio pronunciation.',
  keywords: [
    'learn Japanese numbers',
    'Japanese counting system',
    'Japanese numbers practice',
    'counting in Japanese',
    'Japanese counters',
    'Japanese number system',
    'learn to count Japanese',
    'Japanese numbers audio',
    'Japanese dates and time',
    'Japanese phone numbers',
  ],
  openGraph: {
    title: 'Learn Japanese Numbers - Counting & Number System Practice',
    description: 'Master Japanese numbers, counting systems, and counters with interactive practice',
    url: 'https://moshimoshi.app/learn/numbers',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/learn/numbers',
  },
}

export default function NumbersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
