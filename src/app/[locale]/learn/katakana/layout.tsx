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
      path: '/learn/katakana',
      title: t('seo.learn.katakana.title'),
      description: t('seo.learn.katakana.description'),
    }),
    keywords: [
      'learn katakana',
      'katakana practice',
      'katakana flashcards',
      'Japanese katakana',
      'katakana chart',
      'katakana pronunciation',
      'katakana for beginners',
      'katakana writing practice',
      'Japanese alphabet katakana',
      'foreign words Japanese',
    ],
  }
}

export default function KatakanaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
