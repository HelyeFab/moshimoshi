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
const DEBUG = false;

// Logging wrappers - only log when DEBUG is enabled
const log = DEBUG ? console.log.bind(console) : () => {};
const warn = DEBUG ? console.warn.bind(console) : () => {};
// Always keep console.error for critical issues

const CACHE_VERSION = 'moshimoshi-bae6b94a2047';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

// Audio cache configuration
const AUDIO_CACHE_CONFIG = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxEntries: 250, // ~200 kana + buffer for other audio
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
  '/flashcards',          // Flashcards page (has dedicated SyncManager for offline)
  '/lists',               // User lists (uses IndexedDB as primary storage)
  '/textbook-vocabulary', // Textbook vocabulary (static bundled JSON data)
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
  "/_next/static/aIw9uYZYDb978zxxK74Fy/_buildManifest.js",
  "/_next/static/aIw9uYZYDb978zxxK74Fy/_ssgManifest.js",
  "/_next/static/chunks/10152-ce5cb8b0f37c62a2.js",
  "/_next/static/chunks/10409-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/11073-c49d53d097d00f25.js",
  "/_next/static/chunks/11599-e986443a5e668d37.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/12553-3c26a735e4cfb2f2.js",
  "/_next/static/chunks/12755-608e01a075b16dac.js",
  "/_next/static/chunks/12899-486f9bac95e76c53.js",
  "/_next/static/chunks/13523-fd15821c144a9307.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14777-519d0e9b10e6b729.js",
  "/_next/static/chunks/14810-a3ad31cce7114e44.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/15361-9056bd6d4f47f1e4.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/1673-8f625db55ae992b4.js",
  "/_next/static/chunks/19075-fdcb55410bfcfd6d.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/20461-cbea971ba25d4726.js",
  "/_next/static/chunks/20541-8f514a0a7f0a7ab6.js",
  "/_next/static/chunks/20554-c6b7d5a59f66ff79.js",
  "/_next/static/chunks/20840-d72d5c335f7c40bc.js",
  "/_next/static/chunks/21544-a8f0b60cb83afb43.js",
  "/_next/static/chunks/22100-e7000aaed83a8439.js",
  "/_next/static/chunks/22470-092c41530991f39d.js",
  "/_next/static/chunks/22489-0467e844a304ede2.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-f7480e9567d150b8.js",
  "/_next/static/chunks/23810-f04b95fcdf9047a1.js",
  "/_next/static/chunks/23868-265ec8dce87653b4.js",
  "/_next/static/chunks/23930-b7fde159df4d447e.js",
  "/_next/static/chunks/24069-94409b83c3cd1ef0.js",
  "/_next/static/chunks/24366-79a6a6e781a39914.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25153-191f031af1d5ff9a.js",
  "/_next/static/chunks/25410-7df4cc370d951ab3.js",
  "/_next/static/chunks/26823-dc133f301c3ded03.js",
  "/_next/static/chunks/27183-a235275a501ef329.js",
  "/_next/static/chunks/27890-9b02887178ed0d45.js",
  "/_next/static/chunks/28278-9bcc0397dc13c059.js",
  "/_next/static/chunks/28833-11f0cf77e6078f57.js",
  "/_next/static/chunks/30438-ed393af3af95fa88.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31480-e229f0f284911956.js",
  "/_next/static/chunks/32790-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/33316-78e80123d69c15f1.js",
  "/_next/static/chunks/34196-adb9d1eba27d744d.js",
  "/_next/static/chunks/35925-9ef41eca727c630e.js",
  "/_next/static/chunks/36421-98a120b884745631.js",
  "/_next/static/chunks/36665-6eac61abcf7eda5e.js",
  "/_next/static/chunks/37005-ca9566debb9b5409.js",
  "/_next/static/chunks/38017-277a2437047907b1.js",
  "/_next/static/chunks/38151-af4896ae22032fa6.js",
  "/_next/static/chunks/38179-7dc34f5c4af751d3.js",
  "/_next/static/chunks/4148-ca9566debb9b5409.js",
  "/_next/static/chunks/42755-203fe329c26e4347.js",
  "/_next/static/chunks/43903-0daa92d56d76e6df.js",
  "/_next/static/chunks/43952-b3d90fa8d22dc6d0.js",
  "/_next/static/chunks/45161-6373c2a3e4bda930.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-609151be89639177.js",
  "/_next/static/chunks/46693-15da08f7b11e606f.js",
  "/_next/static/chunks/46875-2128efea6bb8f84d.js",
  "/_next/static/chunks/49882-29d64c0219d6394a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50106-17047ac420cdff38.js",
  "/_next/static/chunks/50443-56e61b140c52d8dc.js",
  "/_next/static/chunks/50972-0a3a516a1cfd9479.js",
  "/_next/static/chunks/51189-bc9fc88af4f87e6f.js",
  "/_next/static/chunks/52413-483d77342fc9ed10.js",
  "/_next/static/chunks/52445-d37beccb2afe4450.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53697-d72d5c335f7c40bc.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-09b9aff627ecea9e.js",
  "/_next/static/chunks/54469-80a2f9dda48676d7.js",
  "/_next/static/chunks/54a60aa6-fde3c27555179f9b.js",
  "/_next/static/chunks/56526-a696280abe78b205.js",
  "/_next/static/chunks/56852-f1b1001673c232c3.js",
  "/_next/static/chunks/57292-fff2a9b7db8bc006.js",
  "/_next/static/chunks/57961-ae82ea1600874d80.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/59386-ca9566debb9b5409.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/60134-3ec78c02dbde7455.js",
  "/_next/static/chunks/61324-4e990da90c694db1.js",
  "/_next/static/chunks/62748-f0cf92795cdf76af.js",
  "/_next/static/chunks/62776-ce26f87bdf6d926e.js",
  "/_next/static/chunks/63388-0fb9a1fb6922e3b6.js",
  "/_next/static/chunks/6350-c29a9620a1d06367.js",
  "/_next/static/chunks/63790-5d51db9e7c6b5dc7.js",
  "/_next/static/chunks/64997-3ac33c311ee272cf.js",
  "/_next/static/chunks/65053-b7c296b5490bca93.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69229-c088aa2edbb77496.js",
  "/_next/static/chunks/69256-2128efea6bb8f84d.js",
  "/_next/static/chunks/69294-64e444c95bf3abb8.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/73145-66d43dc0a49f9bd2.js",
  "/_next/static/chunks/73372-f8e01f3785e2cbdd.js",
  "/_next/static/chunks/7405-8d12de7d197d918e.js",
  "/_next/static/chunks/74572-36d7fcf5b8ea6e4a.js",
  "/_next/static/chunks/74586-d6615e945aa18ea6.js",
  "/_next/static/chunks/7508b87c-5f32fe18b3b5e1c6.js",
  "/_next/static/chunks/75359-504d79a2531d0d88.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/76078-d72d5c335f7c40bc.js",
  "/_next/static/chunks/76462-f34c7f2ebb954e08.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/78037-19c9e8a6ef802816.js",
  "/_next/static/chunks/79297-ee21f7f685a61cdf.js",
  "/_next/static/chunks/79564-30637e4496cb885d.js",
  "/_next/static/chunks/805-766df879666528e0.js",
  "/_next/static/chunks/8079-300b45b0987c63cf.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/81200-7b6eea3a2dc0429f.js",
  "/_next/static/chunks/82125-f989592c1a68546e.js",
  "/_next/static/chunks/8382-f7480e9567d150b8.js",
  "/_next/static/chunks/84584-362b7b6c9580d167.js",
  "/_next/static/chunks/84c12632-46cbc2c01210893f.js",
  "/_next/static/chunks/85089-c43d947108ece686.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88003-8b5c9735bf7c4c20.js",
  "/_next/static/chunks/88087-69029424f7c77388.js",
  "/_next/static/chunks/88470-762c7d92e79d5b9f.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-e66bdfba72b3be0c.js",
  "/_next/static/chunks/88751-62fd1c248429180c.js",
  "/_next/static/chunks/89223-9348dee26f44d2eb.js",
  "/_next/static/chunks/89742-d6dc576b76cdd797.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/92758-d10552e41edd32e9.js",
  "/_next/static/chunks/93463-310649cfb1ae0895.js",
  "/_next/static/chunks/94730671-89e40ccead2353bc.js",
  "/_next/static/chunks/94997-5e35498fce2e1018.js",
  "/_next/static/chunks/98459-d72d5c335f7c40bc.js",
  "/_next/static/chunks/98698-fe89575a2f06e830.js",
  "/_next/static/chunks/99341-5bb921ca23fd36e3.js",
  "/_next/static/chunks/99707-7a384458d5cd5012.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-3268183244dcf4f5.js",
  "/_next/static/chunks/app/[locale]/(home)/page-583a7c875b50b9fd.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-e6d1cd15f47d0cd1.js",
  "/_next/static/chunks/app/[locale]/account/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/account/page-7275615f67a4c3ee.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/achievements/page-09a72484caef7096.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-711fa8f0177ad66f.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-05c800184c81c1fa.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-b7d64e3dbd4180cc.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-179d420398fc09e9.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-49543b9812eb04aa.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-65a3122386e04a5d.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-4ccccf99e359755c.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-457968a5acbfe474.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-ac3b6e40bde88379.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-0b8795841600e6d3.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-0daa62d6a093633c.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-2bd7c76b78dcea88.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-94293a8eba227ebd.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-73ab6d58249f054f.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-f12211f52d33c7c3.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-1a1d1e2caf34ca31.js",
  "/_next/static/chunks/app/[locale]/admin/layout-c485f6123f69062d.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-d754faf137bf4590.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-d0bc93429ce1d0aa.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-fcdd5b7eb278442f.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-807862f4c861f639.js",
  "/_next/static/chunks/app/[locale]/admin/page-e1c7c4b5745fdcca.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-1929f26b0cfe9385.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-f6ad4d8cccc299cc.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-a62da16294bede5a.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-cfd1f5d03ae02bdb.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-3eafe5c23533a0c2.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-29dbb761ed8472b4.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-68a1c5a17769e9c7.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-b21daf07ce5c3b93.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-031217863efb1f54.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-1629c36f3b363211.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-d0ef12aae4702b42.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-58411bccbb5e239a.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-1c399fc75d4c8759.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-da655e3f95cf9ae3.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-b8e818ce8cf2d69a.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-b9ae554a48e3f40c.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-838053b53c6dcfc1.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-3242b0e905afcfee.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-7aa7eacfd15f4fa8.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-a53a0d45ff4aa763.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-e631e9e663d45f84.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-ce69fc98dc39c088.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-8c711f00dba17e5e.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-7dc859e64983db58.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-e382c2a0b19558a0.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-f9e3135b65249340.js",
  "/_next/static/chunks/app/[locale]/blog/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/blog/page-f73ce52bcdbe670f.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-9d180204b0be37bf.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-9d13d33629c1e401.js",
  "/_next/static/chunks/app/[locale]/comics/page-b63400530fdf8dc2.js",
  "/_next/static/chunks/app/[locale]/contact/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/contact/page-1aaa54fb5d179bfd.js",
  "/_next/static/chunks/app/[locale]/credits/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/credits/page-1c7c5c83ab08973b.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-e5ffebb700c2af0b.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-561804948b54ad16.js",
  "/_next/static/chunks/app/[locale]/drill/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/drill/page-76040e54801e8326.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-bb3161a3cfe61ac3.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-db6c0a5d190b37ee.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-cac15e4a57fa921c.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-cedc80f3cba92c91.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-c6dda3aa7178e8d7.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-a30944234b98bd8d.js",
  "/_next/static/chunks/app/[locale]/games/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/page-6073b1944f6a43aa.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-b4188f8f24124556.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-db6f448180288a59.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-8975658af18d4b15.js",
  "/_next/static/chunks/app/[locale]/intro/page-6aab49e66ca5b3dc.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-d879be9a7a8ce007.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-6979264f2a7139f7.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-bac09ee2f5656ba2.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-45bf399fe8067037.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-1ddb60020ff51b75.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-3ed951453d5d570b.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-1c5487334db5914c.js",
  "/_next/static/chunks/app/[locale]/layout-a14df2e6c133b49b.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-08884f1657b0d548.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-ecee0a293b0f894a.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-1dc614c2e9b0ddf5.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-bf43107db383b752.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-c3e7e161858f825c.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-a307589e3d21c20c.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-3c4d766720753a51.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-915a404699e73381.js",
  "/_next/static/chunks/app/[locale]/library/page-7db315aab4487bf6.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-6a12d1e5988f67ff.js",
  "/_next/static/chunks/app/[locale]/lists/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/lists/page-9c284b53ccc94d80.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-28e3ce5358f1b64a.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-38ee2bb2da304a21.js",
  "/_next/static/chunks/app/[locale]/news/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/news/page-f7a71d1aecdac945.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-90af254991881db6.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-c469d362479eed05.js",
  "/_next/static/chunks/app/[locale]/not-found-aed892bc49ac10b6.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-61afced7092d1994.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-cb2b25f641aa1914.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-9cef68208e3a88cb.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-3268183244dcf4f5.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-b7867bc9dc09d301.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-4447006b256fb6ad.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-894ab849768899ee.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-b45b835752b253b2.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/pricing/page-0cd3cc338ac25a89.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/privacy/page-83eabcf3057bd0c1.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-a1a6666c9e0abe18.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-7aafabf8338bd936.js",
  "/_next/static/chunks/app/[locale]/resources/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/resources/page-b16ac2ceaa282b25.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-a1054065a1c49ade.js",
  "/_next/static/chunks/app/[locale]/review/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review/page-3268183244dcf4f5.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review/session/page-2ca03731b6cc4d61.js",
  "/_next/static/chunks/app/[locale]/server-error/page-a24265fe9bd4b2be.js",
  "/_next/static/chunks/app/[locale]/settings/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/settings/page-cc9f8e0333ab2fe2.js",
  "/_next/static/chunks/app/[locale]/share/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/share/page-fe169916328bcc9d.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/showcase/page-b5b377d8f825e6f8.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/statistics/page-1e230dcb08d20971.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-28d60e9ab2e1993f.js",
  "/_next/static/chunks/app/[locale]/stories/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/stories/page-db2c71c6b661ef42.js",
  "/_next/static/chunks/app/[locale]/terms/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/terms/page-a70ae4ca0a789c61.js",
  "/_next/static/chunks/app/[locale]/test-email/page-ede50d39463ec693.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-71b395ab1cb84b86.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-b7d0cbb38c04885a.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-02f73c1d8c80c0dc.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-d53ff2f2c11b570f.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-ab19d67374b7a089.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-01a289c0dac5dcba.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-d49a730f04f015e5.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-a22667c564fdab44.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-4890351e488dc813.js",
  "/_next/static/chunks/app/[locale]/todos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/todos/page-3f63a8d5c417aa8d.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-04801e9694eec0bd.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-68eb1d8205127ccb.js",
  "/_next/static/chunks/app/[locale]/tools/textbook-vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/textbook-vocabulary/page-3aa9abf3f85f9240.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-83600854189ce813.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-6967cebfa01b1f9e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-c7cc6b3ae433999f.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-60090247ebf04f6e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-a174231a987c52fd.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-92ef6ee5cf04db3b.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-4519ee6187b2a009.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-b86f6f03b772e60d.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-ee13fdd6d5eef959.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-acc591e56c0aa597.js",
  "/_next/static/chunks/app/_not-found/page-3268183244dcf4f5.js",
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
  "/_next/static/chunks/webpack-34642d00445e0208.js",
  "/_next/static/css/58ca86956afb7910.css",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/aa5f83a85d426b75.css",
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
    const validCaches = [STATIC_CACHE, AUDIO_CACHE, PAGES_CACHE];

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

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests except for allowed CDNs
  if (url.origin !== self.location.origin) {
    // Allow specific CDNs if needed (e.g., fonts, analytics)
    const allowedOrigins = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];

    if (!allowedOrigins.some(origin => url.origin === origin)) {
      return;
    }
  }

  // Check if this is a navigation request
  const isNavigationRequest = request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

  if (isNavigationRequest) {
    // IMPORTANT: In development or when online, don't aggressively serve offline pages
    // Check if we're truly offline before serving fallback
    const isOnline = self.navigator.onLine;

    // Detect development mode by checking for localhost or common dev ports
    const isDevelopment = url.hostname === 'localhost' ||
                          url.hostname === '127.0.0.1' ||
                          url.port === '3000' ||
                          url.port === '3001';

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
          const cacheKey = new Request(url.origin + url.pathname);

          try {
            // Try network with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(request, { signal: controller.signal });
            clearTimeout(timeoutId);

            // Cache successful responses for offline use
            if (response.ok) {
              log('[SW] Caching page for offline:', url.pathname);
              pagesCache.put(cacheKey, response.clone());
            }

            return response;
          } catch (error) {
            // Network failed - try to serve from cache
            log('[SW] Network failed, checking cache for:', url.pathname);
            let cachedPage = await pagesCache.match(cacheKey);

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
          const response = await fetch(request);
          // Cache RSC responses for offline-enabled pages
          if (response.ok && isOfflinePageRSC) {
            log('[SW] Caching RSC payload:', url.pathname);
            pagesCache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          // Try cache for RSC requests
          const cachedRSC = await pagesCache.match(request);
          if (cachedRSC) {
            log('[SW] Serving cached RSC:', url.pathname);
            return cachedRSC;
          }
          throw error;
        }
      })()
    );
    return;
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
