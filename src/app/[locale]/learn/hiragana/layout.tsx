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
      path: '/learn/hiragana',
      title: t('seo.learn.hiragana.title'),
      description: t('seo.learn.hiragana.description'),
    }),
    keywords: [
      'learn hiragana',
      'hiragana practice',
      'hiragana flashcards',
      'Japanese alphabet',
      'hiragana chart',
      'hiragana pronunciation',
      'hiragana for beginners',
      'hiragana writing practice',
      'Japanese kana',
    ],
  }
}

export default function HiraganaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
