import type { Metadata } from 'next';
import KanjiRadicalsPage from './KanjiRadicalsPage';
import { structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server';
import { EntitlementGate } from '@/components/review-engine/EntitlementGate';

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return generateLocalizedMetadata({
    title: t('seo.kanjiConnection.radicals.title'),
    description: t('seo.kanjiConnection.radicals.description'),
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
    <EntitlementGate featureId="kanji_connection">
      <StructuredData data={breadcrumbData} />
      <StructuredData data={learningResourceData} />
      <KanjiRadicalsPage />
    </EntitlementGate>
  );
}
