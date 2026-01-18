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
      path: '/credits',
      title: t('seo.credits.title'),
      description: t('seo.credits.description'),
    }),
    robots: {
      index: false,
      follow: true,
    },
  }
}

export default function CreditsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
