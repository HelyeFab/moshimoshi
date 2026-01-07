import { Metadata } from 'next'
import { getTranslations } from '@/i18n/server'
import type { Locale } from '@/i18n/routing'

/**
 * Layout for Q&A Forum (Tea House)
 * Provides SEO metadata for the Q&A section
 */

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const { strings } = await getTranslations(locale)

  const title = `${strings.qa.title} | Moshimoshi`
  const description = strings.qa.subtitle

  return {
    title,
    description,
    keywords: [
      'Japanese learning forum',
      'Japanese Q&A',
      'learn Japanese online',
      'Japanese language questions',
      'Japanese study help',
      'language learning community',
      'Tea House',
      '茶屋',
    ],
    openGraph: {
      title,
      description,
      type: 'website',
      locale: locale,
      siteName: 'Moshimoshi',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: `https://moshimoshi.app/${locale}/village/tea-house`,
      languages: {
        en: 'https://moshimoshi.app/en/village/tea-house',
        ja: 'https://moshimoshi.app/ja/village/tea-house',
        de: 'https://moshimoshi.app/de/village/tea-house',
        es: 'https://moshimoshi.app/es/village/tea-house',
        fr: 'https://moshimoshi.app/fr/village/tea-house',
        it: 'https://moshimoshi.app/it/village/tea-house',
      },
    },
  }
}

export default function QALayout({ children }: { children: React.ReactNode }) {
  return children
}
