import type { Metadata } from 'next';
import MyVideos from './MyVideos';
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
      title: t('seo.myVideosPage.title'),
      description: t('seo.myVideosPage.description'),
    }),
    keywords: [
      "my practice videos",
      "YouTube practice history",
      "Japanese shadowing history",
      "saved videos",
      "practice progress",
      "video bookmarks",
      "learning history"
    ],
  }
}

export default function MyVideosPage() {
  return <MyVideos />;
}