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
      title: t('seo.drill.title'),
      description: t('seo.drill.description'),
    }),
    keywords: [
      'Japanese conjugation drill',
      'verb drill practice',
      'Japanese grammar drill',
      'conjugation practice',
      'Japanese verb practice',
      'verb conjugation exercises',
      'Japanese drill exercises',
      'grammar practice Japanese',
    ],
  }
}

export default function DrillLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
