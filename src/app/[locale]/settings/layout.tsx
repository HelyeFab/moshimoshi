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
      path: '/settings',
      title: t('seo.settings.title'),
      description: t('seo.settings.description'),
    }),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
