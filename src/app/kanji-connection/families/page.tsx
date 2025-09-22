import type { Metadata } from 'next';
import KanjiFamiliesPage from './KanjiFamiliesPage';
import { generatePageMetadata, structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';

export const metadata: Metadata = generatePageMetadata({
  title: 'Kanji Families - Learn Kanji by Component Groups',
  description: 'Master kanji through family groups and shared components. Discover how kanji with similar parts share meanings and make learning more efficient and memorable.',
  keywords: [
    "kanji families",
    "kanji components",
    "kanji radicals groups",
    "kanji by category",
    "visual kanji learning",
    "kanji patterns",
    "related kanji",
    "kanji semantic groups",
    "kanji elements",
    "kanji nature groups",
    "kanji human groups",
    "kanji tools groups",
    "kanji movement groups",
    "systematic kanji study"
  ],
  path: '/kanji-connection/families',
  image: '/og-images/og-kanji-families.png'
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
      "name": "Kanji Families",
      "url": "/kanji-connection/families"
    }
  ]);

  const learningResourceData = structuredData.learningResource({
    name: "Kanji Families - Component-Based Learning",
    description: "Learn kanji through family groups based on shared components and meanings",
    educationalLevel: "Japanese language learners at all levels",
    learningResourceType: "Interactive kanji family explorer",
    inLanguage: ["en", "ja"],
    teaches: [
      "Kanji component patterns",
      "Semantic relationships",
      "Visual memory techniques",
      "Systematic kanji learning"
    ]
  });

  return (
    <>
      <StructuredData data={breadcrumbData} />
      <StructuredData data={learningResourceData} />
      <KanjiFamiliesPage />
    </>
  );
}