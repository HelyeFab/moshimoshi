import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/lib/theme/ThemeContext'
import { ToastProvider } from '@/components/ui/Toast/ToastContext'
// import { ContentProtectionProvider } from '@/components/providers/ContentProtectionProvider'
import { I18nProvider } from '@/i18n/I18nContext'
import { AuthProvider } from '@/hooks/useAuth' // Compatibility wrapper - not actually needed but keeps layout consistent
import { ServiceWorkerProvider } from '@/components/pwa/ServiceWorkerProvider'
import CelebrationProvider from '@/components/gamification/CelebrationProvider'
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner'
import { themeInitScript } from '@/lib/theme/theme-script'
import { suppressFirestoreErrors } from '@/lib/firebase/suppress-errors'
import '@/styles/globals.css'
import TimeMachineButton from '@/components/dev/TimeMachineButton'

export const metadata: Metadata = {
  title: {
    default: 'Moshimoshi - Best Japanese Learning App 2025 | YouTube Shadowing, Anki Import, Genki & Kanji Connection',
    template: '%s | Moshimoshi',
  },
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
  authors: [{ name: 'Moshimoshi Team' }],
  creator: 'Moshimoshi',
  publisher: 'Moshimoshi',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://moshimoshi.app',
    siteName: 'Moshimoshi',
    title: 'Learn Japanese Online - Best Japanese Learning App 2025',
    description: 'Master Japanese with SRS flashcards, JLPT preparation, kanji browser, YouTube shadowing & more',
    images: [
      {
        url: 'https://moshimoshi.app/moshimoshi-logo.png',
        width: 1200,
        height: 630,
        alt: 'Moshimoshi - Learn Japanese',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Learn Japanese Online - Best Japanese Learning App 2025',
    description: 'Master Japanese with SRS, JLPT prep, YouTube shadowing & more',
    creator: '@moshimoshiapp',
    images: ['https://moshimoshi.app/moshimoshi-logo.png'],
  },
  alternates: {
    canonical: 'https://moshimoshi.app',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a202c',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Schema.org JSON-LD structured data for SEO
  const schemaData = {
    '@context': 'https://schema.org',
    '@graph': [
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: suppressFirestoreErrors }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider defaultPosition="top-right">
            <I18nProvider>
              <ThemeProvider>
                <ServiceWorkerProvider>
                  <CelebrationProvider>
                    <EmailVerificationBanner />
                    {children}
                    {process.env.NODE_ENV === 'development' && <TimeMachineButton />}
                  </CelebrationProvider>
                </ServiceWorkerProvider>
              </ThemeProvider>
            </I18nProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}