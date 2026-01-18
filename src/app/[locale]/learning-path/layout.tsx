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
      path: '/learning-path',
      title: t('seo.learningPath.title'),
      description: t('seo.learningPath.description'),
    }),
    keywords: [
      'Japanese learning path',
      'JLPT study roadmap',
      'Japanese learning curriculum',
      'beginner to advanced Japanese',
      'personalized learning path',
      'Japanese study plan',
      'JLPT preparation roadmap',
      'structured Japanese learning',
      'adaptive Japanese curriculum',
      'Japanese learning journey',
    ],
  }
}

export default function LearningPathLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
