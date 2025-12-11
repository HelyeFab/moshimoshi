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
      title: t('seo.leaderboard.title'),
      description: t('seo.leaderboard.description'),
    }),
    keywords: [
      'Japanese learning leaderboard',
      'gamified Japanese learning',
      'competitive language learning',
      'Japanese learning rankings',
      'language learning competition',
      'gamification learning',
      'Japanese learner rankings',
      'motivational learning',
      'Japanese study competition',
      'language learning gamification',
    ],
  }
}

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
