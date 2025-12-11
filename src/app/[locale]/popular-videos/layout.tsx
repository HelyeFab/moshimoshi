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
      title: t('seo.popularVideos.title'),
      description: t('seo.popularVideos.description'),
    }),
    keywords: [
      'popular Japanese learning videos',
      'trending Japanese YouTube',
      'best Japanese videos',
      'viral Japanese content',
      'popular Japanese YouTube channels',
      'trending Japanese lessons',
      'most watched Japanese videos',
      'popular shadowing videos',
      'Japanese YouTube trends',
      'best Japanese drama videos',
    ],
  }
}

export default function PopularVideosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
