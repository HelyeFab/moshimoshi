import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Credits & Attributions - Moshimoshi',
  description: 'Credits and attributions for open source libraries, fonts, icons, and resources used in Moshimoshi Japanese learning platform.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/credits',
  },
}

export default function CreditsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
