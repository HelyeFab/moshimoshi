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
      path: '/learn/numbers',
      title: t('seo.learn.numbers.title'),
      description: t('seo.learn.numbers.description'),
    }),
    keywords: [
      'learn Japanese numbers',
      'Japanese counting system',
      'Japanese numbers practice',
      'counting in Japanese',
      'Japanese counters',
      'Japanese number system',
      'learn to count Japanese',
      'Japanese numbers audio',
      'Japanese dates and time',
      'Japanese phone numbers',
    ],
  }
}

export default function NumbersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
