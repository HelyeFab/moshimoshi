import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UI Showcase - Moshimoshi',
  description: 'Component and UI element showcase for Moshimoshi development.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
