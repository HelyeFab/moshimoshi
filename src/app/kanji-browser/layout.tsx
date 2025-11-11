import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Kanji Browser - 2136 Jōyō Kanji by JLPT Level',
  description: 'Browse all JLPT kanji (N5-N1) with stroke order, readings, meanings & examples. Search by radical, stroke count, or meaning. Free kanji learning tool.',
  keywords: [
    'kanji browser',
    'JLPT kanji',
    'learn kanji',
    'kanji dictionary',
    'kanji stroke order',
    'N5 kanji',
    'N4 kanji',
    'N3 kanji',
    'N2 kanji',
    'N1 kanji',
    'joyo kanji',
    'kanji meanings',
    'kanji readings',
  ],
  openGraph: {
    title: 'Japanese Kanji Browser - 2136 Jōyō Kanji by JLPT Level',
    description: 'Browse all JLPT kanji with stroke order, readings & examples. Master Japanese kanji from N5 to N1.',
    url: 'https://moshimoshi.app/kanji-browser',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/kanji-browser',
  },
}

export default function KanjiBrowserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
