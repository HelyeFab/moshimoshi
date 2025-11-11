import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Connection System - Visual Patterns, Families & Component Analysis',
  description: 'Revolutionary kanji learning system connecting 2136 jōyō kanji through visual patterns, phonetic components, semantic radicals, and family relationships. Discover kanji etymology, component analysis, and grapheme connections. Learn kanji faster by understanding how characters relate through shared components and visual patterns.',
  keywords: [
    'kanji connection system',
    'kanji visual patterns',
    'kanji families',
    'kanji component analysis',
    'phonetic components kanji',
    'semantic radicals',
    'kanji relationships',
    'kanji etymology',
    'kanji grapheme analysis',
    'visual kanji learning',
    'kanji pattern recognition',
    'kanji component system',
    'related kanji finder',
    'kanji network visualization',
    'kanji structure analysis',
  ],
  openGraph: {
    title: 'Kanji Connection System - Visual Patterns, Families & Component Analysis',
    description: 'Revolutionary system connecting 2136 kanji through visual patterns, phonetic components, and family relationships',
    url: 'https://moshimoshi.app/kanji-connection',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/kanji-connection',
  },
}

export default function KanjiConnectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
