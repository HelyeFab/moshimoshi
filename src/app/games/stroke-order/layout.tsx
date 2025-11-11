import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanji Stroke Order Practice - Writing Game',
  description: 'Learn proper kanji stroke order through interactive practice. Master the correct way to write Japanese characters with visual guides and instant feedback. Improve your handwriting.',
  keywords: [
    'kanji stroke order',
    'stroke order practice',
    'kanji writing practice',
    'learn stroke order',
    'kanji writing game',
    'Japanese handwriting',
    'write kanji correctly',
    'kanji stroke sequence',
    'proper kanji writing',
  ],
  openGraph: {
    title: 'Kanji Stroke Order Practice - Writing Game',
    description: 'Learn proper kanji stroke order with interactive practice and visual guides',
    url: 'https://moshimoshi.app/games/stroke-order',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/games/stroke-order',
  },
}

export default function StrokeOrderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
