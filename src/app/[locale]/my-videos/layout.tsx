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
      path: '/my-videos',
      title: t('seo.myVideos.title'),
      description: t('seo.myVideos.description'),
    }),
    keywords: [
      'my shadowing videos',
      'saved Japanese videos',
      'YouTube practice history',
      'shadowing session history',
      'Japanese listening history',
      'video bookmarks Japanese',
      'practice video library',
      'shadowing progress tracker',
      'saved practice videos',
      'Japanese video history',
    ],
  }
}

export default function MyVideosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
