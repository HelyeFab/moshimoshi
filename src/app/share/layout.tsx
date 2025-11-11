import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Share to Moshimoshi - Add Japanese Content to Your Lists',
  description: 'Share Japanese content to Moshimoshi from other apps. Add vocabulary, kanji, and phrases directly to your custom learning lists.',
  keywords: [
    'share to Moshimoshi',
    'add to Japanese list',
    'share Japanese content',
    'web share target',
  ],
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/share',
  },
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
