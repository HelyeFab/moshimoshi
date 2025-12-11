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
      title: t('seo.progressReport.title'),
      description: t('seo.progressReport.description'),
    }),
    keywords: [
      'Japanese progress report',
      'learning dashboard Japanese',
      'Japanese study insights',
      'weekly progress tracking',
      'vocabulary retention report',
      'kanji mastery report',
      'JLPT readiness assessment',
      'Japanese learning analytics',
      'study progress visualization',
      'learning insights dashboard',
    ],
  }
}

export default function ProgressReportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
