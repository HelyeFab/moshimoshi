import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free Japanese Learning Resources - JLPT Materials & Study Guides',
  description: 'Access free Japanese learning resources, JLPT study materials, grammar guides, vocabulary lists, kanji references, and study tips. Comprehensive collection of Japanese learning materials for all levels.',
  keywords: [
    'free Japanese learning resources',
    'JLPT study materials',
    'Japanese learning guides',
    'free Japanese materials',
    'Japanese study resources',
    'JLPT resources free',
    'Japanese grammar resources',
    'kanji study materials',
    'Japanese learning downloads',
    'free Japanese textbooks',
  ],
  openGraph: {
    title: 'Free Japanese Learning Resources - JLPT Materials & Study Guides',
    description: 'Access free Japanese learning resources, JLPT materials, and comprehensive study guides',
    url: 'https://moshimoshi.app/resources',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/resources',
  },
}

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
