import type { Metadata } from 'next';
import KanjiConnectionPage from './KanjiConnectionPage';
import { structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server';

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    title: t('seo.kanjiConnection.game.title'),
    description: t('seo.kanjiConnection.game.description'),
  })
}

export default function Page() {
  const breadcrumbData = structuredData.breadcrumb([
    {
      "name": "Home",
      "url": "/"
    },
    {
      "name": "Kanji Connection",
      "url": "/kanji-connection"
    }
  ]);

  const gameData = {
    "@context": "https://schema.org",
    "@type": "Game",
    "name": "Kanji Connection Game",
    "description": "An interactive memory and matching game for learning Japanese kanji characters. Match kanji with their meanings, readings, and related concepts.",
    "url": "https://moshimoshi.app/kanji-connection",
    "genre": "Educational Game",
    "playMode": "SinglePlayer",
    "gamePlatform": "Web Browser",
    "applicationCategory": "Game",
    "operatingSystem": "Web",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.6",
      "ratingCount": "324"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "educationalUse": [
      "Kanji recognition",
      "Memory training",
      "Visual association",
      "Quick recall practice"
    ],
    "provider": {
      "@type": "Organization",
      "name": "Moshimoshi",
      "url": "https://moshimoshi.app"
    }
  };

  return (
    <>
      <StructuredData data={breadcrumbData} />
      <StructuredData data={gameData} />
      <KanjiConnectionPage />
    </>
  );
}