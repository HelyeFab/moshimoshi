/**
 * Moshimoshi PWA Service Worker - Production Ready
 * Version: 4.0.0
 *
 * STRICT CACHE DISCIPLINE:
 * - Only precaches hashed static assets
 * - No runtime caching of API/dynamic data
 * - Minimal, auditable, and safe
 */

// Debug mode - set to true to enable verbose logging
// In production, this should be false to reduce console noise
const DEBUG = true;

// Logging wrappers - only log when DEBUG is enabled
const log = DEBUG ? console.log.bind(console) : () => {};
const warn = DEBUG ? console.warn.bind(console) : () => {};
// Always keep console.error for critical issues

const CACHE_VERSION = 'moshimoshi-2ad56869fed0';
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
  "/_next/static/EhpNlQC4Eb3oGQDcqFNU0/_buildManifest.js",
  "/_next/static/EhpNlQC4Eb3oGQDcqFNU0/_ssgManifest.js",
  "/_next/static/chunks/10152-ce5cb8b0f37c62a2.js",
  "/_next/static/chunks/10409-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/11073-c49d53d097d00f25.js",
  "/_next/static/chunks/11599-e986443a5e668d37.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/12553-ac7b7a27e23bd50b.js",
  "/_next/static/chunks/12755-608e01a075b16dac.js",
  "/_next/static/chunks/12899-d86baf79ef36c2af.js",
  "/_next/static/chunks/13523-fd15821c144a9307.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14777-519d0e9b10e6b729.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/15361-9056bd6d4f47f1e4.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/1673-8f625db55ae992b4.js",
  "/_next/static/chunks/19075-fdcb55410bfcfd6d.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/20461-cbea971ba25d4726.js",
  "/_next/static/chunks/20554-c6b7d5a59f66ff79.js",
  "/_next/static/chunks/20746-acae7224aaf6b433.js",
  "/_next/static/chunks/20840-d72d5c335f7c40bc.js",
  "/_next/static/chunks/21544-a8f0b60cb83afb43.js",
  "/_next/static/chunks/22470-092c41530991f39d.js",
  "/_next/static/chunks/22489-86dd1d27913abe8d.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-f7480e9567d150b8.js",
  "/_next/static/chunks/23810-9f052ddb72dab7c4.js",
  "/_next/static/chunks/23868-265ec8dce87653b4.js",
  "/_next/static/chunks/23930-b7fde159df4d447e.js",
  "/_next/static/chunks/24069-f22fe1f3962ded76.js",
  "/_next/static/chunks/24146-3c5faee6bd4acfd2.js",
  "/_next/static/chunks/24366-79a6a6e781a39914.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25153-191f031af1d5ff9a.js",
  "/_next/static/chunks/25410-7df4cc370d951ab3.js",
  "/_next/static/chunks/26823-dc133f301c3ded03.js",
  "/_next/static/chunks/27183-3d6fec5d22557a17.js",
  "/_next/static/chunks/27890-fcda31b11c2ad0d5.js",
  "/_next/static/chunks/28278-9bcc0397dc13c059.js",
  "/_next/static/chunks/28833-11f0cf77e6078f57.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31949-24e6805fad57aa9a.js",
  "/_next/static/chunks/32790-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/35925-9ef41eca727c630e.js",
  "/_next/static/chunks/36421-127d3afff415770b.js",
  "/_next/static/chunks/36665-6eac61abcf7eda5e.js",
  "/_next/static/chunks/37005-8b4610f027540d23.js",
  "/_next/static/chunks/3783-6fab11f794e20472.js",
  "/_next/static/chunks/38017-30da49adfb4d8ed9.js",
  "/_next/static/chunks/38151-c5ba4ea22a434063.js",
  "/_next/static/chunks/38179-7dc34f5c4af751d3.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/42755-203fe329c26e4347.js",
  "/_next/static/chunks/43903-0daa92d56d76e6df.js",
  "/_next/static/chunks/45002-49b4693aebb6df5c.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-609151be89639177.js",
  "/_next/static/chunks/46693-9fdcdf28acd12b95.js",
  "/_next/static/chunks/46875-2128efea6bb8f84d.js",
  "/_next/static/chunks/47179-51605145bed6e3a7.js",
  "/_next/static/chunks/49483-137379b19fb5a713.js",
  "/_next/static/chunks/49882-ab61ac71fd927191.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50106-7c25a17114f8e379.js",
  "/_next/static/chunks/50443-56e61b140c52d8dc.js",
  "/_next/static/chunks/51189-bc9fc88af4f87e6f.js",
  "/_next/static/chunks/52084-f8d19be1067b7f28.js",
  "/_next/static/chunks/52413-d12e4fca3dd8667a.js",
  "/_next/static/chunks/52445-d37beccb2afe4450.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53697-d72d5c335f7c40bc.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-c580af8f6b3ee7ab.js",
  "/_next/static/chunks/5441-4d40129e2fc41099.js",
  "/_next/static/chunks/54469-80a2f9dda48676d7.js",
  "/_next/static/chunks/54a60aa6-fde3c27555179f9b.js",
  "/_next/static/chunks/56526-5a9a6359a22efcbc.js",
  "/_next/static/chunks/56767-93d4918a0bf8098e.js",
  "/_next/static/chunks/56852-5080c6014863cc1d.js",
  "/_next/static/chunks/57292-d8131e72761ce81a.js",
  "/_next/static/chunks/57961-ae82ea1600874d80.js",
  "/_next/static/chunks/58126-2fbfb092029e48ea.js",
  "/_next/static/chunks/59386-8b4610f027540d23.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-2b99c0ca635cfe24.js",
  "/_next/static/chunks/60134-3ec78c02dbde7455.js",
  "/_next/static/chunks/60805-2da800521f18b3fc.js",
  "/_next/static/chunks/61324-ee1311648d71fe5a.js",
  "/_next/static/chunks/61807-28fbf5185c0bf4d2.js",
  "/_next/static/chunks/62748-f0cf92795cdf76af.js",
  "/_next/static/chunks/63134-44ecec9289c77871.js",
  "/_next/static/chunks/6350-c29a9620a1d06367.js",
  "/_next/static/chunks/63790-5d51db9e7c6b5dc7.js",
  "/_next/static/chunks/65954-c5f7e6045a188f77.js",
  "/_next/static/chunks/67686-c2b8125c38a9620c.js",
  "/_next/static/chunks/67927-070f65a8f3def2c8.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/68781-8c5cf50d0c961b93.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69086-b6357b94f49cc053.js",
  "/_next/static/chunks/69229-c088aa2edbb77496.js",
  "/_next/static/chunks/69256-2128efea6bb8f84d.js",
  "/_next/static/chunks/69294-6f7007d12876c6b3.js",
  "/_next/static/chunks/70217-c59df39ce94b08af.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71660-95a72e0c9fb3e009.js",
  "/_next/static/chunks/71683-6e9af323532551d2.js",
  "/_next/static/chunks/72253-682ae60907f87ebe.js",
  "/_next/static/chunks/72917-4040e0c48129ae2c.js",
  "/_next/static/chunks/73296-4fcff6f7cbf25cf2.js",
  "/_next/static/chunks/73372-f8e01f3785e2cbdd.js",
  "/_next/static/chunks/7405-8d12de7d197d918e.js",
  "/_next/static/chunks/74572-36d7fcf5b8ea6e4a.js",
  "/_next/static/chunks/74586-d6615e945aa18ea6.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-504d79a2531d0d88.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76078-d72d5c335f7c40bc.js",
  "/_next/static/chunks/76462-f34c7f2ebb954e08.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/78037-19c9e8a6ef802816.js",
  "/_next/static/chunks/79297-1889737bfab1aa21.js",
  "/_next/static/chunks/805-4580f78b4cc2a235.js",
  "/_next/static/chunks/8079-992fd6673bc1d0e7.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/8382-f7480e9567d150b8.js",
  "/_next/static/chunks/84584-362b7b6c9580d167.js",
  "/_next/static/chunks/85089-c43d947108ece686.js",
  "/_next/static/chunks/86044-a3f147441a54463c.js",
  "/_next/static/chunks/8704-1c3078feb16800cb.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88003-7371f24452dce3a3.js",
  "/_next/static/chunks/88087-69029424f7c77388.js",
  "/_next/static/chunks/88470-762c7d92e79d5b9f.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-e66bdfba72b3be0c.js",
  "/_next/static/chunks/88751-bb1d3d38d59ef217.js",
  "/_next/static/chunks/89223-9348dee26f44d2eb.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/92758-d10552e41edd32e9.js",
  "/_next/static/chunks/93463-310649cfb1ae0895.js",
  "/_next/static/chunks/94730671-b875e21d32c5b1a4.js",
  "/_next/static/chunks/94997-24eed91adda4ace6.js",
  "/_next/static/chunks/98459-d72d5c335f7c40bc.js",
  "/_next/static/chunks/98698-fe89575a2f06e830.js",
  "/_next/static/chunks/99341-5bb921ca23fd36e3.js",
  "/_next/static/chunks/99707-7a384458d5cd5012.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-6ee32f9a70b57878.js",
  "/_next/static/chunks/app/[locale]/(home)/page-b6cd814660461566.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-f616ad5a616cc91b.js",
  "/_next/static/chunks/app/[locale]/account/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/account/page-58b0122d3cad53cd.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/achievements/page-2b422dade89ca4da.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-20bee0a5c2cf893d.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-61a9a933b5d809cd.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-a10174edcbe20afa.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-be7e016a2d191867.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-fdad58313ab608c8.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-cc3d4240b745aead.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-2d6fe2235ab7d655.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-16f21b9758b5b2f2.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-67d5d6f29022378f.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-9e467c54d09387f9.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-c400682f221bf2c6.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-24a28397d58c5715.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-b081ec1cbcee5ab7.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-34a58f3910a69bfc.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-82dabe465f7c0f3c.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-fb8211ba216b900e.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-65f59f8b4b75c5d7.js",
  "/_next/static/chunks/app/[locale]/admin/layout-b42378503e92d16f.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-9a8288a055520236.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-e9bf606953f989e6.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-f3a621cb3dd19915.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-dfdf840160cb87f1.js",
  "/_next/static/chunks/app/[locale]/admin/page-e6fb082fa36410ac.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-c9331b957b4ca68e.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-65ed4dd2d50cdc33.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-668ee5304de2296b.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-72d2b9721b7e3ef7.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-427e8a39db56a3df.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-dcc796427b5fc7f9.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-3d6caae770c2f97a.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-353eb395c1a61271.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-ed6ee7993d21bfc4.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-cfc587b9a5ec4a21.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-ce0d86e36378f02a.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-f84846419a048fd2.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-5e9394a9d2042ec3.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-dc4f82d74eba4a9d.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-b7beac547ff99d59.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-a84e03b27bf98e13.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-2aab6adb8720b686.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-bf91d3730228840a.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-1f2d2dbef26f085a.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-513b1e89d90d2f17.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-2881b4bd3773f961.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-0dd99872136897c3.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-c16c7065a34b6723.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-e420ac587f4f4a09.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-37c6e2401632e7e7.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-9eeed0f27fc56552.js",
  "/_next/static/chunks/app/[locale]/blog/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/blog/page-e11064a47628c9aa.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-0fb9d6b70c1e4148.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-e644408e19c0a7b1.js",
  "/_next/static/chunks/app/[locale]/comics/page-0c24c2687c3f53d7.js",
  "/_next/static/chunks/app/[locale]/contact/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/contact/page-1196e8700cdbc7bb.js",
  "/_next/static/chunks/app/[locale]/credits/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/credits/page-3419004aedf7d39d.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-8b6e2c0665a52fa5.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-aeacfdf67fbdd523.js",
  "/_next/static/chunks/app/[locale]/drill/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/drill/page-795687215fee163d.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-0947444c1c918cdd.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-594c8f05b7dd3258.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-cfabf3f41aff9902.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-ade2d55840cf6c7e.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-52a1325ebe151f74.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-217a76b1b20eff54.js",
  "/_next/static/chunks/app/[locale]/games/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/games/page-a348a462e9bf0a39.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-0e981ed35748d168.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-d74a57a5ac5b792e.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-d69e03ded9038899.js",
  "/_next/static/chunks/app/[locale]/intro/page-814c7deee07cf3f7.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-469e874ccb217588.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-3156368c130a2f57.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-21c9d53d80168cce.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-1a63284215fc578f.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-7e3cc044bdcd6c21.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-447ca2e17bb156c8.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-a9aec8e837236260.js",
  "/_next/static/chunks/app/[locale]/layout-411c184604fe84f0.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-dad2f174e1c28c32.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-d0c527442276f4d4.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-799b0fb686d99332.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-fb280d8599716472.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-0bb3e941d5d41b88.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-af1093d5627afb36.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-448e163178c316ca.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-33f087ad21dc2605.js",
  "/_next/static/chunks/app/[locale]/library/page-889398fe447d5365.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-4bf56a7fb07e6b55.js",
  "/_next/static/chunks/app/[locale]/lists/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/lists/page-99cf0fead1dba1b1.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-268c90a5a9034a4c.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-b2bcecbcb683aea8.js",
  "/_next/static/chunks/app/[locale]/news/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/news/page-7ed50f5788adbfac.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-5ded9f25543b0680.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-a200f10e8330f289.js",
  "/_next/static/chunks/app/[locale]/not-found-b7aa86131008f687.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-23a74dd0b323a53f.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-287154d9b0e2782e.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-db5641cf5044d4cd.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-6ee32f9a70b57878.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-49ebae0cbdaa9a3d.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-0c69eb7d84dc377b.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-62c7b64d01cea60d.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-4fa1eb5e2fe2fe71.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/pricing/page-0c5641fd350295e7.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/privacy/page-a217493e86fc1b9a.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-dc6f53eeffb31b68.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-f98f3cfbb6d4c4ab.js",
  "/_next/static/chunks/app/[locale]/resources/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/resources/page-f6619d5776f695fa.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-b8b5c5bbe28c54db.js",
  "/_next/static/chunks/app/[locale]/review/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/review/page-6ee32f9a70b57878.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/review/session/page-3fd416fdf47b030a.js",
  "/_next/static/chunks/app/[locale]/server-error/page-c6f5520727c07171.js",
  "/_next/static/chunks/app/[locale]/settings/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/settings/page-e766aeafc3ae4a0b.js",
  "/_next/static/chunks/app/[locale]/share/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/share/page-a8d7b0b3778b4eb2.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/showcase/page-36e38f9717ea7e36.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/statistics/page-3770e4e51b0730d2.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-8a4c3e08d80ac51a.js",
  "/_next/static/chunks/app/[locale]/stories/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/stories/page-11e3aeab85198638.js",
  "/_next/static/chunks/app/[locale]/terms/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/terms/page-5493cc2440a3f4be.js",
  "/_next/static/chunks/app/[locale]/test-email/page-22d28f9393a37067.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-7a5d1af52f87f058.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-7a86ed7f0c617378.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-f78117ae9ed2a83d.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-916506e37c38c202.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-931fcf8dedc64343.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-d4818c23940534f3.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-ca207de7f2f47465.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-dd4929184ec08c11.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-7d98fd2c1060089d.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-61b408e0e80c286f.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-ba77a1bd74a81034.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-34be2e2bd50bc246.js",
  "/_next/static/chunks/app/[locale]/todos/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/todos/page-421245e125733745.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-1cfe05da0a302314.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-520fc52be6666f68.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-ffc4f5ab0564f5e5.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-27265c81b947a50d.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-98c3b3045671fbfa.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-e10cc645fd6b509e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-d8dfe69d1aeb9395.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-cbbdd48656a23c8f.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-cca9346a46302ce9.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-750a7014309eb7df.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-d53a0e367ea7f4e1.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-a3e66a4c1be29912.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-5e196b31ff7e3ea0.js",
  "/_next/static/chunks/app/_not-found/page-6ee32f9a70b57878.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-46c8e0e0b090ec8f.js",
  "/_next/static/chunks/app/error-010e63cb597cfb2d.js",
  "/_next/static/chunks/app/global-error-63e51a24a4298345.js",
  "/_next/static/chunks/app/layout-dec655e10387de11.js",
  "/_next/static/chunks/app/not-found-e788dd8b4c9f1fa8.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-app-f6252dbd1fe808b2.js",
  "/_next/static/chunks/main-cd55c576c37ced5a.js",
  "/_next/static/chunks/pages/_app-f365312a4d2529fb.js",
  "/_next/static/chunks/pages/_error-ff431fa75c297bd3.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-ccde2db9873843b8.js",
  "/_next/static/css/58ca86956afb7910.css",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/7f11a5077e888932.css",
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
