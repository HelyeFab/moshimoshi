import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

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
      'JLPT deck download',
      'free Japanese flashcards',
      'Anki import',
      'JLPT N5',
      'JLPT N4',
      'JLPT N3',
      'JLPT N2',
      'JLPT N1',
      'Japanese vocabulary deck',
      'kanji deck download',
      'Japanese study material',
      'Moshimoshi DeckMarket',
    ],
  }
}

export default function DeckMarketLayout({ children }: Props) {
  return children
}
