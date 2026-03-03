import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/i18n/server'
import { locales, defaultLocale } from '@/i18n/routing'
import { adminFirestore } from '@/lib/firebase/admin'
import { DECKMARKET_COLLECTION } from '@/types/deckmarket'

const baseUrl = 'https://moshimoshi.app'

interface Props {
  params: Promise<{ locale: string; deckId: string }>
  children: React.ReactNode
}

const ogLocaleMap: Record<string, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  it: 'it_IT',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, deckId } = await params
  const { t } = await getTranslations(locale as Locale)

  let title = t('seo.deckmarket.detail.title', { deckTitle: 'DeckMarket' })
  let description = t('seo.deckmarket.detail.description', {
    deckTitle: 'DeckMarket',
    deckDescription: t('seo.deckmarket.list.description'),
  })
  let jlpt = ''
  let tags: string[] = []
  let deckTitle = ''
  let downloadCount = 0

  try {
    if (adminFirestore) {
      const deckDoc = await adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).get()
      if (deckDoc.exists) {
        const data = deckDoc.data()
        if (data?.isPublished) {
          deckTitle = data.title || 'DeckMarket'
          const deckDescription = data.description || ''
          title = t('seo.deckmarket.detail.title', { deckTitle })
          description = t('seo.deckmarket.detail.description', {
            deckTitle,
            deckDescription,
          }).slice(0, 160)
          jlpt = data.jlpt || ''
          tags = Array.isArray(data.tags) ? data.tags : []
          downloadCount = data.downloadCount || 0
        }
      }
    }
  } catch {
    // fallback to generic metadata
  }

  const languages: Record<string, string> = {}
  for (const loc of locales) {
    languages[loc] = `${baseUrl}/${loc}/deckmarket/${deckId}`
  }
  languages['x-default'] = `${baseUrl}/${defaultLocale}/deckmarket/${deckId}`

  const keywords = [
    'Japanese Anki deck',
    'free Japanese flashcards',
    'download Anki deck',
    'JLPT study deck',
    ...(jlpt ? [`${jlpt} deck`, `JLPT ${jlpt}`, `JLPT ${jlpt} Anki deck`] : []),
    ...(deckTitle ? [deckTitle] : []),
    ...tags.map((tag) => `Japanese ${tag} deck`),
    'Anki import',
    'Moshimoshi DeckMarket',
  ]

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/deckmarket/${deckId}`,
      siteName: 'Moshimoshi',
      type: 'article',
      locale: ogLocaleMap[locale] || 'en_US',
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => ogLocaleMap[l] || l),
      images: [{
        url: '/moshimoshi-logo.png',
        width: 1200,
        height: 630,
        alt: deckTitle ? `${deckTitle} - DeckMarket` : 'DeckMarket - Free Japanese Anki Decks',
      }],
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
      noarchive: true,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/deckmarket/${deckId}`,
      languages,
    },
  }
}

export default function DeckDetailLayout({ children }: Props) {
  return children
}
