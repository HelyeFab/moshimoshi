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
      title: t('seo.flashcards.title'),
      description: t('seo.flashcards.description'),
    }),
    keywords: [
      'Japanese flashcards',
      'SRS flashcards',
      'Anki alternative',
      'spaced repetition flashcards',
      'Japanese vocabulary flashcards',
      'kanji flashcards',
      'smart flashcards Japanese',
      'Japanese SRS app',
      'intelligent flashcards',
      'Japanese memory retention',
    ],
  }
}

export default function FlashcardsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
