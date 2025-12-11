import type { Metadata } from 'next';
import KanjiRadicalsPage from './KanjiRadicalsPage';
import { generatePageMetadata, structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';
import MobileNavSpacer from '@/components/layout/MobileNavSpacer';

export const metadata: Metadata = generatePageMetadata({
  title: 'Kanji Radicals - Master Semantic Components',
  description: 'Learn kanji through semantic radicals - the building blocks that give meaning. Explore water radicals, fire radicals, hand radicals and more to understand kanji patterns.',
  keywords: [
    "kanji radicals",
    "semantic radicals",
    "kanji components",
    "radical meanings",
    "water radical",
    "fire radical",
    "hand radical",
    "tree radical",
    "kanji building blocks",
    "radical patterns",
    "kanji structure",
    "bushu",
    "kanji semantic groups",
    "radical learning method"
  ],
  path: '/kanji-connection/radicals',
  image: '/og-images/og-kanji-radicals.png'
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
    },
    {
      "name": "Kanji Radicals",
      "url": "/kanji-connection/radicals"
    }
  ]);

  const learningResourceData = structuredData.learningResource({
    name: "Semantic Radicals - Kanji Building Blocks",
    description: "Master kanji through semantic radicals that provide meaning clues",
    url: "/kanji-connection/radicals",
    educationalLevel: "All levels - Beginner to Advanced",
    teaches: "Semantic radical meanings, kanji structure analysis, pattern recognition"
  });

  return (
    <>
      <StructuredData data={breadcrumbData} />
      <StructuredData data={learningResourceData} />
      <KanjiRadicalsPage />
      <MobileNavSpacer />
    </>
  );
}