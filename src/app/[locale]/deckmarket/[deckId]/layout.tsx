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

function getOgLocale(locale: string) {
  switch (locale) {
    case 'ja':
      return 'ja_JP'
    case 'de':
      return 'de_DE'
    case 'es':
      return 'es_ES'
    case 'fr':
      return 'fr_FR'
    case 'it':
      return 'it_IT'
    default:
      return 'en_US'
  }
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

  try {
    if (adminFirestore) {
      const deckDoc = await adminFirestore.collection(DECKMARKET_COLLECTION).doc(deckId).get()
      if (deckDoc.exists) {
        const data = deckDoc.data()
        if (data?.isPublished) {
          const deckTitle = data.title || 'DeckMarket'
          const deckDescription = data.description || ''
          title = t('seo.deckmarket.detail.title', { deckTitle })
          description = t('seo.deckmarket.detail.description', {
            deckTitle,
            deckDescription,
          }).slice(0, 160)
          jlpt = data.jlpt || ''
          tags = Array.isArray(data.tags) ? data.tags : []
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
    'JLPT study deck',
    ...(jlpt ? [`${jlpt} deck`, `JLPT ${jlpt}`] : []),
    ...tags.map((tag) => `Japanese ${tag} deck`),
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
      locale: getOgLocale(locale),
    },
    twitter: {
      card: 'summary',
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
