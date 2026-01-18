import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    path: '/about',
    title: t('seo.about.title'),
    description: t('seo.about.description'),
  })
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
