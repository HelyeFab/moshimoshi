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
      title: t('seo.learn.conjugation.title'),
      description: t('seo.learn.conjugation.description'),
    }),
    keywords: [
      'Japanese verb conjugation',
      'conjugate Japanese verbs',
      'Japanese verb forms',
      'verb conjugation practice',
      'Japanese grammar verbs',
      'te-form Japanese',
      'Japanese verb endings',
      'learn Japanese verbs',
      'verb conjugation chart',
      'Japanese verb tenses',
    ],
  }
}

export default function ConjugationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
