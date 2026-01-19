/**
 * Moshimoshi PWA Service Worker - Production Ready
 * Version: 4.0.0
 *
 * STRICT CACHE DISCIPLINE:
 * - Only precaches hashed static assets
 * - No runtime caching of API/dynamic data
 * - Minimal, auditable, and safe
 */

// Debug mode - enable verbose logging only on local dev hosts
const DEBUG =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.endsWith('.local');

// Logging wrappers - only log when DEBUG is enabled
const log = DEBUG ? console.log.bind(console) : () => {};
const warn = DEBUG ? console.warn.bind(console) : () => {};
// Always keep console.error for critical issues

const CACHE_VERSION = 'moshimoshi-dbbd74886393';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Audio cache configuration
const AUDIO_CACHE_CONFIG = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxEntries: 250, // ~200 kana + buffer for other audio
};

const IMAGE_CACHE_CONFIG = {
  maxEntries: 200,
};

// Pages to cache for offline use (Learning Village and foundation features)
// These pages will be cached when visited and served offline
const OFFLINE_ENABLED_PAGES = [
  '/dashboard',           // Learning Village main page
  '/learn/hiragana',      // Hiragana learning
  '/learn/katakana',      // Katakana learning
  '/kanji-browser',       // Kanji browser (uses precached JSON)
  '/drill',               // Kana drill
  '/learn/conjugation',   // Verb conjugation
  '/vocabulary',          // Vocabulary (Jisho has embedded data)
  '/news',                // News page (articles cached in IndexedDB)
  '/library',             // Library page (books cached in IndexedDB)
  '/stories',             // Stories page (stories cached in IndexedDB)
  '/kanji-moods',         // Kanji moodboards (moodboards cached in IndexedDB)
  '/kanji-connection',    // Kanji connections (families/radicals/SKIP cached in IndexedDB)
  '/comics',              // Comics page (episodes cached in IndexedDB)
  '/flashcards',          // Flashcards page (has dedicated SyncManager for offline)
  '/lists',               // User lists (uses IndexedDB as primary storage)
  '/textbook-vocabulary', // Textbook vocabulary (static bundled JSON data)
  '/tools/kanji-mastery', // Kanji mastery (static kanji data cached per level)
  '/blog',                // Blog list + detail (cached in localStorage)
  '/resources',           // Resources list + detail (cached in localStorage)
];

const LOCALE_PREFIX_REGEX = /^[a-z]{2,3}(?:-[a-z]{2})?$/i;

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return pathname;
  const parts = pathname.split('/');
  const maybeLocale = parts[1];

  if (maybeLocale && LOCALE_PREFIX_REGEX.test(maybeLocale)) {
    const rest = parts.slice(2).join('/');
    return rest ? `/${rest}` : '/';
  }

  return pathname;
}

function isOfflineEnabledPath(pathname) {
  const normalized = normalizePathname(pathname);
  return OFFLINE_ENABLED_PAGES.some(page =>
    pathname === page ||
    pathname.startsWith(page + '/') ||
    normalized === page ||
    normalized.startsWith(page + '/')
  );
}

function extractRscPath(rscParam) {
  if (!rscParam) return null;
  if (rscParam.startsWith('/')) return rscParam;
  if (rscParam.includes('/')) {
    const match = rscParam.match(/(\/[a-z0-9\-/_]+)$/i);
    return match ? match[1] : null;
  }
  return null;
}

