import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - Moshimoshi',
  description: 'Moshimoshi terms of service. Read our terms and conditions for using the Japanese learning platform.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/terms',
  },
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
