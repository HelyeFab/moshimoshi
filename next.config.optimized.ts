/**
 * Optimized Next.js Configuration
 * Week 2 - Bundle Size Optimization
 * Target: <200KB gzipped bundle size
 */

import type { NextConfig } from 'next'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Image optimization
  images: {
    domains: ['firebasestorage.googleapis.com'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  
  // Enable SWC minification
  swcMinify: true,
  
  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    
    // Enable emotion if using it
    // emotion: true,
    
    // Dead code elimination
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },
  
  // Experimental features for optimization
  experimental: {
    // Optimize CSS
    optimizeCss: true,
    
    // Module federation for code splitting
    // Enable if using micro-frontends
    // moduleFederation: true,
    
    // Optimize package imports
    optimizePackageImports: [
      'firebase',
      'firebase-admin',
      '@mui/material',
      'react-icons',
      'lodash',
    ],
    
    // Server Components optimization
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@prisma/client',
    ],
  },
  
  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      // Replace React with Preact in production (saves ~30KB)
      // Only enable if fully compatible
      // config.resolve.alias = {
      //   ...config.resolve.alias,
      //   'react': 'preact/compat',
      //   'react-dom': 'preact/compat',
      // }
      
      // Optimize moment.js (if used)
      config.plugins.push(
        new (require('webpack').IgnorePlugin)({
          resourceRegExp: /^\.\/locale$/,
          contextRegExp: /moment$/,
        })
      )
      
      // Bundle analyzer in production builds
      if (process.env.ANALYZE === 'true') {
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: './analyze.html',
            openAnalyzer: false,
          })
        )
      }
    }
    
    // Tree shaking optimization
    config.optimization = {
      ...config.optimization,
      usedExports: true,
      sideEffects: false,
      
      // Module concatenation
      concatenateModules: true,
      
      // Split chunks configuration
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          
          // Framework chunk
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          
          // Common libraries
          lib: {
            test(module: any) {
              return module.size() > 160000 &&
                /node_modules[\\/]/.test(module.identifier())
            },
            name(module: any) {
              const hash = require('crypto')
                .createHash('sha1')
                .update(module.identifier())
                .digest('hex')
              return `lib-${hash.substring(0, 8)}`
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          
          // Commons chunk
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
            reuseExistingChunk: true,
          },
          
          // Shared modules
          shared: {
            name(module: any, chunks: any) {
              const hash = require('crypto')
                .createHash('sha1')
                .update(chunks.map((c: any) => c.name).join('_'))
                .digest('hex')
              return `shared-${hash.substring(0, 8)}`
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
        
        // Maximum number of parallel requests
        maxAsyncRequests: 6,
        maxInitialRequests: 4,
      },
      
      // Runtime chunk optimization
      runtimeChunk: {
        name: 'runtime',
      },
      
      // Module IDs
      moduleIds: 'deterministic',
    }
    
    // Alias heavy libraries
    config.resolve.alias = {
      ...config.resolve.alias,
      
      // Use lighter alternatives where possible
      'lodash': 'lodash-es',
      
      // Prevent duplicate React versions
      'react': require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
    }
    
    // External large libraries for CDN loading (optional)
    if (!isServer) {
      config.externals = {
        ...config.externals,
        // Example: Load React from CDN
        // 'react': 'React',
        // 'react-dom': 'ReactDOM',
      }
    }
    
    return config
  },
  
  // Headers for compression
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  
  // Redirects for optimization
  async redirects() {
    return []
  },
  
  // Rewrites for optimization
  async rewrites() {
    return []
  },
  
  // Module transpilation
  transpilePackages: [
    // Add packages that need transpilation
  ],
  
  // Output configuration
  output: 'standalone',
  
  // Disable source maps in production for smaller builds
  productionBrowserSourceMaps: false,
  
  // Compress output
  compress: true,
  
  // PoweredByHeader
  poweredByHeader: false,
  
  // Generate ETags
  generateEtags: true,
  
  // Page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // Trailing slash
  trailingSlash: false,
  
  // Base path (if deployed to subdirectory)
  // basePath: '/app',
  
  // Asset prefix (if using CDN)
  // assetPrefix: 'https://cdn.example.com',
}

export default nextConfig