// Precache URLs - injected by build script
const MANUAL_PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/doshi.png',

  // Learning Village stall images (Phase 1 - Offline Support)
  '/ui/flat-icons/stalls/ceramics.png',
  '/ui/flat-icons/stalls/food-cart (1).png',
  '/ui/flat-icons/stalls/food-cart.png',
  '/ui/flat-icons/stalls/food-stall (1).png',
  '/ui/flat-icons/stalls/food-stall (2).png',
  '/ui/flat-icons/stalls/food-stall.png',
  '/ui/flat-icons/stalls/food-stand (1).png',
  '/ui/flat-icons/stalls/food-stand.png',
  '/ui/flat-icons/stalls/stall (1).png',
  '/ui/flat-icons/stalls/stall-food.png',
  '/ui/flat-icons/stalls/stall.png',
  '/ui/flat-icons/stalls/stand.png',
  '/ui/flat-icons/stalls/street-food.png',

  // Kanji JLPT data files (Phase 2 - Foundation Features Offline)
  '/data/kanji/jlpt_1.json',
  '/data/kanji/jlpt_2.json',
  '/data/kanji/jlpt_3.json',
  '/data/kanji/jlpt_4.json',
  '/data/kanji/jlpt_5.json'
];
const PRECACHE_URLS = [
  "/_next/static/8nGf0JGEBh30DWYRVgoK1/_buildManifest.js",
  "/_next/static/8nGf0JGEBh30DWYRVgoK1/_ssgManifest.js",
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/10627-bcf644fe12302657.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/11599-e986443a5e668d37.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/12698-9ca5ddbfd778b412.js",
  "/_next/static/chunks/13523-fd15821c144a9307.js",
  "/_next/static/chunks/14395-53bee37eae81e3d3.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14673-e7741737d0d4eb68.js",
  "/_next/static/chunks/14777-519d0e9b10e6b729.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/15361-9056bd6d4f47f1e4.js",
  "/_next/static/chunks/16233-ab46074045868d1c.js",
  "/_next/static/chunks/16371-f1d0c5882f12a217.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/1673-8f625db55ae992b4.js",
  "/_next/static/chunks/17401-141e014b66b5574e.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/20461-cbea971ba25d4726.js",
  "/_next/static/chunks/20840-74298529122f4d4f.js",
  "/_next/static/chunks/21544-a8f0b60cb83afb43.js",
  "/_next/static/chunks/21960-09ff5572ac58ce6c.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-f7480e9567d150b8.js",
  "/_next/static/chunks/23868-20854aed872efc80.js",
  "/_next/static/chunks/23930-b7fde159df4d447e.js",
  "/_next/static/chunks/24146-3c5faee6bd4acfd2.js",
  "/_next/static/chunks/24366-8e5f186083492b7d.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25410-7df4cc370d951ab3.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/27183-39d671770276cc31.js",
  "/_next/static/chunks/27890-aec9d745132f95ca.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31316-74298529122f4d4f.js",
  "/_next/static/chunks/31480-1c9fc6c89db6093d.js",
  "/_next/static/chunks/32790-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/34196-0c4cea4127f5ff78.js",
  "/_next/static/chunks/34244-5c3af7374b9079ca.js",
  "/_next/static/chunks/35925-9ef41eca727c630e.js",
  "/_next/static/chunks/37005-8b4610f027540d23.js",
  "/_next/static/chunks/3708-d0ffdf04b8ed76d9.js",
  "/_next/static/chunks/37255-5cc8273e9e6991e5.js",
  "/_next/static/chunks/38017-61306c41814baf27.js",
  "/_next/static/chunks/38151-b7dc66cc3d7c8713.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/38477-54e41718040f84cf.js",
  "/_next/static/chunks/39035-455c41cf78dcd6ad.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/45161-6373c2a3e4bda930.js",
  "/_next/static/chunks/45254-5903a698e0ada70a.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-04d89b9120557c53.js",
  "/_next/static/chunks/46693-9fdcdf28acd12b95.js",
  "/_next/static/chunks/46788-df8ca2a2ada40840.js",
  "/_next/static/chunks/47919-0f1ac89d8e33293e.js",
  "/_next/static/chunks/49882-9a836a5347a47a9a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50443-56e61b140c52d8dc.js",
  "/_next/static/chunks/52311-2c6107a81ff6a106.js",
  "/_next/static/chunks/52413-cd55ee3744bbb00a.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/52826-07d53be4c1f7eca0.js",
  "/_next/static/chunks/53005-537433508e12a878.js",
  "/_next/static/chunks/53697-74298529122f4d4f.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-89fe02c9cc60591f.js",
  "/_next/static/chunks/53828-eb0bf47e13b5ca1e.js",
  "/_next/static/chunks/54469-80a2f9dda48676d7.js",
  "/_next/static/chunks/54a60aa6-fde3c27555179f9b.js",
  "/_next/static/chunks/55191-538723d65b120d53.js",
  "/_next/static/chunks/56526-532e6cab94648e55.js",
  "/_next/static/chunks/57130-aa1bc7ce6e1d6aa6.js",
  "/_next/static/chunks/57292-f34b06cd3b7d26e6.js",
  "/_next/static/chunks/57604-7726abae737bf68b.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/58344-d9122078ae515803.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-8b4610f027540d23.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-94575a6e0e50b932.js",
  "/_next/static/chunks/60657-25b0336619baae0d.js",
  "/_next/static/chunks/61324-4e990da90c694db1.js",
  "/_next/static/chunks/62310-8d3114cfda636653.js",
  "/_next/static/chunks/63140-a7e3d0da43b48780.js",
  "/_next/static/chunks/63790-5d51db9e7c6b5dc7.js",
  "/_next/static/chunks/64103-91f6ddb23beb6bd1.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64543-8b7b2aff66ba0270.js",
  "/_next/static/chunks/64961-a9ca6345a7df069d.js",
  "/_next/static/chunks/65053-b7c296b5490bca93.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-96061b07d5c31b05.js",
  "/_next/static/chunks/70092-1096dba3773b475e.js",
  "/_next/static/chunks/70256-1bca8a83f8d7bade.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71835-04c470a83a991e77.js",
  "/_next/static/chunks/72645-10efdd0a1d66cd0b.js",
  "/_next/static/chunks/7439-2cfbd68761add394.js",
  "/_next/static/chunks/74586-d6615e945aa18ea6.js",
  "/_next/static/chunks/74791-4de56691533359c1.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-7a7a1f5ac65836d0.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/77572-538723d65b120d53.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/79297-1889737bfab1aa21.js",
  "/_next/static/chunks/79928-4d089d1413c35906.js",
  "/_next/static/chunks/80137-cb8eaa1347d52e1d.js",
  "/_next/static/chunks/80314-ce791ca26fc6f229.js",
  "/_next/static/chunks/805-b790e7924fb3beaa.js",
  "/_next/static/chunks/8079-4fa57867231df183.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/82182-987957df4aeb3cde.js",
  "/_next/static/chunks/8382-f7480e9567d150b8.js",
  "/_next/static/chunks/84584-362b7b6c9580d167.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/85630-94cff4daa8ff6dab.js",
  "/_next/static/chunks/86480-82c6a93a1896781b.js",
  "/_next/static/chunks/87135-165b64127c326a1c.js",
  "/_next/static/chunks/87342-a9ca6345a7df069d.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88087-69029424f7c77388.js",
  "/_next/static/chunks/88470-5899a6a387eefc6a.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-e66bdfba72b3be0c.js",
  "/_next/static/chunks/88751-c323f07322c58860.js",
  "/_next/static/chunks/90378-7dab995d33ca3267.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/91445-b1767331c9c271e9.js",
  "/_next/static/chunks/92758-d10552e41edd32e9.js",
  "/_next/static/chunks/94997-31159207dfd34514.js",
  "/_next/static/chunks/97627-b15d88a15f0d2da3.js",
  "/_next/static/chunks/98459-74298529122f4d4f.js",
  "/_next/static/chunks/98698-fe89575a2f06e830.js",
  "/_next/static/chunks/99341-5bb921ca23fd36e3.js",
  "/_next/static/chunks/99579-09ff5572ac58ce6c.js",
  "/_next/static/chunks/99707-56209d548cbbee27.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/(home)/page-caf1749a34224b23.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-7af9fa4c9d7c1612.js",
  "/_next/static/chunks/app/[locale]/account/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/account/page-06b7dfbd2bbeb1d0.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/achievements/page-1c8e29a674954649.js",
  "/_next/static/chunks/app/[locale]/admin/auth-debug/page-e06c937f7c0adefa.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-7fdc9ff40fcd1151.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-9b9c80af0ea8e6b2.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-b7d64e3dbd4180cc.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-33a88959f3cace76.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-b26eaf7585ef32d2.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-17accede5aa75c20.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-1d3e102354526d6d.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-cf16adb39b566fab.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-5587eef4a00a8b54.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-7d8018532044e1ec.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-829f7f26f29fb3f6.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-b5ad56366b7f6e72.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-6ed420a855e17120.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-580e67d49379e5d7.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-3d77b8f406c53457.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-a96e12acbe91465b.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-c630316ead495598.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-1a1d1e2caf34ca31.js",
  "/_next/static/chunks/app/[locale]/admin/layout-e1434144f2d7b3f1.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-3ba1927e9d2316c7.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-dabe3e4fa7569d3d.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-fcdd5b7eb278442f.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-b9841770d5588a26.js",
  "/_next/static/chunks/app/[locale]/admin/page-7978577fb95d66c7.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-1929f26b0cfe9385.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-f6ad4d8cccc299cc.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-a62da16294bede5a.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-b01d3b109a7fe5aa.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-3eafe5c23533a0c2.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-702a2cee82a95c36.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-d21ad0b7108e71e6.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-d752afa8837294db.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-7cd39a24be13199a.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-76be5d5349b57b4a.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-55fd77801338fb94.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-1bb3e66c1a046cd7.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-bfc7be4d4307f937.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-9f942272f069d31b.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-8d578caee7dbeb8f.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-c66d38e383b6e82b.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-6d6ac6fc9bca37fc.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-100231e57587f78a.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-7aa7eacfd15f4fa8.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-2b3628b03ce6220f.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-23f85849bbbd5b64.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-0e0667710cf0ffd7.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-8c711f00dba17e5e.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-7dc859e64983db58.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-2fbaa8e4b98b710f.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-7a0fe5eadc01f3bc.js",
  "/_next/static/chunks/app/[locale]/blog/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/blog/page-2e0adec71b67052c.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-9d180204b0be37bf.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-4e083c6dd9a22dd0.js",
  "/_next/static/chunks/app/[locale]/comics/page-0d5fd5fe632bec13.js",
  "/_next/static/chunks/app/[locale]/contact/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/contact/page-14c018b4cf349832.js",
  "/_next/static/chunks/app/[locale]/credits/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/credits/page-5b3323627b16d4f9.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-49338f29541cff74.js",
  "/_next/static/chunks/app/[locale]/debug/auth-google/page-934ebdac4bfae44f.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-561804948b54ad16.js",
  "/_next/static/chunks/app/[locale]/drill/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/drill/page-dc9669bee6139556.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-a5484fe6a5548d32.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-f96146195f14cec6.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-039480708dbe1698.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-175ce73494041805.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-7fda637e60398520.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-733471238b59c282.js",
  "/_next/static/chunks/app/[locale]/games/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/games/page-2671d58a7ea57635.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-6fec2d9744a97ee1.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-bc6c5f519b187620.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-4eca9243d6d8a962.js",
  "/_next/static/chunks/app/[locale]/intro/page-75d9b4c078765d15.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-b93938c3c191091a.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-525bfa857b37c81f.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-fbbb12ab6d73caab.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-6fa6b76f57776300.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-77fb12a87d20d692.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-7e38340a74d626f4.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-14472cfa51243103.js",
  "/_next/static/chunks/app/[locale]/layout-976d9b78c95a14ef.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-bbed7da909222ee2.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-0d63bb6b34968fe9.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-a8cf55228609e317.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-995747416f66a25a.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-56c786f3c3de93bf.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-2f1466ffea4ebf6d.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-4afef92fe711cbc9.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-f297774c160a04a4.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-61c45f81e12de5da.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-ed5e91ff07f89e4e.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-4f642c5e53a86f12.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-53e4b29d2193d167.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-e7058207c167d400.js",
  "/_next/static/chunks/app/[locale]/library/page-7341a71ab571cfe4.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-04f3529bd08ef674.js",
  "/_next/static/chunks/app/[locale]/lists/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/lists/page-4f5e8992e0e4699b.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-3d803ba1062bcc41.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-2b0d558f08e60e14.js",
  "/_next/static/chunks/app/[locale]/news/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/news/page-c8443f2879fed74a.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-90af254991881db6.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-c469d362479eed05.js",
  "/_next/static/chunks/app/[locale]/not-found-02c26a9c28e0c794.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-412ab46f3623252d.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-cb2b25f641aa1914.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-9cef68208e3a88cb.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-56c786f3c3de93bf.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-b7867bc9dc09d301.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-4447006b256fb6ad.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-894ab849768899ee.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-ce1f36433f089db9.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/pricing/page-248a3013939be0c9.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/privacy/page-83eabcf3057bd0c1.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-de01e2c7dad1de34.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-e0bbb4cc87154762.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-e9512b6ff2e580d1.js",
  "/_next/static/chunks/app/[locale]/resources/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/resources/page-f6daeafbe18da858.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-ffe78448804344f6.js",
  "/_next/static/chunks/app/[locale]/review/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/review/page-56c786f3c3de93bf.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/review/session/page-64ceb82be685104b.js",
  "/_next/static/chunks/app/[locale]/server-error/page-e49d096d97ec791b.js",
  "/_next/static/chunks/app/[locale]/settings/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/settings/page-5359539388e50f9e.js",
  "/_next/static/chunks/app/[locale]/share/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/share/page-1bf4949355452205.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/showcase/page-3a4c675e8c65ae9a.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/statistics/page-e478b2a15dbcc0e0.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-7f4bab19323b93c2.js",
  "/_next/static/chunks/app/[locale]/stories/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/stories/page-5c53955e887a7c32.js",
  "/_next/static/chunks/app/[locale]/terms/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/terms/page-a70ae4ca0a789c61.js",
  "/_next/static/chunks/app/[locale]/test-email/page-ede50d39463ec693.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-b363802252a480b1.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-e7bf4ca1fdd4eded.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-02f73c1d8c80c0dc.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-3c248d76c96a897b.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-4fa7d47fa1535be2.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-3484126c6b6d9856.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-28bcbcf0f1d0ca0d.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-99142db02522dfb0.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-d49a730f04f015e5.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-35685d560959fd42.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-aea4575a00b809f9.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-ddfbc058f1fd2882.js",
  "/_next/static/chunks/app/[locale]/todos/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/todos/page-1adce6240a11fbf3.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-bc39704ddde1703f.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-ce9a1c6c92c50828.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-83600854189ce813.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-6967cebfa01b1f9e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-f01fee58049e5443.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-0cec53490e45d8fa.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-d969dc1ead1f6780.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-608ef9c825e58f79.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-4acb5249b1ac99e9.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-54837350bf4a4018.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-0079621c6bcd7256.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-affc02e55525d0e6.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-a873f3d6ee74cce2.js",
  "/_next/static/chunks/app/_not-found/page-56c786f3c3de93bf.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-73672720ef2b7d6d.js",
  "/_next/static/chunks/app/error-8bd1866cc14e710a.js",
  "/_next/static/chunks/app/global-error-9751cfca641ee1a9.js",
  "/_next/static/chunks/app/layout-897735cef16f23b1.js",
  "/_next/static/chunks/app/not-found-1050bd159ac79102.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-app-c35d34a55864b0b5.js",
  "/_next/static/chunks/main-cd55c576c37ced5a.js",
  "/_next/static/chunks/pages/_app-f365312a4d2529fb.js",
  "/_next/static/chunks/pages/_error-ff431fa75c297bd3.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-092c5825f8136d2b.js",
  "/_next/static/css/4d80e84d5bcc894e.css",
  "/_next/static/css/58ca86956afb7910.css",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/af47b6060c4fddcc.css"
].concat(MANUAL_PRECACHE_URLS);

