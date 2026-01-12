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

const CACHE_VERSION = 'moshimoshi-26057fd6ebae';
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
  "/_next/static/2h-eTgzafxmK7nIY0apDU/_buildManifest.js",
  "/_next/static/2h-eTgzafxmK7nIY0apDU/_ssgManifest.js",
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
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
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
  "/_next/static/chunks/23568-1dcd3e8efcf2ea55.js",
  "/_next/static/chunks/23810-22544a2797a9bf0a.js",
  "/_next/static/chunks/23868-265ec8dce87653b4.js",
  "/_next/static/chunks/23930-b7fde159df4d447e.js",
  "/_next/static/chunks/24069-f22fe1f3962ded76.js",
  "/_next/static/chunks/24366-79a6a6e781a39914.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25153-191f031af1d5ff9a.js",
  "/_next/static/chunks/25410-7df4cc370d951ab3.js",
  "/_next/static/chunks/26823-dc133f301c3ded03.js",
  "/_next/static/chunks/27183-a235275a501ef329.js",
  "/_next/static/chunks/27890-9b02887178ed0d45.js",
  "/_next/static/chunks/28278-9bcc0397dc13c059.js",
  "/_next/static/chunks/28833-11f0cf77e6078f57.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/32790-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/33316-7fd105d5cbb9d22d.js",
  "/_next/static/chunks/34196-450a333f28b09ff3.js",
  "/_next/static/chunks/35925-9ef41eca727c630e.js",
  "/_next/static/chunks/36421-18472b6142d1053f.js",
  "/_next/static/chunks/36665-6eac61abcf7eda5e.js",
  "/_next/static/chunks/37005-8b4610f027540d23.js",
  "/_next/static/chunks/37803-d267cb1f876e6c84.js",
  "/_next/static/chunks/3783-6fab11f794e20472.js",
  "/_next/static/chunks/38017-52276ea8b3664e84.js",
  "/_next/static/chunks/38151-c5ba4ea22a434063.js",
  "/_next/static/chunks/38179-7dc34f5c4af751d3.js",
  "/_next/static/chunks/38477-54e41718040f84cf.js",
  "/_next/static/chunks/39318-ca587d3ee9ae6ae3.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/42755-203fe329c26e4347.js",
  "/_next/static/chunks/43903-0daa92d56d76e6df.js",
  "/_next/static/chunks/43952-2e30e09861226db6.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-609151be89639177.js",
  "/_next/static/chunks/46693-15da08f7b11e606f.js",
  "/_next/static/chunks/46875-2128efea6bb8f84d.js",
  "/_next/static/chunks/47179-51605145bed6e3a7.js",
  "/_next/static/chunks/49483-247923524eb943b9.js",
  "/_next/static/chunks/49882-29d64c0219d6394a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50106-5c4170b3b72e1a85.js",
  "/_next/static/chunks/50443-56e61b140c52d8dc.js",
  "/_next/static/chunks/51189-bc9fc88af4f87e6f.js",
  "/_next/static/chunks/52413-483d77342fc9ed10.js",
  "/_next/static/chunks/52445-d37beccb2afe4450.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53367-c7346b39dca4dc91.js",
  "/_next/static/chunks/53697-d72d5c335f7c40bc.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-09b9aff627ecea9e.js",
  "/_next/static/chunks/5441-4d40129e2fc41099.js",
  "/_next/static/chunks/54469-80a2f9dda48676d7.js",
  "/_next/static/chunks/54a60aa6-fde3c27555179f9b.js",
  "/_next/static/chunks/56526-a696280abe78b205.js",
  "/_next/static/chunks/56767-93d4918a0bf8098e.js",
  "/_next/static/chunks/56852-f815eb994fc2064a.js",
  "/_next/static/chunks/57292-685a774542f28f3b.js",
  "/_next/static/chunks/57961-ae82ea1600874d80.js",
  "/_next/static/chunks/58126-2fbfb092029e48ea.js",
  "/_next/static/chunks/59386-8b4610f027540d23.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-2b99c0ca635cfe24.js",
  "/_next/static/chunks/60134-3ec78c02dbde7455.js",
  "/_next/static/chunks/61324-ee1311648d71fe5a.js",
  "/_next/static/chunks/62748-f0cf92795cdf76af.js",
  "/_next/static/chunks/63134-17444764ecd4cb92.js",
  "/_next/static/chunks/63388-0fb9a1fb6922e3b6.js",
  "/_next/static/chunks/6350-c29a9620a1d06367.js",
  "/_next/static/chunks/67686-c2b8125c38a9620c.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69086-b6357b94f49cc053.js",
  "/_next/static/chunks/69229-c088aa2edbb77496.js",
  "/_next/static/chunks/69256-2128efea6bb8f84d.js",
  "/_next/static/chunks/69294-64e444c95bf3abb8.js",
  "/_next/static/chunks/70217-c59df39ce94b08af.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71683-6e9af323532551d2.js",
  "/_next/static/chunks/72253-682ae60907f87ebe.js",
  "/_next/static/chunks/73372-f8e01f3785e2cbdd.js",
  "/_next/static/chunks/7405-180c307329b4d3a5.js",
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
  "/_next/static/chunks/79297-ee21f7f685a61cdf.js",
  "/_next/static/chunks/805-4580f78b4cc2a235.js",
  "/_next/static/chunks/8079-992fd6673bc1d0e7.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/83057-f1744d8c1bb4d748.js",
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
  "/_next/static/chunks/89742-d1c34ad5126a237e.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/90909-5417a68ce2e859cc.js",
  "/_next/static/chunks/92758-d10552e41edd32e9.js",
  "/_next/static/chunks/93463-310649cfb1ae0895.js",
  "/_next/static/chunks/94730671-b875e21d32c5b1a4.js",
  "/_next/static/chunks/94997-b16034afd6dcfee0.js",
  "/_next/static/chunks/98089-e116be379bcbca4a.js",
  "/_next/static/chunks/98459-d72d5c335f7c40bc.js",
  "/_next/static/chunks/98698-fe89575a2f06e830.js",
  "/_next/static/chunks/99341-5bb921ca23fd36e3.js",
  "/_next/static/chunks/99707-7a384458d5cd5012.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-82fbe3801c389471.js",
  "/_next/static/chunks/app/[locale]/(home)/page-7a37053879e1789e.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-df48702b499be111.js",
  "/_next/static/chunks/app/[locale]/account/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/account/page-e0e344bfda3c0147.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/achievements/page-46d8a0aa43e6074f.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-dee783c2b8b70380.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-ca769a53eed16474.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-b7d64e3dbd4180cc.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-1fffe7a7954dbd85.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-885b39f4e7995aaa.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-29be26bcbac436bc.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-0347cda70ab6908b.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-e59a03dc871e39e0.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-5b944a51a145bd6d.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-9c5395ffa12a4372.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-2385b9be3e8534e3.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-60001b9f480663b7.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-38a8840a35e26a84.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-6f6594106622eac3.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-c309f110f2f37d33.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-f12211f52d33c7c3.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-1a1d1e2caf34ca31.js",
  "/_next/static/chunks/app/[locale]/admin/layout-7e6e526c24056bfe.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-d754faf137bf4590.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-d0bc93429ce1d0aa.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-fcdd5b7eb278442f.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-38f3775a1f78e8a2.js",
  "/_next/static/chunks/app/[locale]/admin/page-e1c7c4b5745fdcca.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-1929f26b0cfe9385.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-f6ad4d8cccc299cc.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-a62da16294bede5a.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-25f810ec8b0cccbb.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-3eafe5c23533a0c2.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-dd630e7573e031f3.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-576ef3fc294e5177.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-1b08fc8973854e33.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-231268b706f78144.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-1629c36f3b363211.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-d0ef12aae4702b42.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-58411bccbb5e239a.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-dc03d068540d30e8.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-da655e3f95cf9ae3.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-55112c98d4927006.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-1c9b27cba7620faa.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-838053b53c6dcfc1.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-7c61d9aeb5b12ac0.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-7aa7eacfd15f4fa8.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-a53a0d45ff4aa763.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-08db2df2dc6fe8ee.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-52a37a740eb002bf.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-8c711f00dba17e5e.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-7dc859e64983db58.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-c19e8e5ea60bc5b7.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-0833a1790ff97f8c.js",
  "/_next/static/chunks/app/[locale]/blog/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/blog/page-00781e0e275134b6.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-9d180204b0be37bf.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-7627f9df27dcf1c5.js",
  "/_next/static/chunks/app/[locale]/comics/page-14dd92f9d716d900.js",
  "/_next/static/chunks/app/[locale]/contact/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/contact/page-0b247e4002be02bf.js",
  "/_next/static/chunks/app/[locale]/credits/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/credits/page-f945a8d90344f5d9.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-c2d2189775f5226c.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-561804948b54ad16.js",
  "/_next/static/chunks/app/[locale]/drill/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/drill/page-e3adc98dfd729bf2.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-4590ba7dc0201538.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-3f03c2f110456db5.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-2edfeac1aef946d4.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-7f13d2c23c0f6943.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-736bad7dcba0c4a4.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-a340c979df701a58.js",
  "/_next/static/chunks/app/[locale]/games/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/page-cb3f25999f06ba94.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-0cfc502c6b8efffb.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-49a991201b87d17a.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-4828ea594b4e9b3e.js",
  "/_next/static/chunks/app/[locale]/intro/page-6aab49e66ca5b3dc.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-ebd2056a7f8ff0e9.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-e5d9b3f01a3227eb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-aa7b6bf8077ca1f7.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-dc190289ff5c217a.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-a26502e3463a6ce1.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-a83cdbbe3d563b58.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-636a207450c8a679.js",
  "/_next/static/chunks/app/[locale]/layout-3d3238767b98584c.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-2099fb685575130b.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-3c0153b371c6095c.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-07c9dd3b5e3479ed.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-2c50f20d13bc322f.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-4971242ef1d566db.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-956931a9cb1b9faa.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-39e6356fe01e927c.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-a67fb42fd66b56b1.js",
  "/_next/static/chunks/app/[locale]/library/page-04a2a11a5e5abeb8.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-b97bcac3cb7ba921.js",
  "/_next/static/chunks/app/[locale]/lists/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/lists/page-95c1271e8f0a9805.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-cca990cc178c0b6e.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-ad919811ac83bf4b.js",
  "/_next/static/chunks/app/[locale]/news/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/news/page-0426cc432c11922b.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-90af254991881db6.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-c469d362479eed05.js",
  "/_next/static/chunks/app/[locale]/not-found-9bc5dcc35fb2be8f.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-606bc1b456e48796.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-cb2b25f641aa1914.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-9cef68208e3a88cb.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-82fbe3801c389471.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-b7867bc9dc09d301.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-4447006b256fb6ad.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-894ab849768899ee.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-dd15a2a34b3eafe4.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/pricing/page-db03819da4814096.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/privacy/page-83eabcf3057bd0c1.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-a1a6666c9e0abe18.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-95654e1dd5e27f1d.js",
  "/_next/static/chunks/app/[locale]/resources/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/resources/page-9315f85a8ec356da.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-584d34a1d71dbe5b.js",
  "/_next/static/chunks/app/[locale]/review/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review/page-82fbe3801c389471.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/review/session/page-3ba6572dae8a7066.js",
  "/_next/static/chunks/app/[locale]/server-error/page-7d633dc4852ca9e3.js",
  "/_next/static/chunks/app/[locale]/settings/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/settings/page-7ab490901348731a.js",
  "/_next/static/chunks/app/[locale]/share/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/share/page-abfffa7ad5b45f07.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/showcase/page-8804a2e8dba5e044.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/statistics/page-b23c77e755f946ca.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-6842be0d2140ae7e.js",
  "/_next/static/chunks/app/[locale]/stories/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/stories/page-a14822f172394451.js",
  "/_next/static/chunks/app/[locale]/terms/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/terms/page-a70ae4ca0a789c61.js",
  "/_next/static/chunks/app/[locale]/test-email/page-ede50d39463ec693.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-a4938c59f033765f.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-151fb5ec083249a2.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-02f73c1d8c80c0dc.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-b347bd951ed50eef.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-13dcc15b9f9712ab.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-52114993327c1f2b.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-d49a730f04f015e5.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-befd1416a351025b.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-e98e753a8f1a941c.js",
  "/_next/static/chunks/app/[locale]/todos/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/todos/page-91e487276f5c6f7f.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-cf173bdbb9462d45.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-744813af2fe99720.js",
  "/_next/static/chunks/app/[locale]/tools/textbook-vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/tools/textbook-vocabulary/page-0fc24f1d153652ee.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-83600854189ce813.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-6967cebfa01b1f9e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-4f144a8d4b948b2b.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-c4e73c3aad770ae1.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-2afa767ef44462d1.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-7a09762bcccf00fc.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-7f22bdd08f9a92fd.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-09edd450913771f3.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-a8f6738d3ba3589b.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-090f54affe21aeeb.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-c55b1776891f935e.js",
  "/_next/static/chunks/app/_not-found/page-82fbe3801c389471.js",
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
  "/_next/static/chunks/webpack-f6b24c806f1815fb.js",
  "/_next/static/css/58ca86956afb7910.css",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/796235532708fb86.css",
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
