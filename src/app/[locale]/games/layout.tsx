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
      path: '/games',
      title: t('seo.games.title'),
      description: t('seo.games.description'),
    }),
    keywords: [
      'Japanese learning games',
      'Japanese language games',
      'learn Japanese games',
      'Japanese educational games',
      'kanji games',
      'hiragana games',
      'Japanese practice games',
      'fun Japanese learning',
      'interactive Japanese games',
      'Japanese study games',
    ],
  }
}

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