// Install event - cache essential files only
self.addEventListener('install', (event) => {
  log('[SW] Installing...');
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);

    // Helper function with timeout for dev mode compatibility
    const cacheWithTimeout = async (url, timeout = 3000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        log('[SW] Could not cache:', url);
      }
    };

    // Try to cache each URL individually with timeout
    await Promise.all(PRECACHE_URLS.map(url => cacheWithTimeout(url)));

    log('[SW] Installation complete');
    // Note: We do NOT call self.skipWaiting() here automatically.
    // The app controls when to activate via SKIP_WAITING message.
    // This allows the update banner to be shown first.
  })());
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  log('[SW] Activating...');
  event.waitUntil((async () => {
    // Get all cache names
    const cacheNames = await caches.keys();

    // Current valid caches
    const validCaches = [STATIC_CACHE, AUDIO_CACHE, PAGES_CACHE, IMAGE_CACHE];

    // Delete all caches that don't match current version
    await Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName.startsWith('moshimoshi-') && !validCaches.includes(cacheName)) {
          log('[SW] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
      })
    );

    // Take control of all clients
    await self.clients.claim();
    log('[SW] Activated and controlling all clients');
  })());
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  log('[SW] Fetch:', request.method, url.pathname, {
    mode: request.mode,
    accept: request.headers.get('accept'),
    search: url.search
  });

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const isImageRequest = request.destination === 'image' ||
    url.pathname === '/_next/image' ||
    url.pathname.match(/\.(png|jpe?g|gif|webp|svg|avif)$/i);

  // Skip cross-origin requests except for allowed CDNs
  if (url.origin !== self.location.origin) {
    // Allow specific CDNs if needed (e.g., fonts, analytics)
    const allowedOrigins = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];

    if (!isImageRequest && !allowedOrigins.some(origin => url.origin === origin)) {
      return;
    }
  }

  // Check if this is a navigation request
  const isNavigationRequest = request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

  log('[SW] Navigation check:', {
    path: url.pathname,
    isNavigationRequest,
    isOfflineEnabledPage: isOfflineEnabledPath(url.pathname)
  });

  if (isNavigationRequest) {
    // IMPORTANT: In development or when online, don't aggressively serve offline pages
    // Check if we're truly offline before serving fallback
    const isOnline = self.navigator.onLine;

    // Detect development SW by script path (avoid disabling caching on localhost prod builds)
    const isDevelopment = self.location.pathname.includes('service-worker.dev.js');

    // In development when online, let Next.js handle everything - don't intercept
    if (isDevelopment && isOnline) {
      log('[SW] Development mode + online - bypassing service worker for:', url.pathname);
      return; // Let the request go through naturally without SW intervention
    }

    // Check if this page should be cached for offline use
    const isOfflineEnabledPage = isOfflineEnabledPath(url.pathname);

    event.respondWith(
      (async () => {
        // Use longer timeout in development, shorter in production
        const timeout = isDevelopment ? 30000 : 5000; // 30s dev, 5s prod

        // For offline-enabled pages, try cache first when offline
        if (isOfflineEnabledPage) {
          const pagesCache = await caches.open(PAGES_CACHE);
          const cacheKeyUrl = url.origin + url.pathname;

          try {
            // Try network with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(request, { signal: controller.signal });
            clearTimeout(timeoutId);

            // Cache successful responses for offline use
            if (response.ok) {
              log('[SW] Caching page for offline:', url.pathname);
              pagesCache.put(cacheKeyUrl, response.clone());
              log('[SW] Cached HTML key:', cacheKeyUrl);
            }

            return response;
          } catch (error) {
            // Network failed - try to serve from cache
            log('[SW] Network failed, checking cache for:', url.pathname);
            let cachedPage = await pagesCache.match(cacheKeyUrl);

            if (cachedPage) {
              log('[SW] Serving cached page:', url.pathname);
              return cachedPage;
            }

            // Fallback: try matching any cached variant ignoring query parameters
            cachedPage = await pagesCache.match(request, { ignoreSearch: true });
            if (cachedPage) {
              log('[SW] Serving cached page (ignore search):', url.pathname);
              return cachedPage;
            }

            const keys = await pagesCache.keys();
            log('[SW] Cache miss for HTML:', cacheKeyUrl);
            log('[SW] Pages cache keys:', keys.map(key => key.url));


            // Page not cached, fall through to offline page
            log('[SW] Page not cached, serving offline page');
          }
        } else {
          // Non-offline-enabled pages - just try network with timeout
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(request, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
          } catch (error) {
            log('[SW] Navigation failed for:', url.pathname);
          }
        }

        // In development, let the browser show its own error page to avoid false offline screens.
        if (isDevelopment) {
          log('[SW] Development mode navigation failed - letting browser handle error');
          throw new Error('Navigation failed in development mode');
        }

        // Fallback to offline page (only when truly offline)
        const staticCache = await caches.open(STATIC_CACHE);
        const offlinePage = await staticCache.match('/offline.html');

        if (offlinePage) {
          return offlinePage;
        }

        // Last resort fallback
        return new Response(
          '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>',
          {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      })()
    );
    return;
  }

  // Check if this is a Next.js RSC (React Server Components) request for offline-enabled pages
  // These are needed for client-side navigation to work offline
  const isRSCRequest = url.searchParams.has('_rsc') || url.pathname.includes('/_next/data/');
  const rscPath = extractRscPath(url.searchParams.get('_rsc'));
  const rscCandidate = rscPath || url.pathname;
  const isOfflinePageRSC = isRSCRequest && isOfflineEnabledPath(rscCandidate);

  if (isRSCRequest) {
    event.respondWith(
      (async () => {
        const pagesCache = await caches.open(PAGES_CACHE);

        try {
          // If offline, try cache first for RSC payloads
          if (!self.navigator.onLine) {
            const cachedRSC = await pagesCache.match(request, { ignoreSearch: true });
            if (cachedRSC) {
              log('[SW] Serving cached RSC (offline):', url.pathname);
              return cachedRSC;
            }
          }

          const response = await fetch(request);
          // Cache RSC responses for offline-enabled pages
          if (response.ok && isOfflinePageRSC) {
            log('[SW] Caching RSC payload:', url.pathname);
            pagesCache.put(request, response.clone());
            cacheHtmlForPath(rscCandidate).catch((error) => {
              warn('[SW] Failed to cache HTML for RSC:', error);
            });
          }
          return response;
        } catch (error) {
          // Try cache for RSC requests
          const cachedRSC = await pagesCache.match(request, { ignoreSearch: true });
          if (cachedRSC) {
            log('[SW] Serving cached RSC:', url.pathname);
            return cachedRSC;
          }
          return new Response(null, { status: 204 });
        }
      })()
    );
    return;
  }

  async function cacheHtmlForPath(pathname) {
    if (!pathname || pathname === '/') return;
    const htmlUrl = new URL(pathname, self.location.origin);
    const cacheKeyUrl = htmlUrl.origin + htmlUrl.pathname;
    const pagesCache = await caches.open(PAGES_CACHE);
    const existing = await pagesCache.match(cacheKeyUrl);
    if (existing) return;

    log('[SW] Fetching HTML for cache:', cacheKeyUrl);
    const response = await fetch(htmlUrl.toString(), {
      headers: { Accept: 'text/html' },
      cache: 'no-store'
    });
    if (response.ok) {
      await pagesCache.put(cacheKeyUrl, response.clone());
      log('[SW] Cached HTML from RSC:', cacheKeyUrl);
    } else {
      log('[SW] HTML fetch failed for cache:', response.status, cacheKeyUrl);
    }
  }

  // Static assets - check if it's a hashed asset or precached resource
  const isStaticAsset =
    url.pathname.includes('/_next/static/') ||
    url.pathname.match(/\.[a-f0-9]{8,}\.(js|css)$/) ||
    url.pathname.match(/\.(woff|woff2|ttf|eot)$/) ||
    // Learning Village stall images (precached for offline)
    url.pathname.startsWith('/ui/flat-icons/stalls/') ||
    // Kanji data files (precached for offline)
    url.pathname.startsWith('/data/kanji/');

  if (isStaticAsset) {
    // Serve from cache first, fallback to network
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((fetchResponse) => {
          // Only cache successful responses
          if (fetchResponse.ok) {
            return caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, fetchResponse.clone());
              return fetchResponse;
            });
          }
          return fetchResponse;
        });
      })
    );
    return;
  }

  if (isImageRequest) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          log('[SW] Image cache hit:', url.pathname);
          return cachedResponse;
        }

        try {
          const response = await fetch(request);
          if (response.ok || response.type === 'opaque') {
            await cache.put(request, response.clone());
            cleanupImageCache(cache).catch(err =>
              warn('[SW] Image cache cleanup error:', err)
            );
            log('[SW] Image cached:', url.pathname);
          }
          return response;
        } catch (error) {
          const fallback = await cache.match(request, { ignoreSearch: true });
          if (fallback) {
            log('[SW] Image cache fallback:', url.pathname);
            return fallback;
          }
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // Audio assets - cache-first strategy for kana and other audio
  const isAudioAsset = url.pathname.startsWith('/audio/') &&
    url.pathname.match(/\.(mp3|wav|ogg|m4a)$/i);

  if (isAudioAsset) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        // Try cache first (use URL as key, not the request with Range headers)
        const cacheKey = new Request(request.url);
        const cachedResponse = await cache.match(cacheKey);

        if (cachedResponse) {
          if (isResponseExpired(cachedResponse, AUDIO_CACHE_CONFIG.maxAge)) {
            log('[SW] Audio cache expired, deleting:', url.pathname);
            await cache.delete(cacheKey);
          } else {
            log('[SW] Audio cache hit:', url.pathname);
            return cachedResponse;
          }
        }

        // Not in cache - fetch from network
        log('[SW] Audio cache miss, fetching:', url.pathname);

        try {
          // Fetch WITHOUT Range headers to get full response (200, not 206)
          // This ensures we can cache the complete file
          const fetchRequest = new Request(request.url, {
            method: 'GET',
            headers: {}, // No Range header
            mode: 'cors',
            credentials: 'same-origin'
          });

          const networkResponse = await fetch(fetchRequest);

          // Only cache successful full responses (200 OK)
          // Don't cache 206 Partial Content
          if (networkResponse.ok && networkResponse.status === 200) {
            // Clone response before caching (response can only be consumed once)
            const responseToCache = networkResponse.clone();
            const stampedResponse = await stampResponse(responseToCache);

            // Cache the audio file with timestamp header
            await cache.put(cacheKey, stampedResponse);
            log('[SW] Audio cached:', url.pathname);

            // Async cleanup - don't block the response
            cleanupAudioCache(cache).catch(err =>
              warn('[SW] Audio cache cleanup error:', err)
            );
          } else {
            log('[SW] Skipping cache for status:', networkResponse.status);
          }

          return networkResponse;
        } catch (error) {
          console.error('[SW] Audio fetch failed:', url.pathname, error);
          // Return a proper error response for audio
          return new Response(null, {
            status: 503,
            statusText: 'Audio unavailable offline'
          });
        }
      })
    );
    return;
  }

  // All other requests - network only (no caching)
  // This includes API calls, data fetches, etc.
  return;
});

