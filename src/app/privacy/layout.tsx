import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - Moshimoshi',
  description: 'Moshimoshi privacy policy. Learn how we protect your data and respect your privacy while you learn Japanese.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://moshimoshi.app/privacy',
  },
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
