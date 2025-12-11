import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    title: t('seo.youtubeSeries.title'),
    description: t('seo.youtubeSeries.description'),
  })
}

export default function YouTubeSeriesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
