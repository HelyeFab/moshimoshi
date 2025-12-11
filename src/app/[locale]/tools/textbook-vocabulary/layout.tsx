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
      title: t('seo.textbooks.title'),
      description: t('seo.textbooks.description'),
    }),
    keywords: [
      'Genki vocabulary list',
      'Minna no Nihongo vocabulary',
      'Japanese textbook vocabulary',
      'Genki 1 word list',
      'Genki 2 vocabulary',
      'Minna no Nihongo 50 lessons',
      'Tobira vocabulary list',
      'Japanese from Zero vocabulary',
      'Marugoto word list',
      'textbook Japanese words',
      'Genki flashcards',
      'Minna no Nihongo flashcards',
      'Japanese classroom vocabulary',
      'textbook companion app',
      'Genki study companion',
    ],
  }
}

export default function TextbookVocabularyToolLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
