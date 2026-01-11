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

const CACHE_VERSION = 'moshimoshi-8b6e89410a4a';
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
  "/_next/static/chunks/10152-ce5cb8b0f37c62a2.js",
  "/_next/static/chunks/10409-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/10652-33011feab5b2bf4f.js",
  "/_next/static/chunks/11073-c49d53d097d00f25.js",
  "/_next/static/chunks/11599-e986443a5e668d37.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/12553-ac7b7a27e23bd50b.js",
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
  "/_next/static/chunks/20554-c6b7d5a59f66ff79.js",
  "/_next/static/chunks/20840-d72d5c335f7c40bc.js",
  "/_next/static/chunks/21544-a8f0b60cb83afb43.js",
  "/_next/static/chunks/22100-e7000aaed83a8439.js",
  "/_next/static/chunks/22470-092c41530991f39d.js",
  "/_next/static/chunks/22489-86dd1d27913abe8d.js",
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
  "/_next/static/chunks/38017-7bb98788aab0d79d.js",
  "/_next/static/chunks/38151-af4896ae22032fa6.js",
  "/_next/static/chunks/38179-7dc34f5c4af751d3.js",
  "/_next/static/chunks/4148-ca9566debb9b5409.js",
  "/_next/static/chunks/42755-203fe329c26e4347.js",
  "/_next/static/chunks/43903-0daa92d56d76e6df.js",
  "/_next/static/chunks/43952-3faf401c41b49b02.js",
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
  "/_next/static/chunks/5b86099a-2b99c0ca635cfe24.js",
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
  "/_next/static/chunks/72253-724e410c8e93e9a4.js",
  "/_next/static/chunks/73145-66d43dc0a49f9bd2.js",
  "/_next/static/chunks/73372-f8e01f3785e2cbdd.js",
  "/_next/static/chunks/7405-8d12de7d197d918e.js",
  "/_next/static/chunks/74572-36d7fcf5b8ea6e4a.js",
  "/_next/static/chunks/74586-d6615e945aa18ea6.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-504d79a2531d0d88.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/76078-d72d5c335f7c40bc.js",
  "/_next/static/chunks/76462-f34c7f2ebb954e08.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/78037-19c9e8a6ef802816.js",
  "/_next/static/chunks/79297-ee21f7f685a61cdf.js",
  "/_next/static/chunks/805-6ad6524c2be9082f.js",
  "/_next/static/chunks/8079-300b45b0987c63cf.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/81200-7b6eea3a2dc0429f.js",
  "/_next/static/chunks/82125-f989592c1a68546e.js",
  "/_next/static/chunks/8382-f7480e9567d150b8.js",
  "/_next/static/chunks/84584-362b7b6c9580d167.js",
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
  "/_next/static/chunks/94730671-b875e21d32c5b1a4.js",
  "/_next/static/chunks/94997-5e35498fce2e1018.js",
  "/_next/static/chunks/98459-d72d5c335f7c40bc.js",
  "/_next/static/chunks/98698-fe89575a2f06e830.js",
  "/_next/static/chunks/99341-5bb921ca23fd36e3.js",
  "/_next/static/chunks/99707-7a384458d5cd5012.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-3268183244dcf4f5.js",
  "/_next/static/chunks/app/[locale]/(home)/page-0fae8b0c26d0a751.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-9af8c0400ebbeb37.js",
  "/_next/static/chunks/app/[locale]/account/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/account/page-8304bb089f9d2dc5.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/achievements/page-f5f4436bd60dc932.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-dee783c2b8b70380.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-ca769a53eed16474.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-b7d64e3dbd4180cc.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-1fffe7a7954dbd85.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-885b39f4e7995aaa.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-29be26bcbac436bc.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-b7406fed46b676d8.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-348370d4f417780a.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-9c5395ffa12a4372.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-2385b9be3e8534e3.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-60001b9f480663b7.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-678aa1880f821a3f.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-6f6594106622eac3.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-c309f110f2f37d33.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-f12211f52d33c7c3.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-1a1d1e2caf34ca31.js",
  "/_next/static/chunks/app/[locale]/admin/layout-7e6e526c24056bfe.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-d754faf137bf4590.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-d0bc93429ce1d0aa.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-fcdd5b7eb278442f.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-a36fadf3df166e6b.js",
  "/_next/static/chunks/app/[locale]/admin/page-e1c7c4b5745fdcca.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-1929f26b0cfe9385.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-f6ad4d8cccc299cc.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-a62da16294bede5a.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-25f810ec8b0cccbb.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-3eafe5c23533a0c2.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-dd630e7573e031f3.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-576ef3fc294e5177.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-1b08fc8973854e33.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-c2cbdef7c044fbdf.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-1629c36f3b363211.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-d0ef12aae4702b42.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-58411bccbb5e239a.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-dc03d068540d30e8.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-da655e3f95cf9ae3.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-07327e9b778b184b.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-9296b99f23debe04.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-838053b53c6dcfc1.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-d95e334a4aa3ff35.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-7aa7eacfd15f4fa8.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-a53a0d45ff4aa763.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-9d671de0e2b27f28.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-c804a21479a92769.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-8c711f00dba17e5e.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-7dc859e64983db58.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-c19e8e5ea60bc5b7.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-d8b7cbd909282d00.js",
  "/_next/static/chunks/app/[locale]/blog/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/blog/page-da54ed475d132b04.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-9d180204b0be37bf.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-825ba0a1c55cf68d.js",
  "/_next/static/chunks/app/[locale]/comics/page-04cab8bfcad78e4f.js",
  "/_next/static/chunks/app/[locale]/contact/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/contact/page-1aaa54fb5d179bfd.js",
  "/_next/static/chunks/app/[locale]/credits/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/credits/page-4ea33a67ca853961.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-0d3da57e6e481f18.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-561804948b54ad16.js",
  "/_next/static/chunks/app/[locale]/drill/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/drill/page-88fa773d7d139afe.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-e505c7e14253f37b.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-b018e38f6d490f37.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-2edfeac1aef946d4.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-7f13d2c23c0f6943.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-ae5baf90f0ea897b.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-02f58a36b0690866.js",
  "/_next/static/chunks/app/[locale]/games/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/page-7d97721f02a4131f.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-0cfc502c6b8efffb.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-49a991201b87d17a.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-4828ea594b4e9b3e.js",
  "/_next/static/chunks/app/[locale]/intro/page-6aab49e66ca5b3dc.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-0ed7953355529bbe.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-3e693a209fd278c9.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-c2b6624522737aa5.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-6bc2f8f33af626a8.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-4c2a8f609cf01b91.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-d13b63cfcd6cdf25.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-763ed1a763bc962d.js",
  "/_next/static/chunks/app/[locale]/layout-23d14e76898c558f.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-8074ebd802537594.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-9b65c5a0dcb6fce1.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-910195305ff3987f.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-3df0c4a29415dc6e.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-c3e7e161858f825c.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-a307589e3d21c20c.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-3c4d766720753a51.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-e70c1a82e4420ffd.js",
  "/_next/static/chunks/app/[locale]/library/page-9b4281056fbfb79b.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-31a1b204da1fd7f8.js",
  "/_next/static/chunks/app/[locale]/lists/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/lists/page-75d4a4fcae6514df.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-2cbc8fe49a5edf67.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-6727e15396f3830a.js",
  "/_next/static/chunks/app/[locale]/news/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/news/page-f9661b0312e1d362.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-90af254991881db6.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-c469d362479eed05.js",
  "/_next/static/chunks/app/[locale]/not-found-9bc5dcc35fb2be8f.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-606bc1b456e48796.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-cb2b25f641aa1914.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-9cef68208e3a88cb.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-3268183244dcf4f5.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-b7867bc9dc09d301.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-4447006b256fb6ad.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-894ab849768899ee.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-ae1ac5c358df4dfc.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/pricing/page-4da2c96dba4b4961.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/privacy/page-83eabcf3057bd0c1.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-a1a6666c9e0abe18.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-f129db817fa6ae44.js",
  "/_next/static/chunks/app/[locale]/resources/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/resources/page-44095b0cb2616952.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-0a53fa15cdf4794d.js",
  "/_next/static/chunks/app/[locale]/review/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review/page-3268183244dcf4f5.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review/session/page-d92db74b9f29e274.js",
  "/_next/static/chunks/app/[locale]/server-error/page-7d633dc4852ca9e3.js",
  "/_next/static/chunks/app/[locale]/settings/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/settings/page-ae84689219650e23.js",
  "/_next/static/chunks/app/[locale]/share/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/share/page-abfffa7ad5b45f07.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/showcase/page-e7c024d304b35d7e.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/statistics/page-45af9ff63d0f56c7.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-5c7656a6a636948c.js",
  "/_next/static/chunks/app/[locale]/stories/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/stories/page-2c11e769ca46886d.js",
  "/_next/static/chunks/app/[locale]/terms/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/terms/page-a70ae4ca0a789c61.js",
  "/_next/static/chunks/app/[locale]/test-email/page-ede50d39463ec693.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-d80e6bc151f15d13.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-151fb5ec083249a2.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-02f73c1d8c80c0dc.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-a92dc9300d48bd7b.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-13dcc15b9f9712ab.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-50ed0dc7296f115b.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-d49a730f04f015e5.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-befd1416a351025b.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-2859d9e24b8bd4d4.js",
  "/_next/static/chunks/app/[locale]/todos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/todos/page-bc5f071949e17fac.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-e0235b7fc6582ad1.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-9b20a090a7e778a8.js",
  "/_next/static/chunks/app/[locale]/tools/textbook-vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/textbook-vocabulary/page-137af5da622c9cd2.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-83600854189ce813.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-6967cebfa01b1f9e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-95597919ab85d04c.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-ee12bc9e7edd3979.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-3a3a714fbb859b7a.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-25eae95333eaa998.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-a4f539ea9ec70ba8.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-b86f6f03b772e60d.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-0edbe1ce89141d84.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-aa1320d267ed4242.js",
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
  "/_next/static/chunks/webpack-49db02362920944e.js",
  "/_next/static/css/58ca86956afb7910.css",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/aa5f83a85d426b75.css",
  "/_next/static/css/af47b6060c4fddcc.css",
  "/_next/static/jeIQLmI1MnL777Wb19p0j/_buildManifest.js",
  "/_next/static/jeIQLmI1MnL777Wb19p0j/_ssgManifest.js"
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
