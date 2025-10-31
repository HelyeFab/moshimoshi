import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese YouTube Series - Learn Japanese with Drama & YouTube Shadowing',
  description: 'Master Japanese with authentic YouTube series and drama shadowing. Practice with native Japanese YouTube channels, improve listening comprehension, and perfect your accent through shadowing technique. Best Japanese series for learning.',
  keywords: [
    'Japanese YouTube series',
    'Japanese drama shadowing',
    'learn Japanese with YouTube',
    'Japanese YouTube channels learning',
    'Japanese series for learning',
    'YouTube shadowing Japanese',
    'shadowing technique YouTube',
    'Japanese drama for learning',
    'native Japanese YouTube',
    'Japanese listening practice YouTube',
    'best Japanese YouTube channels',
    'Japanese accent improvement',
    'phonetic shadowing Japanese',
    'Japanese drama series learning',
    'Japanese YouTube content',
  ],
  openGraph: {
    title: 'Japanese YouTube Series - Learn Japanese with Drama & YouTube Shadowing',
    description: 'Master Japanese with authentic YouTube series, drama shadowing, and native content from top Japanese channels',
    url: 'https://moshimoshi.app/youtube-series',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/youtube-series',
  },
}

export default function YouTubeSeriesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
