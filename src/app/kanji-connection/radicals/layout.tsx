import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Radicals - 214 Radicals, Semantic Components & Bushu System',
  description: 'Complete kanji radical reference with 214 traditional radicals (bushu). Search kanji by radical, understand semantic components, and learn radical meanings. Visual radical index with frequency analysis, stroke count, and component position. Master the foundation of kanji structure and character lookup.',
  keywords: [
    'kanji radicals',
    '214 kanji radicals',
    'bushu system',
    'radical search kanji',
    'semantic radicals',
    'kanji radical meanings',
    'radical index',
    'kanji components',
    'radical frequency',
    'radical stroke count',
    'kanji radical lookup',
    'traditional radicals',
    'radical position kanji',
    'bushu dictionary',
    'radical component analysis',
  ],
  openGraph: {
    title: 'Kanji Radicals - 214 Radicals, Semantic Components & Bushu System',
    description: 'Complete kanji radical reference with search, meanings, and visual index of all 214 radicals',
    url: 'https://moshimoshi.app/kanji-connection/radicals',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/kanji-connection/radicals',
  },
}

export default function KanjiRadicalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
