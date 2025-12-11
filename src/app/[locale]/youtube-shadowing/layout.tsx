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
      title: t('seo.shadowing.title'),
      description: t('seo.shadowing.description'),
    }),
    keywords: [
      'YouTube shadowing',
      'Japanese listening practice',
      'learn Japanese with YouTube',
      'shadowing technique',
      'Japanese pronunciation',
      'Japanese video learning',
      'Japanese speaking practice',
      'Japanese language immersion',
    ],
  }
}

export default function YoutubeShadowingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
