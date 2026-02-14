import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'
import { StructuredData } from '@/components/StructuredData'

interface Props {
  params: Promise<{ locale: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return {
    ...(await generateLocalizedMetadata({
      path: '/deckmarket',
      title: t('seo.deckmarket.list.title'),
      description: t('seo.deckmarket.list.description'),
    })),
    keywords: [
      'Japanese Anki decks',
      'free Japanese Anki decks',
      'download Anki decks Japanese',
      'JLPT deck download',
      'JLPT N5 Anki deck',
      'JLPT N4 Anki deck',
      'JLPT N3 Anki deck',
      'JLPT N2 Anki deck',
      'JLPT N1 Anki deck',
      'Japanese vocabulary flashcards',
      'kanji Anki deck',
      'Japanese grammar deck',
      'Anki import Japanese',
      'Anki alternative Japanese',
      'Japanese study material free',
      'Japanese flashcard decks',
      'Moshimoshi DeckMarket',
    ],
  }
}

export default function DeckMarketLayout({ children }: Props) {
  return (
    <>
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'DeckMarket - Free Japanese Anki Decks',
          description:
            'Browse and download free Japanese Anki flashcard decks for JLPT N5 to N1 preparation. Vocabulary, kanji, grammar, and sentence decks ready to import.',
          url: 'https://moshimoshi.app/en/deckmarket',
          isPartOf: {
            '@type': 'WebSite',
            name: 'Moshimoshi',
            url: 'https://moshimoshi.app',
          },
          about: {
            '@type': 'Thing',
            name: 'Japanese Language Flashcard Decks',
          },
          provider: {
            '@type': 'Organization',
            name: 'Moshimoshi',
            url: 'https://moshimoshi.app',
          },
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Moshimoshi',
              item: 'https://moshimoshi.app',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'DeckMarket',
              item: 'https://moshimoshi.app/en/deckmarket',
            },
          ],
        }}
      />
      {children}
    </>
  )
}