/**
 * Clean up audio cache - remove oldest entries if over limit
 */
async function cleanupAudioCache(cache) {
  const keys = await cache.keys();

  // Remove expired entries first
  for (const request of keys) {
    const response = await cache.match(request);
    if (!response) continue;
    if (isResponseExpired(response, AUDIO_CACHE_CONFIG.maxAge)) {
      await cache.delete(request);
    }
  }

  const remainingKeys = await cache.keys();
  if (remainingKeys.length > AUDIO_CACHE_CONFIG.maxEntries) {
    const entries = [];
    for (const request of remainingKeys) {
      const response = await cache.match(request);
      if (!response) continue;
      const timestamp = getCacheTimestamp(response) || 0;
      entries.push({ request, timestamp });
    }

    entries.sort((a, b) => a.timestamp - b.timestamp);
    const entriesToRemove = entries.length - AUDIO_CACHE_CONFIG.maxEntries;
    log(`[SW] Audio cache cleanup: removing ${entriesToRemove} old entries`);

    for (let i = 0; i < entriesToRemove; i++) {
      await cache.delete(entries[i].request);
    }
  }

async function cleanupImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CACHE_CONFIG.maxEntries) return;

  const entriesToRemove = keys.length - IMAGE_CACHE_CONFIG.maxEntries;
  log(`[SW] Image cache cleanup: removing ${entriesToRemove} old entries`);

  for (let i = 0; i < entriesToRemove; i++) {
    await cache.delete(keys[i]);
  }
}

