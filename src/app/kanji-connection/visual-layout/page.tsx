import type { Metadata } from 'next';
import VisualLayoutPage from './VisualLayoutPage';
import { generatePageMetadata, structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';

export const metadata: Metadata = generatePageMetadata({
  title: 'Visual Kanji Layout - SKIP Pattern Learning',
  description: 'Learn kanji through visual patterns using the SKIP classification system. Master left-right, up-down, enclosure, and solid patterns for efficient kanji recognition.',
  keywords: [
    "SKIP method",
    "kanji visual patterns",
    "kanji layout",
    "left-right kanji",
    "up-down kanji",
    "enclosure kanji",
    "solid kanji",
    "visual kanji learning",
    "kanji structure patterns",
    "SKIP classification",
    "kanji visual memory",
    "pattern-based learning",
    "kanji recognition",
    "visual learning method"
  ],
  path: '/kanji-connection/visual-layout',
  image: '/og-images/og-kanji-visual.png'
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
      "name": "Visual Layout",
      "url": "/kanji-connection/visual-layout"
    }
  ]);

  const learningResourceData = structuredData.learningResource({
    name: "Visual Kanji Patterns - SKIP Method",
    description: "Master kanji through visual layout patterns using the SKIP classification system",
    educationalLevel: "Japanese language learners at all levels",
    learningResourceType: "Interactive visual pattern explorer",
    inLanguage: ["en", "ja"],
    teaches: [
      "SKIP classification system",
      "Visual pattern recognition",
      "Kanji structural analysis",
      "Layout-based memorization"
    ]
  });

  return (
    <>
      <StructuredData data={breadcrumbData} />
      <StructuredData data={learningResourceData} />
      <VisualLayoutPage />
    </>
  );
}