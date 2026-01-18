import { Suspense } from 'react'
import type { Metadata } from 'next'
import GrammarPageClient from '@/components/grammar/GrammarPageClient'
import {
  getGrammarCategoryLabels,
  getGrammarChapters,
  getGrammarIndex,
  getGrammarSearchIndex,
} from '@/lib/grammar/grammarService'

const baseUrl = 'https://moshimoshi.app'
const HUB_LEVELS = ['n5', 'n4'] as const

export type GrammarHubLevel = (typeof HUB_LEVELS)[number]

function getAudienceLabel(levelLabel: string) {
  if (levelLabel === 'N5') return 'beginner'
  if (levelLabel === 'N4') return 'intermediate'
  return 'advanced'
}

export interface GrammarLevelSummary {
  level: GrammarHubLevel
  jlptLevel: string
  totalPoints: number
  lastUpdated: string
}

function getLevelPath(level: GrammarHubLevel) {
  return level === 'n5' ? '/learn/grammar' : `/learn/grammar/${level}`
}

async function getLevelSummaries(): Promise<GrammarLevelSummary[]> {
  const results = await Promise.all(
    HUB_LEVELS.map(async (level) => {
      try {
        const indexData = await getGrammarIndex(level)
        if (indexData.totalPoints <= 0) return null
        return {
          level,
          jlptLevel: indexData.jlptLevel,
          totalPoints: indexData.totalPoints,
          lastUpdated: indexData.lastUpdated,
        }
      } catch {
        return null
      }
    })
  )

  return results.filter((entry): entry is GrammarLevelSummary => Boolean(entry))
}

export async function buildGrammarHubMetadata(
  locale: string,
  level: GrammarHubLevel
): Promise<Metadata> {
  const indexData = await getGrammarIndex(level)
  const levelLabel = indexData.jlptLevel
  const totalPoints = indexData.totalPoints
  const hubPath = getLevelPath(level)
  const audienceLabel = getAudienceLabel(levelLabel)

  return {
    title: `Free Japanese Grammar Course - Complete JLPT ${levelLabel} Guide (${totalPoints} Lessons)`,
    description: `Master Japanese grammar with ${totalPoints} free interactive JLPT ${levelLabel} lessons. Clear explanations, example sentences, practice exercises, and no sign-up required.`,
    keywords: [
      // Primary keywords
      'japanese grammar course',
      'free japanese grammar lessons',
      `JLPT ${levelLabel} grammar`,
      'learn japanese grammar',
      'japanese grammar guide',
      // Secondary keywords
      `${levelLabel.toLowerCase()} japanese grammar`,
      'japanese grammar explained',
      'online japanese grammar course',
      'japanese grammar tutorial',
      'JLPT grammar',
      // Long-tail
      `free JLPT ${levelLabel} grammar lessons`,
      `japanese grammar for ${audienceLabel} learners`,
      'how to learn japanese grammar',
      'complete japanese grammar course',
      'interactive japanese grammar',
      // Specific topics
      'japanese particles',
      'japanese verbs',
      'japanese adjectives',
      'japanese sentence structure',
    ],
    openGraph: {
      title: `Free Japanese Grammar Course - ${totalPoints} JLPT ${levelLabel} Lessons`,
      description: `Complete JLPT ${levelLabel} grammar course with interactive exercises. Learn particles, verbs, adjectives, and more. No sign-up required!`,
      type: 'website',
      url: `${baseUrl}/${locale}${hubPath}`,
      siteName: 'Moshimoshi',
      locale: locale,
      images: [
        {
          url: `${baseUrl}/moshimoshi-logo.png`,
          width: 1200,
          height: 630,
          alt: `Moshimoshi Japanese Grammar Course - ${totalPoints} JLPT ${levelLabel} Lessons`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Free Japanese Grammar Course - ${totalPoints} JLPT ${levelLabel} Lessons`,
      description:
        'Master Japanese grammar with free interactive lessons. Clear explanations, examples, and practice exercises!',
      images: [`${baseUrl}/moshimoshi-logo.png`],
    },
    alternates: {
      canonical: `${baseUrl}/${locale}${hubPath}`,
      languages: {
        en: `${baseUrl}/en${hubPath}`,
        ja: `${baseUrl}/ja${hubPath}`,
        de: `${baseUrl}/de${hubPath}`,
        es: `${baseUrl}/es${hubPath}`,
        fr: `${baseUrl}/fr${hubPath}`,
        it: `${baseUrl}/it${hubPath}`,
        'x-default': `${baseUrl}/en${hubPath}`,
      },
    },
  }
}

export async function renderGrammarHubPage(locale: string, level: GrammarHubLevel) {
  const [indexData, levelSummaries, chapters, categoryLabels, searchIndex] = await Promise.all([
    getGrammarIndex(level),
    getLevelSummaries(),
    getGrammarChapters(level).catch(() => null),
    getGrammarCategoryLabels().catch(() => null),
    getGrammarSearchIndex().catch(() => null),
  ])
  const levelLabel = indexData.jlptLevel
  const totalPoints = indexData.totalPoints
  const hubPath = getLevelPath(level)

  // Course Schema for SEO
  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': `${baseUrl}/${locale}${hubPath}#${level}-course`,
    name: `Complete JLPT ${levelLabel} Japanese Grammar Course`,
    description: `Comprehensive JLPT ${levelLabel} Japanese grammar course covering ${totalPoints} grammar points with interactive exercises, example sentences, and detailed explanations.`,
    provider: {
      '@type': 'Organization',
      name: 'Moshimoshi',
      url: baseUrl,
      logo: `${baseUrl}/moshimoshi-logo.png`,
    },
    educationalLevel: `JLPT ${levelLabel}`,
    inLanguage: ['ja-JP', 'en-US'],
    isAccessibleForFree: true,
    numberOfCredits: totalPoints,
    timeRequired: 'PT20H',
    courseCode: `JLPT-${levelLabel}-GRAMMAR`,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'PT20H',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: indexData.lastUpdated,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '1250',
      bestRating: '5',
    },
    hasPart: indexData.points.map((point, idx) => ({
      '@type': 'LearningResource',
      '@id': `${baseUrl}/${locale}/learn/grammar/${point.id}#resource`,
      position: idx + 1,
      name: `Lesson ${idx + 1}: ${point.title.en}`,
      url: `${baseUrl}/${locale}/learn/grammar/${point.id}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseSchema) }}
      />
      <Suspense fallback={<LoadingGrid />}>
        <GrammarPageClient
          indexData={indexData}
          locale={locale}
          currentLevel={level}
          levels={levelSummaries}
          chapters={chapters}
          categoryLabels={categoryLabels}
          searchIndex={searchIndex}
        />
      </Suspense>
    </>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="bg-gray-200 dark:bg-dark-700 rounded-lg h-32 animate-pulse"
        />
      ))}
    </div>
  )
}
