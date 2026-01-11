import type { Metadata } from 'next';
import KanjiFamiliesPage from './KanjiFamiliesPage';
import { structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';
import MobileNavSpacer from '@/components/layout/MobileNavSpacer';
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server';
import { EntitlementGate } from '@/components/review-engine/EntitlementGate';

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    title: t('seo.kanjiConnection.families.title'),
    description: t('seo.kanjiConnection.families.description'),
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
    },
    {
      "name": "Kanji Families",
      "url": "/kanji-connection/families"
    }
  ]);

  const learningResourceData = structuredData.learningResource({
    name: "Kanji Families - Component-Based Learning",
    description: "Learn kanji through family groups based on shared components and meanings",
    url: "/kanji-connection/families",
    educationalLevel: "All levels - Beginner to Advanced",
    teaches: "Kanji component patterns, semantic relationships, visual memory techniques"
  });

  return (
    <EntitlementGate featureId="kanji_connection">
      <StructuredData data={breadcrumbData} />
      <StructuredData data={learningResourceData} />
      <KanjiFamiliesPage />
      <MobileNavSpacer />
    </EntitlementGate>
  );
}
