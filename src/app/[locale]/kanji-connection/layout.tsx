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
      path: '/kanji-connection',
      title: t('seo.kanji.connection.title'),
      description: t('seo.kanji.connection.description'),
    }),
    keywords: [
      'kanji connection system',
      'kanji visual patterns',
      'kanji families',
      'kanji component analysis',
      'phonetic components kanji',
      'semantic radicals',
      'kanji relationships',
      'kanji etymology',
      'kanji grapheme analysis',
      'visual kanji learning',
      'kanji pattern recognition',
      'kanji component system',
      'related kanji finder',
      'kanji network visualization',
      'kanji structure analysis',
    ],
  }
}

export default function KanjiConnectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
