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
      title: t('seo.kanji.browser.title'),
      description: t('seo.kanji.browser.description'),
    }),
    keywords: [
      'kanji browser',
      'JLPT kanji',
      'learn kanji',
      'kanji dictionary',
      'kanji stroke order',
      'N5 kanji',
      'N4 kanji',
      'N3 kanji',
      'N2 kanji',
      'N1 kanji',
      'joyo kanji',
      'kanji meanings',
      'kanji readings',
    ],
  }
}

export default function KanjiBrowserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
