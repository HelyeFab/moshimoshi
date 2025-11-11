import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japanese Learning Blog - JLPT Study Tips & Grammar Guides',
  description: 'Expert Japanese learning tips, JLPT study strategies, grammar guides, and cultural insights. Free articles to accelerate your Japanese language mastery from beginner to advanced.',
  keywords: [
    'Japanese learning blog',
    'JLPT study tips',
    'Japanese grammar guide',
    'learn Japanese blog',
    'Japanese study strategies',
    'JLPT preparation tips',
    'Japanese language tips',
    'kanji learning tips',
    'Japanese grammar articles',
    'Japanese study blog',
  ],
  openGraph: {
    title: 'Japanese Learning Blog - JLPT Study Tips & Grammar Guides',
    description: 'Expert Japanese learning tips, JLPT strategies, and grammar guides to accelerate your mastery',
    url: 'https://moshimoshi.app/blog',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/blog',
  },
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
