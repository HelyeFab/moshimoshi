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
      path: '/vocabulary',
      title: t('seo.vocabulary.title'),
      description: t('seo.vocabulary.description'),
    }),
    keywords: [
      'Japanese vocabulary',
      'Japanese words',
      'learn Japanese words',
      'Japanese vocabulary list',
      'JLPT vocabulary',
      'Japanese phrases',
      'Japanese word flashcards',
      'vocabulary builder Japanese',
      'essential Japanese words',
      'common Japanese words',
    ],
  }
}

export default function VocabularyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
