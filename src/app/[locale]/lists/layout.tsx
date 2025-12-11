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
      title: t('seo.lists.title'),
      description: t('seo.lists.description'),
    }),
    keywords: [
      'Japanese study lists',
      'custom vocabulary lists',
      'Japanese kanji lists',
      'personalized Japanese learning',
      'vocabulary organization',
      'Japanese study planner',
      'custom flashcard lists',
      'organized Japanese study',
      'JLPT study lists',
      'Japanese learning organization',
    ],
  }
}

export default function ListsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
