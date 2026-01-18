import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    path: '/games/kanji-simon',
    title: t('seo.games.kanjiSimon.title'),
    description: t('seo.games.kanjiSimon.description'),
  })
}

export default function KanjiSimonLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
