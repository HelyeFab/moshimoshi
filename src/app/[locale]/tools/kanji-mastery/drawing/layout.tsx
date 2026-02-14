import type { Metadata } from 'next'
import { getTranslations, generateLocalizedMetadata, type Locale } from '@/i18n/server'
import { StructuredData } from '@/components/StructuredData'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { t } = await getTranslations(locale as Locale)

  return {
    ...await generateLocalizedMetadata({
      path: '/tools/kanji-mastery/drawing',
      title: t('seo.kanjiMasteryDrawing.title'),
      description: t('seo.kanjiMasteryDrawing.description'),
    }),
    keywords: [
      'kanji writing practice',
      'practice drawing kanji',
      'kanji stroke order practice',
      'learn to write kanji',
      'kanji handwriting practice',
      'Japanese writing practice',
      'kanji muscle memory drill',
      'write kanji online',
      'kanji calligraphy practice',
      'JLPT kanji writing',
      'joyo kanji writing drill',
      'stroke order guide',
      'kanji drawing tool',
      'free kanji writing practice',
      'kanji repetition practice',
    ],
  }
}

export default function KanjiMasteryDrawingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'LearningResource',
          name: 'Kanji Drawing Practice - Write Kanji with Stroke Order Guides',
          description:
            'Free online kanji writing practice tool. Select any kanji from JLPT N5 to N1, view stroke order buildup, and practice drawing 12 times with muscle memory drills. Includes on/kun readings and meaning references.',
          url: 'https://moshimoshi.app/en/tools/kanji-mastery/drawing',
          learningResourceType: 'Interactive Writing Tool',
          educationalLevel: ['JLPT N5', 'JLPT N4', 'JLPT N3', 'JLPT N2', 'JLPT N1'],
          teaches: ['Japanese Kanji Writing', 'Stroke Order', 'Kanji Recognition'],
          inLanguage: ['en', 'ja'],
          isAccessibleForFree: true,
          interactivityType: 'active',
          provider: {
            '@type': 'Organization',
            name: 'Moshimoshi',
            url: 'https://moshimoshi.app',
          },
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Moshimoshi',
              item: 'https://moshimoshi.app',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Kanji Mastery',
              item: 'https://moshimoshi.app/en/tools/kanji-mastery',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'Drawing Practice',
              item: 'https://moshimoshi.app/en/tools/kanji-mastery/drawing',
            },
          ],
        }}
      />
      {children}
    </>
  )
}
