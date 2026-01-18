import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return {
    ...await generateLocalizedMetadata({
      path: '/pricing',
      title: t('seo.pricing.title'),
      description: t('seo.pricing.description'),
    }),
    keywords: [
      'Japanese learning pricing',
      'Japanese app subscription',
      'affordable Japanese learning',
      'Japanese learning plans',
      'free Japanese learning app',
      'Japanese learning cost',
      'premium Japanese app',
      'Japanese learning free tier',
      'best value Japanese app',
      'Japanese learning subscription',
    ],
  }
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
