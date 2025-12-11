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
      title: t('seo.showcase.title'),
      description: t('seo.showcase.description'),
    }),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default function ShowcaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
