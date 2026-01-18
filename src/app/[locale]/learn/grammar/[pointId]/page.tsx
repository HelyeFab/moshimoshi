import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getGrammarIndex,
  getGrammarPoint,
  getGrammarPointsIndex,
  resolveGrammarPointLevel,
} from '@/lib/grammar/grammarService'
import { getTranslations, generateLocalizedMetadata } from '@/i18n/server'
import type { Locale } from '@/i18n/routing'
import GrammarDetailPageClient from '@/components/grammar/GrammarDetailPageClient'

export const dynamic = 'force-static'
export const runtime = 'nodejs'

function getAudienceLabel(levelLabel: string) {
  if (levelLabel === 'N5') return 'beginner'
  if (levelLabel === 'N4') return 'intermediate'
  return 'advanced'
}

export async function generateStaticParams() {
  try {
    const indexMap = await getGrammarPointsIndex()
    return Object.keys(indexMap.points).map((pointId) => ({
      pointId,
    }))
  } catch {
    const indexData = await getGrammarIndex('n5')
    return indexData.points.map((point) => ({
      pointId: point.id,
    }))
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; pointId: string }>
}): Promise<Metadata> {
  const { locale, pointId } = await params
  const { t } = await getTranslations(locale as Locale)

  try {
    const level = await resolveGrammarPointLevel(pointId)
    if (!level) {
      throw new Error('Grammar level not found')
    }
    const [point, indexData] = await Promise.all([
      getGrammarPoint(pointId, level),
      getGrammarIndex(level),
    ])
    const jlptLevel = point.jlptLevel
    const audienceLabel = getAudienceLabel(jlptLevel)

    // Extract first example for description enhancement
    const firstExample = point.examples?.[0]
    const exampleText = firstExample
      ? ` Example: "${firstExample.japanese}" (${firstExample.english})`
      : ''

    const baseUrl = 'https://moshimoshi.app'

    return {
      title: `${point.title.en} (${point.title.romaji}) - Free JLPT ${jlptLevel} Grammar Lesson`,
      description: `Learn ${point.title.en} with clear explanations, real examples, and interactive practice.${exampleText}. Master JLPT ${jlptLevel} grammar for free!`,
      keywords: [
        // Core grammar terms
        `${point.title.romaji} meaning`,
        `${point.title.romaji} grammar`,
        `how to use ${point.title.en} japanese`,
        `${point.title.ja} grammar`,
        // JLPT & Level keywords
        `JLPT ${jlptLevel} grammar`,
        `free JLPT ${jlptLevel} lessons`,
        'japanese grammar explained',
        'learn japanese online free',
        `${audienceLabel} japanese grammar`,
        `japanese grammar for ${audienceLabel} learners`,
        // Category & tags
        point.category,
        ...point.tags,
        // Long-tail queries
        `${point.title.en} example sentences`,
        `${point.title.romaji} japanese`,
        'japanese grammar tutorial',
      ],
      openGraph: {
        title: `Master ${point.title.en} - Free Interactive Japanese Grammar Lesson`,
        description: point.explanation.en.slice(0, 200),
        type: 'article',
        url: `${baseUrl}/${locale}/learn/grammar/${pointId}`,
        siteName: 'Moshimoshi',
        locale: locale,
        images: [
          {
            url: `${baseUrl}/moshimoshi-logo.png`,
            width: 1200,
            height: 630,
            alt: `${point.title.ja} - ${point.title.en} Grammar Lesson`,
          },
        ],
        publishedTime: `${indexData.lastUpdated}T00:00:00Z`,
        section: 'Japanese Grammar',
        tags: point.tags,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${point.title.romaji} - Free JLPT ${jlptLevel} Grammar Lesson`,
        description: `Learn ${point.title.en} with examples and practice exercises. Free Japanese grammar course!`,
        images: [`${baseUrl}/moshimoshi-logo.png`],
      },
      alternates: {
        canonical: `${baseUrl}/${locale}/learn/grammar/${pointId}`,
        languages: {
          en: `${baseUrl}/en/learn/grammar/${pointId}`,
          ja: `${baseUrl}/ja/learn/grammar/${pointId}`,
          de: `${baseUrl}/de/learn/grammar/${pointId}`,
          es: `${baseUrl}/es/learn/grammar/${pointId}`,
          fr: `${baseUrl}/fr/learn/grammar/${pointId}`,
          it: `${baseUrl}/it/learn/grammar/${pointId}`,
          'x-default': `${baseUrl}/en/learn/grammar/${pointId}`,
        },
      },
    }
  } catch {
    let fallbackCount = 0
    try {
      const indexData = await getGrammarIndex('n5')
      fallbackCount = indexData.totalPoints
    } catch {
      fallbackCount = 0
    }

    return generateLocalizedMetadata({
      path: `/learn/grammar/${pointId}`,
      title: t('grammarStall.breadcrumb.grammar'),
      description: t('grammarStall.description', { count: fallbackCount }),
    })
  }
}

export default async function GrammarDetailPage({
  params,
}: {
  params: Promise<{ locale: string; pointId: string }>
}) {
  const { locale, pointId } = await params
  const { t } = await getTranslations(locale as Locale)

  try {
    const level = await resolveGrammarPointLevel(pointId)
    if (!level) {
      notFound()
    }
    const [point, indexData] = await Promise.all([
      getGrammarPoint(pointId, level),
      getGrammarIndex(level),
    ])
    const baseUrl = 'https://moshimoshi.app'
    const hubPath = level === 'n5' ? '/learn/grammar' : `/learn/grammar/${level}`

    // JSON-LD Structured Data for rich snippets
    const structuredData = {
      '@context': 'https://schema.org',
      '@graph': [
        // LearningResource - Main content
        {
          '@type': 'LearningResource',
          '@id': `${baseUrl}/${locale}/learn/grammar/${pointId}#resource`,
          name: `${point.title.en} - ${point.title.romaji}`,
          description: point.explanation.en,
          learningResourceType: 'Lesson',
          educationalLevel: `JLPT ${point.jlptLevel}`,
          teaches: `Japanese Grammar: ${point.title.en}`,
          inLanguage: ['ja-JP', 'en-US'],
          timeRequired: 'PT15M',
          isAccessibleForFree: true,
          educationalAlignment: {
            '@type': 'AlignmentObject',
            alignmentType: 'educationalLevel',
            educationalFramework: 'JLPT',
            targetName: point.jlptLevel,
          },
          isPartOf: {
            '@type': 'Course',
            '@id': `${baseUrl}/${locale}${hubPath}#${level}-course`,
            name: `Complete JLPT ${point.jlptLevel} Grammar Course`,
            description: `${indexData.totalPoints} comprehensive JLPT ${point.jlptLevel} grammar lessons`,
            provider: {
              '@type': 'Organization',
              name: 'Moshimoshi',
              url: baseUrl,
            },
          },
          hasPart: point.examples?.map((ex, idx) => ({
            '@type': 'CreativeWork',
            '@id': `#example-${idx}`,
            text: `${ex.japanese} (${ex.english})`,
            inLanguage: 'ja-JP',
          })),
          url: `${baseUrl}/${locale}/learn/grammar/${pointId}`,
        },
        // FAQPage - Common Mistakes
        ...(point.commonMistakes && point.commonMistakes.length > 0
          ? [
              {
                '@type': 'FAQPage',
                mainEntity: point.commonMistakes.map((mistake) => ({
                  '@type': 'Question',
                  name: `Common mistake: ${mistake.mistake}`,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: `${mistake.correction}. ${mistake.example}`,
                  },
                })),
              },
            ]
          : []),
        // HowTo - Grammar Structure
        {
          '@type': 'HowTo',
          name: `How to Use ${point.title.en} in Japanese`,
          description: `Step-by-step guide to using ${point.title.romaji}`,
          totalTime: 'PT15M',
          step: point.structure?.components?.map((comp, idx) => ({
            '@type': 'HowToStep',
            position: idx + 1,
            name: comp.part,
            text: comp.explanation,
            example: comp.examples?.[0],
          })),
        },
        // BreadcrumbList
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${baseUrl}/${locale}`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Learn Japanese',
              item: `${baseUrl}/${locale}/learn`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'Grammar',
              item: `${baseUrl}/${locale}${hubPath}`,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: point.title.en,
              item: `${baseUrl}/${locale}/learn/grammar/${pointId}`,
            },
          ],
        },
      ],
    }

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <GrammarDetailPageClient
          point={point}
          locale={locale}
          level={level}
          labels={{
            explanation: t('grammarStall.explanation'),
            structure: t('grammarStall.structure'),
            examples: t('grammarStall.examples'),
            related: t('grammarStall.related'),
            practice: t('grammarStall.practice'),
            example: t('grammarStall.example'),
            breakdown: t('grammarStall.breakdown'),
            note: t('grammarStall.note'),
            pattern: t('grammarStall.pattern'),
            componentExamples: t('grammarStall.componentExamples'),
            showFuriganaLabel: t('grammarStall.showFuriganaLabel'),
            showFuriganaDescription: t('grammarStall.showFuriganaDescription'),
          }}
        />
      </>
    )
  } catch {
    notFound()
  }
}