function getCacheTimestamp(response) {
  const header = response.headers.get('sw-cache-time');
  if (!header) return null;
  const ts = Number(header);
  return Number.isFinite(ts) ? ts : null;
}

function isResponseExpired(response, maxAgeMs) {
  const ts = getCacheTimestamp(response);
  if (!ts) return true;
  return Date.now() - ts > maxAgeMs;
}

async function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-time', Date.now().toString());
  const body = await response.arrayBuffer();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Message event for skip waiting and cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Get audio cache statistics
  if (event.data && event.data.type === 'GET_AUDIO_CACHE_STATS') {
    getAudioCacheStats().then(stats => {
      event.ports[0].postMessage({ type: 'AUDIO_CACHE_STATS', data: stats });
    });
  }

  // Clear audio cache (for testing/debugging)
  if (event.data && event.data.type === 'CLEAR_AUDIO_CACHE') {
    caches.delete(AUDIO_CACHE).then(() => {
      log('[SW] Audio cache cleared');
      event.ports[0].postMessage({ type: 'AUDIO_CACHE_CLEARED' });
    });
  }
});

/**
 * Get audio cache statistics
 */
async function getAudioCacheStats() {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const keys = await cache.keys();

    let totalSize = 0;
    const entries = [];

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
        entries.push({
          url: request.url,
          size: blob.size,
          type: response.headers.get('content-type')
        });
      }
    }

    return {
      entryCount: keys.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      maxEntries: AUDIO_CACHE_CONFIG.maxEntries,
      cacheVersion: CACHE_VERSION,
      entries: entries.slice(0, 10) // First 10 for debugging
    };
  } catch (error) {
    console.error('[SW] Error getting audio cache stats:', error);
    return { error: error.message };
  }
}
