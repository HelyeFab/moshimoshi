import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string; deckId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, deckId } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    path: `/anki-study/${deckId}`,
    title: t('seo.ankiStudy.title'),
    description: t('seo.ankiStudy.description'),
  })
}

export default function AnkiStudyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
