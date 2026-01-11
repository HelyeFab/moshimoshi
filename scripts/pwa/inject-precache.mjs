import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const SW_PATH = path.join(ROOT, 'public', 'service-worker.js');
const APP_MANIFEST_PATH = path.join(ROOT, '.next', 'app-build-manifest.json');
const BUILD_MANIFEST_PATH = path.join(ROOT, '.next', 'build-manifest.json');

const REQUIRED_FILES = [SW_PATH, APP_MANIFEST_PATH, BUILD_MANIFEST_PATH];
for (const filePath of REQUIRED_FILES) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

const appManifest = JSON.parse(fs.readFileSync(APP_MANIFEST_PATH, 'utf8'));
const buildManifest = JSON.parse(fs.readFileSync(BUILD_MANIFEST_PATH, 'utf8'));

const precacheFiles = new Set();

function addFiles(files = []) {
  for (const file of files) {
    if (typeof file !== 'string') continue;
    precacheFiles.add(file);
  }
}

const appPages = appManifest.pages || {};
for (const [route, files] of Object.entries(appPages)) {
  if (route.startsWith('/api/') || route.endsWith('/route')) {
    continue;
  }
  addFiles(files);
}

addFiles(buildManifest.polyfillFiles);
addFiles(buildManifest.lowPriorityFiles);
addFiles(buildManifest.rootMainFiles);

const pages = buildManifest.pages || {};
for (const files of Object.values(pages)) {
  addFiles(files);
}

const precacheUrls = Array.from(precacheFiles)
  .map((file) => (file.startsWith('/') ? file : `/_next/${file}`))
  .filter((file) => file.startsWith('/_next/static/'))
  .sort();

const hash = crypto
  .createHash('sha1')
  .update(precacheUrls.join('\n'))
  .digest('hex')
  .slice(0, 12);

const cacheVersion = `moshimoshi-${hash}`;

const swSource = fs.readFileSync(SW_PATH, 'utf8');
const cacheVersionPattern = /const CACHE_VERSION = ['"][^'"]*['"];?/;
const precachePattern = /const PRECACHE_URLS = [\s\S]*?\.concat\(MANUAL_PRECACHE_URLS\);/;
const precacheLiteral = `${JSON.stringify(precacheUrls, null, 2)}.concat(MANUAL_PRECACHE_URLS)`;

let updated = swSource;

if (updated.includes('__CACHE_VERSION__')) {
  updated = updated.replace('__CACHE_VERSION__', cacheVersion);
} else if (cacheVersionPattern.test(updated)) {
  updated = updated.replace(cacheVersionPattern, `const CACHE_VERSION = '${cacheVersion}';`);
} else {
  throw new Error('Service worker CACHE_VERSION placeholder or declaration not found.');
}

if (updated.includes('__PRECACHE_URLS__')) {
  updated = updated.replace('__PRECACHE_URLS__', JSON.stringify(precacheUrls, null, 2));
} else if (precachePattern.test(updated)) {
  updated = updated.replace(precachePattern, `const PRECACHE_URLS = ${precacheLiteral};`);
} else {
  throw new Error('Service worker PRECACHE_URLS placeholder or declaration not found.');
}

fs.writeFileSync(SW_PATH, updated);

console.log(`[PWA] Injected ${precacheUrls.length} precache URLs`);
console.log(`[PWA] CACHE_VERSION=${cacheVersion}`);
