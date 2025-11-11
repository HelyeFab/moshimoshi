import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'YouTube Shadowing - Learn Japanese with Videos',
  description: 'Practice Japanese pronunciation with YouTube shadowing. Synchronized transcripts, playback control & progress tracking. Improve listening & speaking skills.',
  keywords: [
    'YouTube shadowing',
    'Japanese listening practice',
    'learn Japanese with YouTube',
    'shadowing technique',
    'Japanese pronunciation',
    'Japanese video learning',
    'Japanese speaking practice',
    'Japanese language immersion',
  ],
  openGraph: {
    title: 'YouTube Shadowing - Learn Japanese with Videos',
    description: 'Practice Japanese pronunciation with YouTube shadowing. Synchronized transcripts and playback control.',
    url: 'https://moshimoshi.app/youtube-shadowing',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/youtube-shadowing',
  },
}

export default function YoutubeShadowingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
