import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { themeInitScript } from '@/lib/theme/theme-script';
import { suppressFirestoreErrors } from '@/lib/firebase/suppress-errors';
import { Analytics } from '@vercel/analytics/react';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://moshimoshi.app'),
  title: {
    default:
      'Moshimoshi - Best Japanese Learning App 2025 | YouTube Shadowing, Anki Import, Genki & Kanji Connection',
    template: '%s | Moshimoshi',
  },
  description:
    'Revolutionary Japanese learning platform with YouTube shadowing for native pronunciation, one-click Anki deck import, complete Genki & Minna no Nihongo vocabulary, unique kanji connection system with visual patterns and families, 2136 joyo kanji browser, SRS flashcards, JLPT N5-N1 preparation, interactive games, and progress tracking. Import your Anki decks, practice with real YouTube videos, master kanji through visual relationships, and study with worldwide textbooks. The complete Japanese learning solution.',
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
    description:
      'Master Japanese with SRS flashcards, JLPT preparation, kanji browser, YouTube shadowing & more',
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
    apple: [
      { url: '/apple-touch-icon.svg' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Moshimoshi',
    statusBarStyle: 'black-translucent',
    startupImage: [
      // iPhone 17 Pro Max, 16 Pro Max
      {
        url: '/splash/iPhone_17_Pro_Max__iPhone_16_Pro_Max_portrait.png',
        media:
          'screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 17 Pro, 17, 16 Pro
      {
        url: '/splash/iPhone_17_Pro__iPhone_17__iPhone_16_Pro_portrait.png',
        media:
          'screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max
      {
        url: '/splash/iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png',
        media:
          'screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone Air
      {
        url: '/splash/iPhone_Air_portrait.png',
        media:
          'screen and (device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 16, 15 Pro, 15, 14 Pro
      {
        url: '/splash/iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png',
        media:
          'screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 14 Plus, 13 Pro Max, 12 Pro Max
      {
        url: '/splash/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png',
        media:
          'screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 16e, 14, 13 Pro, 13, 12 Pro, 12
      {
        url: '/splash/iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png',
        media:
          'screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 13 mini, 12 mini, 11 Pro, XS, X
      {
        url: '/splash/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png',
        media:
          'screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 11 Pro Max, XS Max
      {
        url: '/splash/iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png',
        media:
          'screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 11, XR
      {
        url: '/splash/iPhone_11__iPhone_XR_portrait.png',
        media:
          'screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // iPhone 8 Plus, 7 Plus, 6s Plus, 6 Plus
      {
        url: '/splash/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png',
        media:
          'screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // iPhone 8, 7, 6s, 6, 4.7" SE
      {
        url: '/splash/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png',
        media:
          'screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 4" iPhone SE, iPod touch
      {
        url: '/splash/4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png',
        media:
          'screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 13" iPad Pro M4
      {
        url: '/splash/13__iPad_Pro_M4_portrait.png',
        media:
          'screen and (device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 12.9" iPad Pro
      {
        url: '/splash/12.9__iPad_Pro_portrait.png',
        media:
          'screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 11" iPad Pro M4
      {
        url: '/splash/11__iPad_Pro_M4_portrait.png',
        media:
          'screen and (device-width: 834px) and (device-height: 1210px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 11" iPad Pro, 10.5" iPad Pro
      {
        url: '/splash/11__iPad_Pro__10.5__iPad_Pro_portrait.png',
        media:
          'screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 10.9" iPad Air
      {
        url: '/splash/10.9__iPad_Air_portrait.png',
        media:
          'screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 10.5" iPad Air
      {
        url: '/splash/10.5__iPad_Air_portrait.png',
        media:
          'screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 10.2" iPad
      {
        url: '/splash/10.2__iPad_portrait.png',
        media:
          'screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 9.7" iPad Pro, 7.9" iPad mini, 9.7" iPad Air, 9.7" iPad
      {
        url: '/splash/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png',
        media:
          'screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      // 8.3" iPad Mini
      {
        url: '/splash/8.3__iPad_Mini_portrait.png',
        media:
          'screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
    ],
  },
  formatDetection: {
    telephone: false, // Prevent auto-linking phone numbers
  },
  other: {
    'mobile-web-app-capable': 'yes', // Android Chrome full-screen
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Edge-to-edge on notched devices
  interactiveWidget: 'resizes-content', // Fix Chrome PWA viewport bug
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a202c' },
  ],
};

/**
 * Root layout - minimal wrapper for HTML structure.
 * All providers are in the locale-specific layout at /[locale]/layout.tsx.
 *
 * This root layout:
 * 1. Provides the HTML structure with essential meta tags
 * 2. Loads global CSS
 * 3. Includes theme and error suppression scripts
 * 4. Includes structured data for SEO
 * 5. Sets the HTML lang attribute based on the current locale from middleware
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Get locale from middleware header for server-side lang attribute
  const headersList = await headers();
  const locale = headersList.get('x-locale') || 'en';
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
        sameAs: ['https://twitter.com/moshimoshiapp', 'https://github.com/moshimoshiapp'],
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
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Explicit viewport meta tag for PWA edge-to-edge */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: suppressFirestoreErrors }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-background-light dark:bg-dark-850"
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
