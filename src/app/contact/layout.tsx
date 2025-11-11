import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us - Japanese Learning Support | Moshimoshi',
  description: 'Get help with Moshimoshi Japanese learning app. Contact our support team for technical assistance, feature requests, feedback, and questions about Japanese learning. Fast response time.',
  keywords: [
    'contact Japanese learning app',
    'Moshimoshi support',
    'Japanese app customer service',
    'learning app help',
    'Japanese learning support',
    'Moshimoshi contact',
    'feedback Japanese app',
    'technical support',
  ],
  openGraph: {
    title: 'Contact Us - Japanese Learning Support',
    description: 'Get help with Moshimoshi Japanese learning app and contact our support team',
    url: 'https://moshimoshi.app/contact',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/contact',
  },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
