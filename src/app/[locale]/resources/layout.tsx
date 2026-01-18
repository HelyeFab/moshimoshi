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
      path: '/resources',
      title: t('seo.resources.title'),
      description: t('seo.resources.description'),
    }),
    keywords: [
      'free Japanese learning resources',
      'JLPT study materials',
      'Japanese learning guides',
      'free Japanese materials',
      'Japanese study resources',
      'JLPT resources free',
      'Japanese grammar resources',
      'kanji study materials',
      'Japanese learning downloads',
      'free Japanese textbooks',
    ],
  }
}

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
