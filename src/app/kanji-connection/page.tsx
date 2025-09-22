import type { Metadata } from 'next';
import KanjiConnectionPage from './KanjiConnectionPage';
import { generatePageMetadata, structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';

export const metadata: Metadata = generatePageMetadata({
  title: 'Kanji Connection Game - Interactive Memory Challenge',
  description: 'Test your kanji recognition skills with our engaging connection game. Match kanji characters with their meanings, readings, or related concepts in this fun, educational memory challenge.',
  keywords: [
    "kanji game",
    "kanji connection",
    "memory game",
    "kanji matching",
    "kanji practice game",
    "visual learning",
    "interactive kanji",
    "kanji recognition game",
    "educational game",
    "Japanese learning game",
    "kanji memory challenge",
    "gamified learning",
    "kanji quiz game"
  ],
  path: '/kanji-connection',
  image: '/og-images/og-kanji-game.png'
});

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