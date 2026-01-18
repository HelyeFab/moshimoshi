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
      path: '/kanji-connection/visual-layout',
      title: t('seo.kanji.visualLayout.title'),
      description: t('seo.kanji.visualLayout.description'),
    }),
    keywords: [
      'kanji visual layout',
      'kanji network visualization',
      'kanji map',
      'visual kanji connections',
      'kanji pattern recognition',
      'kanji network map',
      'spatial kanji learning',
      'kanji cluster visualization',
      'interactive kanji network',
      'visual kanji system',
      'kanji relationship map',
      'graphical kanji learning',
      'kanji connection visualization',
      'visual learning kanji',
    ],
  }
}

export default function VisualLayoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
