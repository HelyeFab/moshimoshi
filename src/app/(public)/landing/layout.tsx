import type { Metadata } from 'next'

// Force dynamic rendering for i18n support
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Moshimoshi - Best Japanese Learning App 2025 | YouTube Shadowing, Anki Import, Genki & Kanji Connection',
  description: 'Revolutionary Japanese learning platform with YouTube shadowing for native pronunciation, one-click Anki deck import, complete Genki & Minna no Nihongo vocabulary, unique kanji connection system with visual patterns and families, 2136 jōyō kanji browser, SRS flashcards, JLPT N5-N1 preparation, interactive games, and progress tracking. Import your Anki decks, practice with real YouTube videos, master kanji through visual relationships, and study with worldwide textbooks. The complete Japanese learning solution.',
  keywords: [
    'best Japanese learning app 2025',
    'YouTube shadowing Japanese',
    'import Anki decks Japanese',
    'Genki vocabulary app',
    'Minna no Nihongo app',
    'kanji connection system',
    'kanji visual patterns',
    'Japanese learning platform',
    'JLPT preparation app',
    'Japanese SRS flashcards',
    'Anki alternative Japanese',
    'shadowing technique app',
    'textbook Japanese learning',
    'kanji families system',
    'phonetic components kanji',
    'Japanese drama learning',
    'comprehensive Japanese app',
    'all-in-one Japanese learning',
    'Japanese textbook companion',
    'kanji radical search',
  ],
  openGraph: {
    title: 'Moshimoshi - Best Japanese Learning App 2025',
    description: 'YouTube Shadowing, Anki Import, Genki/Minna Vocabulary, Kanji Connection System & Complete JLPT Preparation',
    url: 'https://moshimoshi.app',
    images: [
      {
        url: '/moshimoshi-logo.png',
        width: 1200,
        height: 630,
        alt: 'Moshimoshi Japanese Learning Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Moshimoshi - Revolutionary Japanese Learning Platform',
    description: 'YouTube Shadowing, Anki Import, Genki Vocabulary, Kanji Connection System & More',
    images: ['/moshimoshi-logo.png'],
  },
  alternates: {
    canonical: 'https://moshimoshi.app',
  },
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Schema.org JSON-LD structured data for SEO
  const schemaData = {
    '@context': 'https://schema.org',
    '@graph': [
      // Organization Schema
      {
        '@type': 'Organization',
        '@id': 'https://moshimoshi.app/#organization',
        name: 'Moshimoshi',
        url: 'https://moshimoshi.app',
        logo: {
          '@type': 'ImageObject',
          url: 'https://moshimoshi.app/moshimoshi-logo.png',
        },
        sameAs: [
          'https://twitter.com/moshimoshiapp',
          'https://github.com/moshimoshiapp',
        ],
      },
      // SoftwareApplication Schema
      {
        '@type': 'SoftwareApplication',
        name: 'Moshimoshi',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web, iOS, Android',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free tier with optional premium features',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          ratingCount: '1250',
        },
        featureList: [
          'YouTube Shadowing',
          'Anki Deck Import',
          'Kanji Connection System',
          'Textbook Integration (Genki, Minna no Nihongo)',
          'SRS Flashcards',
          'JLPT Preparation',
          'Interactive Games',
          'Progress Tracking',
        ],
        description:
          'Comprehensive Japanese learning platform with YouTube shadowing, Anki import, kanji connection system, and textbook integration.',
      },
      // LearningResource Schema
      {
        '@type': 'LearningResource',
        name: 'Moshimoshi Japanese Learning Platform',
        description:
          'Master Japanese with YouTube shadowing, intelligent kanji connections, one-click Anki import, and complete textbook integration.',
        educationalLevel: 'Beginner to Advanced (JLPT N5-N1)',
        teaches: 'Japanese Language',
        learningResourceType: 'Interactive Learning Platform',
        inLanguage: ['en', 'ja', 'fr', 'de', 'es', 'it'],
      },
      // Website Schema
      {
        '@type': 'WebSite',
        '@id': 'https://moshimoshi.app/#website',
        url: 'https://moshimoshi.app',
        name: 'Moshimoshi',
        publisher: {
          '@id': 'https://moshimoshi.app/#organization',
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://moshimoshi.app/search?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      {children}
    </>
  )
}
