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

const CACHE_VERSION = 'moshimoshi-725c53cd7560';
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
  "/_next/static/RLqfEUYcDGHCxJVg_iG-D/_buildManifest.js",
  "/_next/static/RLqfEUYcDGHCxJVg_iG-D/_ssgManifest.js",
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/10627-bcf644fe12302657.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/11599-e986443a5e668d37.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/13523-fd15821c144a9307.js",
  "/_next/static/chunks/14395-53bee37eae81e3d3.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14586-8caa4588c53c7467.js",
  "/_next/static/chunks/14673-e7741737d0d4eb68.js",
  "/_next/static/chunks/14777-519d0e9b10e6b729.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/15361-9056bd6d4f47f1e4.js",
  "/_next/static/chunks/16233-ab46074045868d1c.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/16588-bd7d99ac608772dc.js",
  "/_next/static/chunks/17401-141e014b66b5574e.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/20461-cbea971ba25d4726.js",
  "/_next/static/chunks/20840-d72d5c335f7c40bc.js",
  "/_next/static/chunks/21544-a8f0b60cb83afb43.js",
  "/_next/static/chunks/21960-09ff5572ac58ce6c.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-f7480e9567d150b8.js",
  "/_next/static/chunks/23868-20854aed872efc80.js",
  "/_next/static/chunks/23930-b7fde159df4d447e.js",
  "/_next/static/chunks/24008-4baf16df62a9e143.js",
  "/_next/static/chunks/24146-3c5faee6bd4acfd2.js",
  "/_next/static/chunks/24366-79a6a6e781a39914.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25410-7df4cc370d951ab3.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/27183-39d671770276cc31.js",
  "/_next/static/chunks/27890-0e69a191b8463e87.js",
  "/_next/static/chunks/2964-788711f49d21cc2e.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31949-9615b9afbdf8eca2.js",
  "/_next/static/chunks/32790-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/34244-3385b88ff34de9fd.js",
  "/_next/static/chunks/35925-9ef41eca727c630e.js",
  "/_next/static/chunks/37005-8b4610f027540d23.js",
  "/_next/static/chunks/3708-d0ffdf04b8ed76d9.js",
  "/_next/static/chunks/37255-5cc8273e9e6991e5.js",
  "/_next/static/chunks/38151-8a3c81d7203b57fc.js",
  "/_next/static/chunks/38368-4d5726332fddab46.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/39035-455c41cf78dcd6ad.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/40619-b66e7853369f8923.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/45119-5ef32194b4e87e5a.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-04d89b9120557c53.js",
  "/_next/static/chunks/46693-9fdcdf28acd12b95.js",
  "/_next/static/chunks/46788-c851274c9dd68642.js",
  "/_next/static/chunks/49483-247923524eb943b9.js",
  "/_next/static/chunks/49882-9a836a5347a47a9a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50443-56e61b140c52d8dc.js",
  "/_next/static/chunks/52311-a6efad46a350d8c3.js",
  "/_next/static/chunks/52413-1421dc014ea61920.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53005-537433508e12a878.js",
  "/_next/static/chunks/53697-d72d5c335f7c40bc.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-0148078f5edea993.js",
  "/_next/static/chunks/54469-80a2f9dda48676d7.js",
  "/_next/static/chunks/54a60aa6-fde3c27555179f9b.js",
  "/_next/static/chunks/55191-538723d65b120d53.js",
  "/_next/static/chunks/56526-989ecef785d8bdd4.js",
  "/_next/static/chunks/56649-1a3367046f8a8e56.js",
  "/_next/static/chunks/56931-afb02a4f46e01dfa.js",
  "/_next/static/chunks/57130-9e55277cf6166f27.js",
  "/_next/static/chunks/57292-0fc48d43026e13a1.js",
  "/_next/static/chunks/57578-5fe71dae6f68751b.js",
  "/_next/static/chunks/57604-7726abae737bf68b.js",
  "/_next/static/chunks/58126-2fbfb092029e48ea.js",
  "/_next/static/chunks/5832-bc62b6d325bab7c4.js",
  "/_next/static/chunks/58344-d9122078ae515803.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-8b4610f027540d23.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-94575a6e0e50b932.js",
  "/_next/static/chunks/61203-f60ca45a5bb7d280.js",
  "/_next/static/chunks/61324-ee1311648d71fe5a.js",
  "/_next/static/chunks/62241-f814904c80ee3cd0.js",
  "/_next/static/chunks/62310-8d3114cfda636653.js",
  "/_next/static/chunks/63134-17444764ecd4cb92.js",
  "/_next/static/chunks/63140-a7e3d0da43b48780.js",
  "/_next/static/chunks/64103-91f6ddb23beb6bd1.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64719-62bd0d059b64fd32.js",
  "/_next/static/chunks/64961-a9ca6345a7df069d.js",
  "/_next/static/chunks/66094-e6bc026349ce30c0.js",
  "/_next/static/chunks/68645-402da98c231e6d5c.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-02c6daf96b42272a.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71186-e2e494145961085c.js",
  "/_next/static/chunks/72253-79d837e251438dae.js",
  "/_next/static/chunks/74233-1cb653924ca43da7.js",
  "/_next/static/chunks/7439-2cfbd68761add394.js",
  "/_next/static/chunks/74467-3f2947e39dc176c7.js",
  "/_next/static/chunks/74586-d6615e945aa18ea6.js",
  "/_next/static/chunks/74791-4de56691533359c1.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-7a7a1f5ac65836d0.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76078-d72d5c335f7c40bc.js",
  "/_next/static/chunks/77572-538723d65b120d53.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/79297-1889737bfab1aa21.js",
  "/_next/static/chunks/80137-cb8eaa1347d52e1d.js",
  "/_next/static/chunks/80314-ce791ca26fc6f229.js",
  "/_next/static/chunks/805-b790e7924fb3beaa.js",
  "/_next/static/chunks/80750-f08f83d1d624b424.js",
  "/_next/static/chunks/8079-4954e6da50e31312.js",
  "/_next/static/chunks/80853-52100e0742a6eed9.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/82182-987957df4aeb3cde.js",
  "/_next/static/chunks/83057-f1744d8c1bb4d748.js",
  "/_next/static/chunks/8382-f7480e9567d150b8.js",
  "/_next/static/chunks/84584-362b7b6c9580d167.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/86480-a5102f8184041143.js",
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
  "/_next/static/chunks/90909-5417a68ce2e859cc.js",
  "/_next/static/chunks/91445-b1767331c9c271e9.js",
  "/_next/static/chunks/92758-d10552e41edd32e9.js",
  "/_next/static/chunks/94997-6586e7bf409d833b.js",
  "/_next/static/chunks/97627-b15d88a15f0d2da3.js",
  "/_next/static/chunks/98459-d72d5c335f7c40bc.js",
  "/_next/static/chunks/98698-fe89575a2f06e830.js",
  "/_next/static/chunks/99341-5bb921ca23fd36e3.js",
  "/_next/static/chunks/99579-09ff5572ac58ce6c.js",
  "/_next/static/chunks/99707-7b43a77a6167bf66.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/(home)/page-e48a4637949d3fdc.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-a0c2aa8ae8e321ba.js",
  "/_next/static/chunks/app/[locale]/account/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/account/page-08f2cad50b3f0924.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/achievements/page-cc81ad33355cd339.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-1c0f1f379d70b2b8.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-980fc84f7c3bce62.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-a10174edcbe20afa.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-bd99b430b7ab6e28.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-2bc245777358ad3f.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-743e24050e03c8c6.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-74807c09aa6e9e0e.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-a92c2a3ddd01957c.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-969c7d5229af2c92.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-2ded722def5d3f78.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-72d6e4ddfd52c243.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-e1d58e5cadf160a1.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-e07817d94c62ddf7.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-9dab5baac60406fb.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-595d48b678f71cd5.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-fb8211ba216b900e.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-93136f9b902d0ee7.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-65f59f8b4b75c5d7.js",
  "/_next/static/chunks/app/[locale]/admin/layout-321e0e70e76bbed5.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-9a8288a055520236.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-14e329ab364ed2d2.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-f3a621cb3dd19915.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-8db6998b2f865032.js",
  "/_next/static/chunks/app/[locale]/admin/page-d3590dc9b6bbe4b8.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-c9331b957b4ca68e.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-65ed4dd2d50cdc33.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-c6a7108ba8e22824.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-72b670220cfcfc7f.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-427e8a39db56a3df.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-83f1fc277ad8de6e.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-478e4684539c348f.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-7c01cff76ddd9b69.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-b19ba2b1919f430f.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-bbafdb8e8767f6c4.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-cfc587b9a5ec4a21.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-ce0d86e36378f02a.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-7606b673ee9ae932.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-8410b10e20e548db.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-dc4f82d74eba4a9d.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-7f88320fe3a693fd.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-b0fbaa64f7c2870c.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-4e2b7fd4104ec5e0.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-7d13a85817bc1e1e.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-1f2d2dbef26f085a.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-513b1e89d90d2f17.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-d5f8ac0e25c5a181.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-4ca4b697347c0948.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-c16c7065a34b6723.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-e420ac587f4f4a09.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-a55a8bcf22bf07e2.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-f8847057ec73a83e.js",
  "/_next/static/chunks/app/[locale]/blog/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/blog/page-11419f1d141a7075.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-0fb9d6b70c1e4148.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-170964e2ecc28d74.js",
  "/_next/static/chunks/app/[locale]/comics/page-ee1356984ee69e2d.js",
  "/_next/static/chunks/app/[locale]/contact/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/contact/page-1196e8700cdbc7bb.js",
  "/_next/static/chunks/app/[locale]/credits/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/credits/page-1fc80abcff72b7a6.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-208cbc8cf4cb7ac7.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-aeacfdf67fbdd523.js",
  "/_next/static/chunks/app/[locale]/drill/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/drill/page-fa557043a0909097.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-d3b5a35db797c252.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-d6cd71ae82b5a4a0.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-fff17206463a6257.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-afd71e78f331d774.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-3be19e25458bdc88.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-1a46270e3f528385.js",
  "/_next/static/chunks/app/[locale]/games/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/games/page-1fb33ea728b700e4.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-611d280c07f12df6.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-d4eece0cdc5b4b22.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-356d4727818172c3.js",
  "/_next/static/chunks/app/[locale]/intro/page-64fba16c62dfa71c.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-26aeda83d8f71c26.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-b0c8d15382b93ab9.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-f24fc08b45263c22.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-221df871421a19c7.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-12e502b3de561e82.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-c99a0ebb137824e1.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-c03f39a65d23ae07.js",
  "/_next/static/chunks/app/[locale]/layout-dfcffd879d4a7b13.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-540795a5e3759a98.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-9370962ab31b6408.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-320f675a5a4662a8.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-22fbd0fc6a48562f.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-9c0d1c10cfb2adbe.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-602e085033993adc.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-f155963eed38415f.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-0c18b4fff593e7d8.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-087b783311284ccb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-b46b37d8ff06357d.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-9d857eee36c87b6b.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-5a58b29bf6c50b4e.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-ffdd26b8bfee8193.js",
  "/_next/static/chunks/app/[locale]/library/page-b334e94fcd94d4a8.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-c91336d55c159468.js",
  "/_next/static/chunks/app/[locale]/lists/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/lists/page-2cf69da0b26201b3.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-2734e3b075929374.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-a2a78151cad58fc9.js",
  "/_next/static/chunks/app/[locale]/news/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/news/page-7eac7413eaef700b.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-5ded9f25543b0680.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-a200f10e8330f289.js",
  "/_next/static/chunks/app/[locale]/not-found-eec993b8731aab90.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-d91e828a01ec3e0c.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-287154d9b0e2782e.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-db5641cf5044d4cd.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-9c0d1c10cfb2adbe.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-49ebae0cbdaa9a3d.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-1f6483655429fe43.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-62c7b64d01cea60d.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-e126b6519f46aebb.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/pricing/page-2a16cb4fe4de69b8.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/privacy/page-e2b7d15bc74f99c5.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-7a28663a800f23a9.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-dc6f53eeffb31b68.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-d7203710d26189bf.js",
  "/_next/static/chunks/app/[locale]/resources/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/resources/page-aff26b3e8c22490f.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-9fc1a0bf49ca4a00.js",
  "/_next/static/chunks/app/[locale]/review/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/review/page-9c0d1c10cfb2adbe.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/review/session/page-926b315e0570bf98.js",
  "/_next/static/chunks/app/[locale]/server-error/page-0724ff66ee8396f6.js",
  "/_next/static/chunks/app/[locale]/settings/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/settings/page-57234c75a64e75f7.js",
  "/_next/static/chunks/app/[locale]/share/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/share/page-b6de277dd7f5d43a.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/showcase/page-73026d44daf6dcfa.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/statistics/page-c6f09ed71edc3e43.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-a0be1d38b3e8d1ec.js",
  "/_next/static/chunks/app/[locale]/stories/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/stories/page-3a286477a27d2031.js",
  "/_next/static/chunks/app/[locale]/terms/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/terms/page-38a3f60419051dd8.js",
  "/_next/static/chunks/app/[locale]/test-email/page-22d28f9393a37067.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-d87bace002e97296.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-16c444dbf03b3785.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-f78117ae9ed2a83d.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-e37fc4296f43758b.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-fd8f1fe0d9a75743.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-f1415a29af6ac25b.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-0a1bcbe04203fd13.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-5476b7f5f09e18fb.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-7d98fd2c1060089d.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-d8b5ce30df381d77.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-e03f26a329cc2031.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-865d392d2677dd13.js",
  "/_next/static/chunks/app/[locale]/todos/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/todos/page-ec71fca18726cd97.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-a56d58c15fc4c9f9.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-c6d6c0208696dd79.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-ffc4f5ab0564f5e5.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-27265c81b947a50d.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-7a6cbd9a63ec13ff.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-a635297f937c94d4.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-69f20f2592b13b8e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-58d4d25b81cd3021.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-34c814465c40f516.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-738e97314ad6c5fe.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-30062197fd163bff.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-72452d8901058e01.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-d810b9600f15fbee.js",
  "/_next/static/chunks/app/_not-found/page-9c0d1c10cfb2adbe.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-46c8e0e0b090ec8f.js",
  "/_next/static/chunks/app/error-95dc052268e8e853.js",
  "/_next/static/chunks/app/global-error-675f329881d006a3.js",
  "/_next/static/chunks/app/layout-dec655e10387de11.js",
  "/_next/static/chunks/app/not-found-7e34f0bad2ce5bdd.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-app-f6252dbd1fe808b2.js",
  "/_next/static/chunks/main-cd55c576c37ced5a.js",
  "/_next/static/chunks/pages/_app-f365312a4d2529fb.js",
  "/_next/static/chunks/pages/_error-ff431fa75c297bd3.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-5ad36aec60ae78ec.js",
  "/_next/static/css/53c7f855035b555c.css",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/a6ae4ab4bec43017.css",
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
