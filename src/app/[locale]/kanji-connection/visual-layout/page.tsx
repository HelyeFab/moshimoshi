import type { Metadata } from 'next';
import VisualLayoutPage from './VisualLayoutPage';
import { structuredData } from '@/utils/seo';
import { StructuredData } from '@/components/StructuredData';
import MobileNavSpacer from '@/components/layout/MobileNavSpacer';
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return {
    ...await generateLocalizedMetadata({
      title: t('seo.kanji.visualLayoutPage.title'),
      description: t('seo.kanji.visualLayoutPage.description'),
    }),
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
    openGraph: {
      images: ['/og-images/og-kanji-visual.png']
    }
  }
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
      "name": "Visual Layout",
      "url": "/kanji-connection/visual-layout"
    }
  ]);

  const learningResourceData = structuredData.learningResource({
    name: "Visual Kanji Patterns - SKIP Method",
    description: "Master kanji through visual layout patterns using the SKIP classification system",
    url: "/kanji-connection/visual-layout",
    educationalLevel: "All levels - Beginner to Advanced",
    teaches: "SKIP classification system, visual pattern recognition, kanji structural analysis"
  });

  return (
    <>
      <StructuredData data={breadcrumbData} />
      <StructuredData data={learningResourceData} />
      <VisualLayoutPage />
      <MobileNavSpacer />
    </>
  );
}