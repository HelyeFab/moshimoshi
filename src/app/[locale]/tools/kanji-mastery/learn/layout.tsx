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
      title: t('seo.kanjiMasteryLearn.title'),
      description: t('seo.kanjiMasteryLearn.description'),
    }),
    robots: {
      index: false,
      follow: true,
    },
  }
}

export default function KanjiMasteryLearnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
