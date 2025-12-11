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
      title: t('seo.news.title'),
      description: t('seo.news.description'),
    }),
    keywords: [
      'Japanese news',
      'NHK news',
      'Japanese reading',
      'news with furigana',
      'reading comprehension',
      'current events Japanese',
      'Japanese articles',
    ],
    openGraph: {
      images: ['/og-images/og-news.png'],
    },
  }
}

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}