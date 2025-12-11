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
      title: t('seo.kanji.radicals.title'),
      description: t('seo.kanji.radicals.description'),
    }),
    keywords: [
      'kanji radicals',
      '214 kanji radicals',
      'bushu system',
      'radical search kanji',
      'semantic radicals',
      'kanji radical meanings',
      'radical index',
      'kanji components',
      'radical frequency',
      'radical stroke count',
      'kanji radical lookup',
      'traditional radicals',
      'radical position kanji',
      'bushu dictionary',
      'radical component analysis',
    ],
  }
}

export default function KanjiRadicalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
