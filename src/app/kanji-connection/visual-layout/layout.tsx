import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Visual Layout - Network Visualization & Pattern Recognition Map',
  description: 'Interactive visual network map of 2136 jōyō kanji connections. See kanji relationships through visual patterns, component sharing, and etymological links. Revolutionary spatial learning interface for visual learners. Explore kanji clusters and discover hidden connections through network visualization.',
  keywords: [
    'kanji visual layout',
    'kanji network visualization',
    'kanji map',
    'visual kanji connections',
    'kanji pattern recognition',
    'kanji network map',
    'spatial kanji learning',
    'kanji cluster visualization',
    'interactive kanji network',
    'visual kanji system',
    'kanji relationship map',
    'graphical kanji learning',
    'kanji connection visualization',
    'visual learning kanji',
  ],
  openGraph: {
    title: 'Kanji Visual Layout - Network Visualization & Pattern Recognition Map',
    description: 'Interactive visual network of 2136 kanji showing connections through patterns and components',
    url: 'https://moshimoshi.app/kanji-connection/visual-layout',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/kanji-connection/visual-layout',
  },
}

export default function VisualLayoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
