import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Moshimoshi - Best Japanese Learning App 2025',
  description: 'Discover Moshimoshi: The comprehensive Japanese learning platform with SRS flashcards, YouTube shadowing, JLPT preparation, kanji browser, and gamified practice. Built by Japanese learners, for learners.',
  keywords: [
    'about Moshimoshi',
    'best Japanese learning app',
    'Japanese learning platform',
    'comprehensive Japanese app',
    'Japanese learning features',
    'YouTube shadowing app',
    'SRS Japanese app',
    'JLPT preparation app',
    'Japanese learning software',
    'Moshimoshi features',
  ],
  openGraph: {
    title: 'About Moshimoshi - Best Japanese Learning App 2025',
    description: 'Comprehensive Japanese learning platform with SRS, YouTube shadowing, and JLPT preparation',
    url: 'https://moshimoshi.app/about',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/about',
  },
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
