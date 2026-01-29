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

const CACHE_VERSION = 'moshimoshi-db054b0fa58f';
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
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-58c9f3a9ad081a09.js",
  "/_next/static/chunks/10627-bcf644fe12302657.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/12309-77e83b00a0da00b6.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/13585-d781d8b248da8465.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14673-e7741737d0d4eb68.js",
  "/_next/static/chunks/14777-1fb0b5e4dbe5bfe6.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/1673-8f625db55ae992b4.js",
  "/_next/static/chunks/17377-1a02db5ae13e0351.js",
  "/_next/static/chunks/17401-141e014b66b5574e.js",
  "/_next/static/chunks/1765-3a8977781eaa5b82.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/19645-e6427c00f73b02d0.js",
  "/_next/static/chunks/20756-8bee72c6e578e6c8.js",
  "/_next/static/chunks/20840-48aca5bb34ba504d.js",
  "/_next/static/chunks/21544-e005b466da6197bb.js",
  "/_next/static/chunks/21960-fd040988c7ffd330.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-7b8b1b2866055a08.js",
  "/_next/static/chunks/23868-20854aed872efc80.js",
  "/_next/static/chunks/23930-97fd13c4d5de9908.js",
  "/_next/static/chunks/24146-3a8977781eaa5b82.js",
  "/_next/static/chunks/24258-463e2ef51c80bc96.js",
  "/_next/static/chunks/24366-6101194aa4c1ff3d.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25352-f1c0619d40546587.js",
  "/_next/static/chunks/25760-5a31a6708e5afa36.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/27183-804b337612556fc2.js",
  "/_next/static/chunks/27258-9e289bc9b3bca44e.js",
  "/_next/static/chunks/27294-c67c401ed9858f5b.js",
  "/_next/static/chunks/2783-77fad2163e04908c.js",
  "/_next/static/chunks/29142-b18ac59e3a6c79ea.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31316-48aca5bb34ba504d.js",
  "/_next/static/chunks/31480-993dabee3b2f7ab3.js",
  "/_next/static/chunks/34244-024ad41a6321516b.js",
  "/_next/static/chunks/3509-f60824423c91d525.js",
  "/_next/static/chunks/35925-c3dbe8f5843da83e.js",
  "/_next/static/chunks/363642f4-9c205dcd9aea5ef1.js",
  "/_next/static/chunks/36996-5a51412719734de1.js",
  "/_next/static/chunks/37005-7144c80a4d480360.js",
  "/_next/static/chunks/37553-28669643b9d942b8.js",
  "/_next/static/chunks/38151-a4e44ac7dcb36a27.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/39261-21a61d7e7753b35c.js",
  "/_next/static/chunks/39452-7355e4816ec058ac.js",
  "/_next/static/chunks/39853-4b9e50b84c22b8a5.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/4122-b1cbfec634c8a68d.js",
  "/_next/static/chunks/41238-6735cb85a4b2aa74.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/43197-6002b5f2f37837a7.js",
  "/_next/static/chunks/45001-1d6797dc52d563c5.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-04d89b9120557c53.js",
  "/_next/static/chunks/46693-964286f43e066e11.js",
  "/_next/static/chunks/46788-d02ee9de88899d72.js",
  "/_next/static/chunks/46993-165e9148c90f5cd1.js",
  "/_next/static/chunks/47919-bbaa10033e3a70b9.js",
  "/_next/static/chunks/48725-8197b2f1bf43a4dd.js",
  "/_next/static/chunks/49882-916136963c4a8fbe.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50138-3cad8fc7ef18c99a.js",
  "/_next/static/chunks/50443-0735c720987a05cc.js",
  "/_next/static/chunks/52311-5da5889dc103ae82.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53697-48aca5bb34ba504d.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-0148078f5edea993.js",
  "/_next/static/chunks/54469-9d212910eeb4c719.js",
  "/_next/static/chunks/54817-fd040988c7ffd330.js",
  "/_next/static/chunks/54a60aa6-3462a838c99f10b4.js",
  "/_next/static/chunks/56526-1c84dd5f014ca698.js",
  "/_next/static/chunks/57578-5fe71dae6f68751b.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-7144c80a4d480360.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-a3b268c8bd291b61.js",
  "/_next/static/chunks/61024-462865cae6d50307.js",
  "/_next/static/chunks/61324-55924d488acbefbd.js",
  "/_next/static/chunks/61731-e293384bb7d0a40d.js",
  "/_next/static/chunks/62285-37efeea768198f4c.js",
  "/_next/static/chunks/62310-f7486dea3b363a6d.js",
  "/_next/static/chunks/62675-879acb4890593f12.js",
  "/_next/static/chunks/63-52baec9cf791023d.js",
  "/_next/static/chunks/6335-0326d7ee3f70ce6d.js",
  "/_next/static/chunks/63790-5d51db9e7c6b5dc7.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64543-7005cd150132b513.js",
  "/_next/static/chunks/64558-3a6ea8aa01a50739.js",
  "/_next/static/chunks/64961-72ea4fbe01b4062f.js",
  "/_next/static/chunks/669-35cfb2e73ce5388e.js",
  "/_next/static/chunks/68645-3db87573959f6f2c.js",
  "/_next/static/chunks/68689-50c9dd4e65cbb019.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/68792-28de852e351afda8.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-47d134f2f3cfaaf2.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71186-f46a414155ba122a.js",
  "/_next/static/chunks/71187-698e72dc442e0368.js",
  "/_next/static/chunks/74791-c3f610f8382296e6.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-7a672e61689a21fe.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/78843-2439e8d89633dadd.js",
  "/_next/static/chunks/79297-828feebdccfee949.js",
  "/_next/static/chunks/79564-09d051cc5519e6c8.js",
  "/_next/static/chunks/79928-e8e0f0846c88fc21.js",
  "/_next/static/chunks/80137-a376634f6bee5d4c.js",
  "/_next/static/chunks/805-93484b807a94826d.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/82182-7ccde2b363979852.js",
  "/_next/static/chunks/8317-32b7dc27282c623f.js",
  "/_next/static/chunks/8382-7b8b1b2866055a08.js",
  "/_next/static/chunks/83891-b4f86c63cd4e7209.js",
  "/_next/static/chunks/84584-bdebc5f3eed19e08.js",
  "/_next/static/chunks/84702-8b7a315425403eff.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/85497-1fcc076d52015e75.js",
  "/_next/static/chunks/85630-94cff4daa8ff6dab.js",
  "/_next/static/chunks/86480-63e316d14075849b.js",
  "/_next/static/chunks/86611-44c9438ef951db31.js",
  "/_next/static/chunks/87135-165b64127c326a1c.js",
  "/_next/static/chunks/87342-72ea4fbe01b4062f.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88087-a960b4f754f69975.js",
  "/_next/static/chunks/88470-5899a6a387eefc6a.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-3e557e7186b5ff80.js",
  "/_next/static/chunks/88751-c323f07322c58860.js",
  "/_next/static/chunks/90378-7dab995d33ca3267.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/91445-b1767331c9c271e9.js",
  "/_next/static/chunks/91543-9e260f7b089d417b.js",
  "/_next/static/chunks/91979-b3beba1c376bf9da.js",
  "/_next/static/chunks/92758-2306713be271c488.js",
  "/_next/static/chunks/94997-acc79589214d1318.js",
  "/_next/static/chunks/95125-69d1051d31730985.js",
  "/_next/static/chunks/95858-65c8e079c3083475.js",
  "/_next/static/chunks/97825-4db850dd05bb0e8c.js",
  "/_next/static/chunks/98295-e44b072ccf19a120.js",
  "/_next/static/chunks/98459-48aca5bb34ba504d.js",
  "/_next/static/chunks/98710-fee074466f00c282.js",
  "/_next/static/chunks/98723-28f964e0660e9560.js",
  "/_next/static/chunks/99341-2dc6a1d8766537c1.js",
  "/_next/static/chunks/99579-fd040988c7ffd330.js",
  "/_next/static/chunks/99707-7b43a77a6167bf66.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/(home)/page-6bfc011ba703dca7.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-7af9fa4c9d7c1612.js",
  "/_next/static/chunks/app/[locale]/account/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/account/page-4bd58a1940183ab2.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/achievements/page-f840585e636a9a4a.js",
  "/_next/static/chunks/app/[locale]/admin/announcements/page-7c5ff05a3e2179f0.js",
  "/_next/static/chunks/app/[locale]/admin/auth-monitor/page-6a8bc039b927b908.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-d22f9752a2754dfe.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-bb4787befc84ae49.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-1cf8f39cbf810312.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-76b19468790aaa38.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-dcd68327d482f08a.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-b005910e2e8e7def.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-aaf59ddce636798f.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-7e22408b6d33fae4.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-0ce09bd9f5b605b6.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-a9222c473e186c5f.js",
  "/_next/static/chunks/app/[locale]/admin/content-clicks/page-db3e7a8d6d5bcf0d.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-47b0aefad5b7c8bf.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-474bc5305f75bb2b.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/[id]/edit/page-276e366c356bdd95.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/page-979e0d2d9053af59.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-fe43a7d5acb611bf.js",
  "/_next/static/chunks/app/[locale]/admin/error-35d0343ed147d2ce.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-978d470c7b8ca577.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-9b3d4001d74fa362.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-55ba04116151256f.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-c630316ead495598.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-b3a1d40f2f987a3b.js",
  "/_next/static/chunks/app/[locale]/admin/layout-d3b87f72e9ae049e.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-3ba1927e9d2316c7.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-e50ee7422178e358.js",
  "/_next/static/chunks/app/[locale]/admin/loading-4f780650351d0e4e.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-8cf29ce4baf72d6c.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-ba2352634548b841.js",
  "/_next/static/chunks/app/[locale]/admin/page-145b9b561c318527.js",
  "/_next/static/chunks/app/[locale]/admin/page-visits/page-e260f7e3ec1fb578.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-613add36501766ea.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-b4438599fa1aeab0.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-29a3c55fa30e4b90.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-1f45000e2d82f0cc.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-dd095124a14b9c0e.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-eb6293ea623883e3.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-5423d775cb67396f.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-7425a636fe20f597.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-34476f372dfd08e0.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-6d085a60ce9e8f38.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-76be5d5349b57b4a.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-361e292c04b59115.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-a67e948e3a057fad.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-984afa63fd52fa6c.js",
  "/_next/static/chunks/app/[locale]/admin/village-traffic/page-c517a3c5013e8831.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-9f942272f069d31b.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-db7a4d6747aa3a89.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-9892c48b2a89000d.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-6d6ac6fc9bca37fc.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-70012e68f312ec30.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-1ee8945f15fb95de.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-5c33608ebf11aad3.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-8557bbf15fbfc478.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-5f6ad2d12e9a7114.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-531b661c0447d655.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-80a3eb64a5bbb02b.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-05f404408057e1f7.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-85957346c3445b82.js",
  "/_next/static/chunks/app/[locale]/blog/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/blog/page-b0fa9fcee129f4e3.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-78eb9b9c47008aca.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-30411d167f7ced33.js",
  "/_next/static/chunks/app/[locale]/comics/page-14da51712d0a8767.js",
  "/_next/static/chunks/app/[locale]/contact/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/contact/page-e7e7724156c22e7a.js",
  "/_next/static/chunks/app/[locale]/credits/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/credits/page-294cf2714598f8f0.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-6365f2c804fc93f7.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-f6345b4f67ae4754.js",
  "/_next/static/chunks/app/[locale]/drill/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/drill/page-aec6855742f796cf.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-a084465d7551fad4.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-6014d3c7a221ed14.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-5d59b6f574993ab4.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-4b92bc5ab054039f.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-32564a4909a4f1d2.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-692fa4fa588635d4.js",
  "/_next/static/chunks/app/[locale]/games/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/games/page-7c37fa816532e1c8.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-5b94410498778ce3.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-681fc9adec8f1912.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-12c4619bf534e227.js",
  "/_next/static/chunks/app/[locale]/intro/page-c2178b2d71091287.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-d65f71a69d5cc0be.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-c49e3671209deffc.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-b5270fc2074bbdae.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-d892504e22e1d88d.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-965bc45c91cbc0ee.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-1c33825fb3bb1823.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-c613af5e9fd0adc4.js",
  "/_next/static/chunks/app/[locale]/layout-9e4b43e98bbec788.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-d4715e57053f121a.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-1d1187a87206c286.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-9261676770846f39.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-4ff9de1452b23aad.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-6d6feda43eaf36ae.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-56d34c560257875c.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-47911403110ea3b1.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-255c18789c20818c.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-3f4c3a13b00fb3bf.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-247303e6a3ac489a.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-b7ae2f0a115af861.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-529fa3d40474895b.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-bf7e36874bff3462.js",
  "/_next/static/chunks/app/[locale]/library/page-46c05e3cd3006326.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-1c0d695a7a41ad8f.js",
  "/_next/static/chunks/app/[locale]/lists/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/lists/page-ac443ac0b9e5d187.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-2329e6e19cecefe8.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-220a715c0ce693d5.js",
  "/_next/static/chunks/app/[locale]/news/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/news/page-93b37f8bde3de837.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-4d21d3fffe65c083.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-affbeec2807e8b2c.js",
  "/_next/static/chunks/app/[locale]/not-found-53510fcb53679669.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-c3c8fb06c72fb2a3.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-0a53112be23a97a5.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-891d1b13201adc94.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-6d6feda43eaf36ae.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-9b1716bca434be84.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-4573f28232f8018c.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-0d66dd1974310357.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-9b3253e7f348b271.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/pricing/page-9d80a1273648d778.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/privacy/page-9a894a6e052eb417.js",
  "/_next/static/chunks/app/[locale]/pwa-demo/page-b2ec12b980f07659.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-de01e2c7dad1de34.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-3a44a7bbc81f5085.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-a4077e377228e35b.js",
  "/_next/static/chunks/app/[locale]/resources/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/resources/page-130ab9b49c60fb89.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-7a71be0d80e39734.js",
  "/_next/static/chunks/app/[locale]/review/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/review/page-6d6feda43eaf36ae.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/review/session/page-7171155d410e8fe2.js",
  "/_next/static/chunks/app/[locale]/server-error/page-c2903c8faf7d2fd8.js",
  "/_next/static/chunks/app/[locale]/settings/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/settings/page-43f8d38ff9b742ac.js",
  "/_next/static/chunks/app/[locale]/share/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/share/page-ca9c5f3d155f0ee5.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/showcase/page-2e589c70df0f4174.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/statistics/page-ab3cc2c20c13301e.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-d456b577ffdd78b2.js",
  "/_next/static/chunks/app/[locale]/stories/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/stories/page-11b24296deba6e28.js",
  "/_next/static/chunks/app/[locale]/terms/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/terms/page-4dc442c9f3fac6ff.js",
  "/_next/static/chunks/app/[locale]/test-celebration/page-c26daca77f4c91a3.js",
  "/_next/static/chunks/app/[locale]/test-email/page-ede50d39463ec693.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-9bbd507cf81c14b2.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-cf797cfc7ee75eb5.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-02f73c1d8c80c0dc.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-bb4f84830cf0a0e8.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-dab4734acf45d83a.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-d6f10e034b9640e3.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-b35e280c9c2c4850.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-af030b8c9772e9a4.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-d49a730f04f015e5.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-f62e380581e2ea4c.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-756fac6fba38e768.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-b9fd2a4a9fc144cf.js",
  "/_next/static/chunks/app/[locale]/todos/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/todos/page-568ab45c64d74b13.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/learn/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/learn/page-6d32b4f8abf4055d.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/page-3c150549effdee06.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-899140c40c5e47e6.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-062657d5acd2eea0.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-7b45fcfd14df592c.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-3583641354c13690.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-237516790f9a6f76.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-68a444022bd2ece1.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-6531ccf1f3a7e0e1.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-1c40b672a63f7963.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-37bb2c80632e37bc.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-9864d00d2251339e.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-d7fd94fe99be7bc5.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-e7454b52327c4f10.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-2a04d351972a1b4e.js",
  "/_next/static/chunks/app/_not-found/page-6d6feda43eaf36ae.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-73672720ef2b7d6d.js",
  "/_next/static/chunks/app/error-cb30627d616e4be9.js",
  "/_next/static/chunks/app/global-error-b3ae1aeb789c8237.js",
  "/_next/static/chunks/app/layout-897735cef16f23b1.js",
  "/_next/static/chunks/app/not-found-0a9a3f80b70dcb63.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-app-c35d34a55864b0b5.js",
  "/_next/static/chunks/main-cd55c576c37ced5a.js",
  "/_next/static/chunks/pages/_app-f365312a4d2529fb.js",
  "/_next/static/chunks/pages/_error-ff431fa75c297bd3.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-4369fb1c76693c07.js",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/a6ae4ab4bec43017.css",
  "/_next/static/css/af47b6060c4fddcc.css",
  "/_next/static/css/f9439f5231c96cfe.css",
  "/_next/static/glLKmOIwzig7fkZF_zhap/_buildManifest.js",
  "/_next/static/glLKmOIwzig7fkZF_zhap/_ssgManifest.js"
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

  // Skip cross-origin requests (fonts are now self-hosted)
  if (url.origin !== self.location.origin) {
    // Only allow cross-origin image requests
    if (!isImageRequest) {
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
