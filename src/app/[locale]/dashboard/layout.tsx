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
      title: t('seo.dashboard.title'),
      description: t('seo.dashboard.description'),
    }),
    keywords: [
      'Japanese learning dashboard',
      'Japanese progress tracker',
      'JLPT study tracker',
      'kanji progress',
      'Japanese learning statistics',
      'daily streak tracker',
      'Japanese XP system',
    ],
    robots: {
      index: false, // Don't index dashboard pages (user-specific content)
      follow: true,
    },
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
