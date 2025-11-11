import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing - Affordable Japanese Learning Plans | Free Trial Available',
  description: 'Choose the perfect Japanese learning plan. Free tier available with core features. Premium plans unlock advanced SRS, unlimited content, and offline access. Start your free trial today.',
  keywords: [
    'Japanese learning pricing',
    'Japanese app subscription',
    'affordable Japanese learning',
    'Japanese learning plans',
    'free Japanese learning app',
    'Japanese learning cost',
    'premium Japanese app',
    'Japanese learning free trial',
    'best value Japanese app',
    'Japanese learning subscription',
  ],
  openGraph: {
    title: 'Pricing - Affordable Japanese Learning Plans | Free Trial Available',
    description: 'Choose the perfect Japanese learning plan with free trial available',
    url: 'https://moshimoshi.app/pricing',
  },
  alternates: {
    canonical: 'https://moshimoshi.app/pricing',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
