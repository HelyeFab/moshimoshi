import type { Metadata } from 'next';
import { generatePageMetadata } from '@/utils/seo';

export const metadata: Metadata = generatePageMetadata({
  title: 'Japanese News Reader - NHK News with Furigana',
  description: 'Read real Japanese news from NHK with automatic furigana, vocabulary lookup, and grammar explanations. Perfect for intermediate learners to improve reading comprehension with current events.',
  keywords: [
    "Japanese news",
    "NHK news",
    "Japanese reading",
    "news with furigana",
    "reading comprehension",
    "current events Japanese",
    "Japanese articles"
  ],
  image: '/og-images/og-news.png'
});

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>;
}