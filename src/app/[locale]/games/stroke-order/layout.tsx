import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    path: '/games/stroke-order',
    title: t('seo.games.strokeOrder.title'),
    description: t('seo.games.strokeOrder.description'),
  })
}

export default function StrokeOrderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
