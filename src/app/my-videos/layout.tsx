import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Shadowing Videos - Saved Japanese Practice History',
  description: 'Access your saved Japanese shadowing videos and practice history. Track YouTube videos you\'ve practiced with, resume shadowing sessions, and monitor listening comprehension progress. Personal library of Japanese learning videos.',
  keywords: [
    'my shadowing videos',
    'saved Japanese videos',
    'YouTube practice history',
    'shadowing session history',
    'Japanese listening history',
    'video bookmarks Japanese',
    'practice video library',
    'shadowing progress tracker',
    'saved practice videos',
    'Japanese video history',
  ],
  openGraph: {
    title: 'My Shadowing Videos - Saved Japanese Practice History',
    description: 'Access your saved shadowing videos and track Japanese listening practice history',
    url: 'https://moshimoshi.app/my-videos',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/my-videos',
  },
}

export default function MyVideosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
