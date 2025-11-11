import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Review - Redirecting to Review Dashboard',
  description: 'Redirecting to Japanese review dashboard.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
