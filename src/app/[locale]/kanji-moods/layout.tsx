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
      title: t('seo.kanjiMoods.title'),
      description: t('seo.kanjiMoods.description'),
    }),
    keywords: [
      'visual kanji learning',
      'kanji moodboard',
      'mnemonic kanji',
      'kanji visualization',
      'spatial memory kanji',
      'memory palace kanji',
      'visual kanji method',
      'kanji visual association',
      'creative kanji learning',
      'kanji imagery',
    ],
  }
}

export default function KanjiMoodsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
