import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Popular Japanese Learning Videos - Trending YouTube Content for Shadowing',
  description: 'Discover trending Japanese learning videos perfect for shadowing practice. Most popular YouTube content from native speakers, Japanese dramas, and educational channels. Find viral Japanese videos for effective language learning.',
  keywords: [
    'popular Japanese learning videos',
    'trending Japanese YouTube',
    'best Japanese videos',
    'viral Japanese content',
    'popular Japanese YouTube channels',
    'trending Japanese lessons',
    'most watched Japanese videos',
    'popular shadowing videos',
    'Japanese YouTube trends',
    'best Japanese drama videos',
  ],
  openGraph: {
    title: 'Popular Japanese Learning Videos - Trending YouTube Content',
    description: 'Discover trending Japanese learning videos and popular YouTube content for shadowing practice',
    url: 'https://moshimoshi.app/popular-videos',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/popular-videos',
  },
}

export default function PopularVideosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
