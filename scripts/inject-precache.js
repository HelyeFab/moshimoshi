#!/usr/bin/env node

/**
 * Build Script: Inject Hashed Assets into Service Worker
 *
 * This script scans the Next.js build output for hashed static assets
 * and injects them into the service worker's PRECACHE_URLS array.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const SW_PATH = path.join(__dirname, '../public/service-worker.js');
const PUBLIC_DIR = path.join(__dirname, '../public');
const BUILD_DIR = path.join(__dirname, '../.next');
const BUILD_MANIFEST_PATH = path.join(BUILD_DIR, 'build-manifest.json');

/**
 * Copy build static files to public directory and get list
 */
function copyAndGetStaticFiles() {
  const files = [];

  // Check if build directory exists
  if (!fs.existsSync(BUILD_DIR)) {
    console.warn('⚠️  Build directory not found. Run "npm run build" first.');
    return files;
  }

  // Read build manifest to get app files
  if (fs.existsSync(BUILD_MANIFEST_PATH)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(BUILD_MANIFEST_PATH, 'utf-8'));

      // Get all CSS and JS files from the manifest
      const allFiles = new Set();

      // Process pages
      Object.values(manifest.pages || {}).forEach(pageFiles => {
        if (Array.isArray(pageFiles)) {
          pageFiles.forEach(file => {
            if (file.endsWith('.js') || file.endsWith('.css')) {
              allFiles.add(file);
            }
          });
        }
      });

      // Add files to precache list
      allFiles.forEach(file => {
        files.push(file.startsWith('/') ? file : '/' + file);
      });
    } catch (error) {
      console.warn('⚠️  Could not parse build manifest:', error.message);
    }
  }

  // Get CSS files from .next/static/css
  const cssDir = path.join(BUILD_DIR, 'static/css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir);
    cssFiles.forEach(file => {
      if (file.endsWith('.css')) {
        const buildId = getBuildId();
        if (buildId) {
          files.push(`/_next/static/css/${file}`);

          // Copy to public directory
          const publicCssDir = path.join(PUBLIC_DIR, '_next/static/css');
          fs.mkdirSync(publicCssDir, { recursive: true });
          fs.copyFileSync(
            path.join(cssDir, file),
            path.join(publicCssDir, file)
          );
        }
      }
    });
  }

  // Add essential static files
  const essentialFiles = [
    '/offline.html',
    '/manifest.json',
    '/favicon.ico',
    '/favicon-192x192.png',
    '/favicon-512x512.png'
  ];

  essentialFiles.forEach(file => {
    const filePath = path.join(PUBLIC_DIR, file);
    if (fs.existsSync(filePath)) {
      files.push(file);
    }
  });

  // Add main app chunks (framework, main, webpack-runtime)
  const chunksDir = path.join(BUILD_DIR, 'static/chunks');
  if (fs.existsSync(chunksDir)) {
    const chunkFiles = fs.readdirSync(chunksDir);
    const importantChunks = ['framework', 'main', 'webpack', 'polyfills'];

    chunkFiles.forEach(file => {
      if (file.endsWith('.js') && importantChunks.some(chunk => file.includes(chunk))) {
        const buildId = getBuildId();
        if (buildId) {
          files.push(`/_next/static/chunks/${file}`);
        }
      }
    });
  }

  return [...new Set(files)]; // Remove duplicates
}

/**
 * Get Next.js build ID
 */
function getBuildId() {
  const buildIdPath = path.join(BUILD_DIR, 'BUILD_ID');
  if (fs.existsSync(buildIdPath)) {
    return fs.readFileSync(buildIdPath, 'utf-8').trim();
  }

  // Try to extract from directory structure
  const staticDir = path.join(BUILD_DIR, 'static');
  if (fs.existsSync(staticDir)) {
    const dirs = fs.readdirSync(staticDir);
    // Build ID is typically a hash-like directory name
    const buildId = dirs.find(dir => /^[a-zA-Z0-9_-]+$/.test(dir) && dir.length > 10);
    return buildId;
  }

  return null;
}

/**
 * Calculate hash for cache version
 */
function calculateCacheVersion() {
  const timestamp = Date.now();
  const hash = crypto.createHash('sha256')
    .update(timestamp.toString())
    .digest('hex')
    .substring(0, 8);
  return `moshimoshi-v${hash}`;
}

/**
 * Update service worker with precache URLs
 */
function updateServiceWorker(files) {
  if (!fs.existsSync(SW_PATH)) {
    console.error('❌ Service worker not found at:', SW_PATH);
    process.exit(1);
  }

  let swContent = fs.readFileSync(SW_PATH, 'utf-8');

  // Generate precache array
  const precacheArray = files.map(file => `  '${file}'`).join(',\n');

  // Update PRECACHE_URLS
  const precacheRegex = /const PRECACHE_URLS = \[[^\]]*\];/s;
  const newPrecacheUrls = `const PRECACHE_URLS = [\n${precacheArray}\n];`;

  if (precacheRegex.test(swContent)) {
    swContent = swContent.replace(precacheRegex, newPrecacheUrls);
  } else {
    console.error('❌ Could not find PRECACHE_URLS in service worker');
    process.exit(1);
  }

  // Update CACHE_VERSION
  const version = calculateCacheVersion();
  const versionRegex = /const CACHE_VERSION = '[^']+';/;
  swContent = swContent.replace(versionRegex, `const CACHE_VERSION = '${version}';`);

  // Write updated service worker
  fs.writeFileSync(SW_PATH, swContent);

  console.log('✅ Service worker updated successfully');
  console.log(`📦 Precached ${files.length} files`);
  console.log(`🏷️  Cache version: ${version}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🔧 Injecting precache URLs into service worker...\n');

  const files = copyAndGetStaticFiles();

  if (files.length === 0) {
    console.warn('⚠️  No static files found to precache');
    console.warn('   Make sure to run "npm run build" before this script');
    return;
  }

  console.log(`📋 Found ${files.length} files to precache`);

  updateServiceWorker(files);

  console.log('\n✨ Done! Service worker is ready for deployment.');
}

// Run the script
main();