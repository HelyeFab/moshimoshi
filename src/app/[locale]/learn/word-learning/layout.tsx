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
      title: t('seo.learn.wordLearning.title'),
      description: t('seo.learn.wordLearning.description'),
    }),
    keywords: [
      'Japanese word learning',
      'vocabulary learning system',
      'learn Japanese words',
      'Japanese vocabulary program',
      'word mastery Japanese',
      'vocabulary acquisition',
      'learn Japanese vocabulary',
      'Japanese word study',
      'vocabulary learning method',
      'Japanese words with context',
    ],
  }
}

export default function WordLearningLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
