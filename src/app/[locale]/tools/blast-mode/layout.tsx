import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    path: '/tools/blast-mode',
    title: t('seo.blastMode.title'),
    description: t('seo.blastMode.description'),
  })
}

export default function BlastModeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
