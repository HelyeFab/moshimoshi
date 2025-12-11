import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    title: t('seo.studyTimer.title'),
    description: t('seo.studyTimer.description'),
  })
}

export default function StudyTimerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
