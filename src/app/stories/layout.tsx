import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Reading Stories - Graded Readers for All JLPT Levels',
  description: 'Read Japanese stories tailored to your level. Graded readers from N5 to N1 with furigana, translations, and audio. Improve reading comprehension through engaging short stories.',
  keywords: [
    'Japanese reading stories',
    'Japanese graded readers',
    'Japanese short stories',
    'JLPT reading practice',
    'Japanese stories with furigana',
    'beginner Japanese stories',
    'intermediate Japanese reading',
    'Japanese comprehension practice',
    'Japanese reading comprehension',
    'leveled Japanese readers',
  ],
  openGraph: {
    title: 'Japanese Reading Stories - Graded Readers for All JLPT Levels',
    description: 'Read engaging Japanese stories tailored to your level with furigana and translations',
    url: 'https://moshimoshi.app/stories',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/stories',
  },
}

export default function StoriesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
