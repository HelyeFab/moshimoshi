import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Headers configuration for security and authentication
  async headers() {
    return [
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
    ]
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
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs' module on the client to prevent this error
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      }
    }
    return config
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
  // MVP: Remove console logs in production for cleaner output and smaller bundle
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  env: {
    // Pricing configuration - these will be available client-side
    NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '',
    NEXT_PUBLIC_STRIPE_PRICE_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || '',
    NEXT_PUBLIC_STRIPE_MONTHLY_AMOUNT: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_AMOUNT || '9.99',
    NEXT_PUBLIC_STRIPE_YEARLY_AMOUNT: process.env.NEXT_PUBLIC_STRIPE_YEARLY_AMOUNT || '89.99',
    NEXT_PUBLIC_STRIPE_CURRENCY: process.env.NEXT_PUBLIC_STRIPE_CURRENCY || 'USD',
  },
}

export default nextConfig
