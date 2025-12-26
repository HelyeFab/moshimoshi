'use client'

import KanjiConnectionPage from './KanjiConnectionPage';
import { structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';
import { EntitlementGate } from '@/components/review-engine/EntitlementGate';

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
    <EntitlementGate featureId="kanji_connection">
      <StructuredData data={breadcrumbData} />
      <StructuredData data={gameData} />
      <KanjiConnectionPage />
    </EntitlementGate>
  );
}