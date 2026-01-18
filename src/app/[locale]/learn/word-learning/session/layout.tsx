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
      path: '/learn/word-learning/session',
      title: t('seo.learn.wordLearningSession.title'),
      description: t('seo.learn.wordLearningSession.description'),
    }),
    keywords: [
      'Japanese word session',
      'vocabulary learning session',
      'active word practice',
      'Japanese vocabulary session',
      'word learning practice',
    ],
    robots: {
      index: false,
      follow: true,
    },
  }
}

export default function WordLearningSessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
