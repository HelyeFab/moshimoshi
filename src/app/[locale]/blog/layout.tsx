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
      path: '/blog',
      title: t('seo.blog.title'),
      description: t('seo.blog.description'),
    }),
    keywords: [
      'Japanese learning blog',
      'JLPT study tips',
      'Japanese grammar guide',
      'learn Japanese blog',
      'Japanese study strategies',
      'JLPT preparation tips',
      'Japanese language tips',
      'kanji learning tips',
      'Japanese grammar articles',
      'Japanese study blog',
    ],
  }
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
