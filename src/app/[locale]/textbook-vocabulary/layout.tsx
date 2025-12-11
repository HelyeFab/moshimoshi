import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    title: t('seo.textbookVocabulary.title'),
    description: t('seo.textbookVocabulary.description'),
  })
}

export default function TextbookVocabularyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
