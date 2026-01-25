import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Create the next-intl plugin with the path to our i18n configuration.
 * This enables server-side locale handling and message loading.
 */
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Headers configuration for security and authentication
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/service-worker.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/service-worker.dev.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        // Apply to all routes - needed for Firebase Google Sign-In popup
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },

  // SEO-friendly 301 redirects
  async redirects() {
    return [
      {
        source: '/:locale/village/qa',
        destination: '/:locale/village/tea-house',
        permanent: true, // 301 redirect
      },
      {
        source: '/:locale/village/qa/:path*',
        destination: '/:locale/village/tea-house/:path*',
        permanent: true, // 301 redirect
      },
    ];
  },

  images: {
    domains: [
      'firebasestorage.googleapis.com',
      'lh3.googleusercontent.com', // Google profile images
      'storage.googleapis.com', // Firebase Storage custom uploads
    ],
  },
  eslint: {
    // Temporarily disabled for pre-production testing - re-enable after fixing warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Strict TypeScript checking enabled - all route types properly configured for Next.js 15
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['@opentelemetry/instrumentation', '@opentelemetry/api'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs' module on the client to prevent this error
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: [
        '**/.next/**',
        '**/node_modules/**',
        '**/01_PRODUCTION_DOCS/**',
        '**/moshi-comics/**',
        '**/notebooklm-backups/**',
        '**/docs/**',
        '**/.git/**',
        '**/backups/**',
        '**/tmp/**',
      ],
    };
    return config;
  },
  experimental: {
    // MVP: Optimize package imports to reduce bundle size
    optimizePackageImports: [
      '@heroicons/react',
      'lucide-react',
      'recharts',
      'react-icons',
      '@radix-ui/react-slot',
      'date-fns',
      'framer-motion',
    ],
  },
  // Ensure kuromoji dictionary files are bundled for serverless routes
  outputFileTracingIncludes: {
    '/api/word/precompute': ['node_modules/kuromoji/dict/**'],
    '/api/word/precompute/test': ['node_modules/kuromoji/dict/**'],
    '/api/tatoeba/search': ['src/data/sentences/tatoeba/**'],
    '/api/tatoeba/random': ['src/data/sentences/tatoeba/**'],
    '/api/tatoeba/meaning': ['src/data/sentences/tatoeba/**'],
    '/api/drill/session': [
      'public/data/dictionary/jmdict-eng-common.json',
      'src/data/dictionary/jmdict-eng-common.json',
    ],
    '/api/furigana': ['public/kuromoji_dict/**'],
    '/api/furigana/tokenize': ['public/kuromoji_dict/**'],
    '/api/kanji/by-family': ['public/data/kanji/**'],
    '/api/kanji/by-radical': ['public/data/kanji/**'],
    '/[locale]/learn/grammar/[pointId]': ['public/data/grammar/**'],
    '/[locale]/learn/grammar/grammarHub': ['public/data/grammar/**'],
    '/[locale]/learn/grammar/sitemap': ['public/data/grammar/**'],
  },
  // Remove console logs in production for cleaner output and smaller bundle
  // TEMP: Disabled for reCAPTCHA debugging - re-enable after verifying fix
  compiler: {
    // removeConsole: process.env.NODE_ENV === 'production',
  },
  env: {
    // Pricing configuration - these will be available client-side
    NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '',
    NEXT_PUBLIC_STRIPE_PRICE_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || '',
    NEXT_PUBLIC_STRIPE_MONTHLY_AMOUNT: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_AMOUNT || '9.99',
    NEXT_PUBLIC_STRIPE_YEARLY_AMOUNT: process.env.NEXT_PUBLIC_STRIPE_YEARLY_AMOUNT || '89.99',
    NEXT_PUBLIC_STRIPE_CURRENCY: process.env.NEXT_PUBLIC_STRIPE_CURRENCY || 'USD',
  },
};

// Apply the next-intl plugin to the Next.js configuration
export default withNextIntl(nextConfig);
