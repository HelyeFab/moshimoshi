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

const CACHE_VERSION = 'moshimoshi-79aabc9e043f';
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
  "/_next/static/2Pm4OcsSTNXRG8MYly5qp/_buildManifest.js",
  "/_next/static/2Pm4OcsSTNXRG8MYly5qp/_ssgManifest.js",
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-58c9f3a9ad081a09.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/11326-09db94cbf0d817d7.js",
  "/_next/static/chunks/11576-f99f32e1774d806b.js",
  "/_next/static/chunks/1179-b0f0a243f5df38d3.js",
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
  "/_next/static/chunks/17377-846c8e34c63e73f8.js",
  "/_next/static/chunks/1765-3a8977781eaa5b82.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/19645-011a9308359fc870.js",
  "/_next/static/chunks/20756-8bee72c6e578e6c8.js",
  "/_next/static/chunks/20840-48aca5bb34ba504d.js",
  "/_next/static/chunks/21544-e005b466da6197bb.js",
  "/_next/static/chunks/21960-fd040988c7ffd330.js",
  "/_next/static/chunks/22530-4c53baaeda98506e.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-7b8b1b2866055a08.js",
  "/_next/static/chunks/23560-b0f0a243f5df38d3.js",
  "/_next/static/chunks/23868-20854aed872efc80.js",
  "/_next/static/chunks/23930-97fd13c4d5de9908.js",
  "/_next/static/chunks/24146-3a8977781eaa5b82.js",
  "/_next/static/chunks/24241-ee23bc4b22442260.js",
  "/_next/static/chunks/24258-d0de231e1f2cde7e.js",
  "/_next/static/chunks/24366-6101194aa4c1ff3d.js",
  "/_next/static/chunks/24859-a52712c769090be8.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25352-f1c0619d40546587.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/27183-804b337612556fc2.js",
  "/_next/static/chunks/27258-9e289bc9b3bca44e.js",
  "/_next/static/chunks/27294-7b03e3fefc628190.js",
  "/_next/static/chunks/2783-77fad2163e04908c.js",
  "/_next/static/chunks/28428-2fad94736edc9095.js",
  "/_next/static/chunks/29142-b18ac59e3a6c79ea.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31316-48aca5bb34ba504d.js",
  "/_next/static/chunks/31480-993dabee3b2f7ab3.js",
  "/_next/static/chunks/31969-94a099da08446f57.js",
  "/_next/static/chunks/34244-987503fa1199c62f.js",
  "/_next/static/chunks/34535-e8d8504fc3b3cc85.js",
  "/_next/static/chunks/3509-f60824423c91d525.js",
  "/_next/static/chunks/35478-58fd1683e71477a3.js",
  "/_next/static/chunks/35925-c3dbe8f5843da83e.js",
  "/_next/static/chunks/36216-838c070c7bceef1f.js",
  "/_next/static/chunks/363642f4-9c205dcd9aea5ef1.js",
  "/_next/static/chunks/36824-3a7d2a0acf088dd0.js",
  "/_next/static/chunks/36996-5a51412719734de1.js",
  "/_next/static/chunks/37005-7144c80a4d480360.js",
  "/_next/static/chunks/38017-899171e94105364f.js",
  "/_next/static/chunks/38151-36542da3c9f0f3d2.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/39452-2cca46b2414333c0.js",
  "/_next/static/chunks/39853-4b9e50b84c22b8a5.js",
  "/_next/static/chunks/40031-a7b02704f8a66d36.js",
  "/_next/static/chunks/41238-6735cb85a4b2aa74.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/43197-6002b5f2f37837a7.js",
  "/_next/static/chunks/44425-c87bf1d4539198ea.js",
  "/_next/static/chunks/44955-76126d2da7c11983.js",
  "/_next/static/chunks/45001-1d6797dc52d563c5.js",
  "/_next/static/chunks/45060-e71ceccbd543ae30.js",
  "/_next/static/chunks/45664-3310b769e61b8961.js",
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
  "/_next/static/chunks/53807-9f7cd73217735cff.js",
  "/_next/static/chunks/54469-9d212910eeb4c719.js",
  "/_next/static/chunks/54817-fd040988c7ffd330.js",
  "/_next/static/chunks/54a60aa6-3462a838c99f10b4.js",
  "/_next/static/chunks/56417-b0f0a243f5df38d3.js",
  "/_next/static/chunks/56526-c3cc7ebb516d5e1c.js",
  "/_next/static/chunks/57578-5fe71dae6f68751b.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-7144c80a4d480360.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-a3b268c8bd291b61.js",
  "/_next/static/chunks/60216-66469c4b38ef3fc5.js",
  "/_next/static/chunks/61324-55924d488acbefbd.js",
  "/_next/static/chunks/61731-e293384bb7d0a40d.js",
  "/_next/static/chunks/6183-6c8c8d9397e66010.js",
  "/_next/static/chunks/62285-37efeea768198f4c.js",
  "/_next/static/chunks/62310-f7486dea3b363a6d.js",
  "/_next/static/chunks/62675-060557c94957ab84.js",
  "/_next/static/chunks/63-52baec9cf791023d.js",
  "/_next/static/chunks/6335-0326d7ee3f70ce6d.js",
  "/_next/static/chunks/63790-5d51db9e7c6b5dc7.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64543-7005cd150132b513.js",
  "/_next/static/chunks/64558-3a6ea8aa01a50739.js",
  "/_next/static/chunks/64804-4db9bcf871880962.js",
  "/_next/static/chunks/64961-72ea4fbe01b4062f.js",
  "/_next/static/chunks/68645-3db87573959f6f2c.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/68792-28de852e351afda8.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-47d134f2f3cfaaf2.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/73025-16e76caf8c5f66f0.js",
  "/_next/static/chunks/74791-c3f610f8382296e6.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-7a672e61689a21fe.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76004-3e80144ef1089623.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/77927-b14ff9c56c7bd81f.js",
  "/_next/static/chunks/78843-2439e8d89633dadd.js",
  "/_next/static/chunks/79297-828feebdccfee949.js",
  "/_next/static/chunks/805-93484b807a94826d.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/82182-8ba4b0897214b836.js",
  "/_next/static/chunks/8317-32b7dc27282c623f.js",
  "/_next/static/chunks/8382-7b8b1b2866055a08.js",
  "/_next/static/chunks/83827-f813af0ad983e124.js",
  "/_next/static/chunks/83891-b4f86c63cd4e7209.js",
  "/_next/static/chunks/84584-bdebc5f3eed19e08.js",
  "/_next/static/chunks/84702-8b7a315425403eff.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/87135-165b64127c326a1c.js",
  "/_next/static/chunks/87342-72ea4fbe01b4062f.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88087-a960b4f754f69975.js",
  "/_next/static/chunks/88470-5f292ccd43cbb038.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-3e557e7186b5ff80.js",
  "/_next/static/chunks/88751-c323f07322c58860.js",
  "/_next/static/chunks/90378-7dab995d33ca3267.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/91543-9e260f7b089d417b.js",
  "/_next/static/chunks/91979-b3beba1c376bf9da.js",
  "/_next/static/chunks/92758-2306713be271c488.js",
  "/_next/static/chunks/94483-16bac38184a0fc77.js",
  "/_next/static/chunks/94997-ee8df41a5e398c0c.js",
  "/_next/static/chunks/95125-69d1051d31730985.js",
  "/_next/static/chunks/95498-9f77e7b9c5825182.js",
  "/_next/static/chunks/95858-65c8e079c3083475.js",
  "/_next/static/chunks/9694-4bb40b3d15505c50.js",
  "/_next/static/chunks/97825-4db850dd05bb0e8c.js",
  "/_next/static/chunks/98295-0c6d0c8de171ec7d.js",
  "/_next/static/chunks/98459-48aca5bb34ba504d.js",
  "/_next/static/chunks/98710-fee074466f00c282.js",
  "/_next/static/chunks/98723-2225957839473fe3.js",
  "/_next/static/chunks/99341-2dc6a1d8766537c1.js",
  "/_next/static/chunks/99579-fd040988c7ffd330.js",
  "/_next/static/chunks/99707-94ec089499617d41.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/(home)/page-b28f983ec0e17191.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-7fb79f90a59161e4.js",
  "/_next/static/chunks/app/[locale]/account/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/account/page-87782e69abd65f77.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/achievements/page-c0ef57da215b90fe.js",
  "/_next/static/chunks/app/[locale]/admin/announcements/page-ef31afd68e95e955.js",
  "/_next/static/chunks/app/[locale]/admin/auth-monitor/page-8198624b923e5f8c.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-df0d079e7c854938.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-bbc64b3a0a62d24f.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-8123850c76014919.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-7dcf4c2b2f288685.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-9109fbb1cac32bc4.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-1545c1ff3913a307.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-8622a67b74c0a28a.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-9a9f85ee8f17278a.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-a499e7f927a8e684.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-22f3257b4e1cc581.js",
  "/_next/static/chunks/app/[locale]/admin/content-clicks/page-4df4329ef668a1e3.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-2fe14a7b37c2d0f8.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/[deckId]/page-c5616147eec8463b.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/error-6819c135d6a91dab.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/loading-4655ba9eddb8ad12.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/new/page-b4846cf117b3a62c.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/notes/[noteId]/page-b07ac10c4929a988.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/notes/new/page-9ede58eaea663891.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/notes/page-4901fdcc1d44921a.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/page-59b99ad52544c6c8.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-da84d1312a7d31a0.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/[id]/edit/page-fb059927c4b38136.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/page-f111858c46337c8f.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-b314b088dbcba9fd.js",
  "/_next/static/chunks/app/[locale]/admin/error-2b7cd7d12656da42.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-1c139bd1d49d69e8.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-3aefcba017af5757.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-89998f3529c58356.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-7192735bf79480fe.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-9e0bb67a34c4ea67.js",
  "/_next/static/chunks/app/[locale]/admin/layout-45910fc6007106e7.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-0e262ca8c73c2553.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-d42e116b06482853.js",
  "/_next/static/chunks/app/[locale]/admin/loading-d5314f55ec8cd967.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-bff90f43e39f31e8.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-d09d8722062b0331.js",
  "/_next/static/chunks/app/[locale]/admin/page-f9f1016ea2a88899.js",
  "/_next/static/chunks/app/[locale]/admin/page-visits/page-6fba3a237bce8e4c.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-b6b48ebbf6440e39.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-bc3c4e22dd35e2b4.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-89ba7858f1861b82.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-180d9049a9ef6774.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-eeae25dddd57ab2a.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-58abecccee6560bc.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-41220de3d41c1bae.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-05c17f8d15870c3e.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-4a6da68162da6df8.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-895117bf4770a89e.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-402189f614f1a98a.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-3d50d51ffb2ac8d0.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-6665d94c5e11533b.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-91f9b345118bcf98.js",
  "/_next/static/chunks/app/[locale]/admin/village-traffic/page-4dceb180c9051fe0.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-03288aab73119e1a.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-5cd3f28e3451d561.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-4b0a010678140055.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-82664e3b39246866.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-cc995fe7e65d67d1.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-833142f96ecdda8d.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-edf3a87b9ec1ef78.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-ef35bfb7bbda8f6d.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-123214fd01b7a82f.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-63fb6f10f7c0b264.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-2e5be28b2de6f7e9.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-04a00e66d8b3d7fb.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-72667f4804ea6913.js",
  "/_next/static/chunks/app/[locale]/blog/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/blog/page-11ab61c5b62106c8.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-2e4a72aea6555d3d.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-f99db80351e5dfdd.js",
  "/_next/static/chunks/app/[locale]/comics/page-0d54838771d5aff6.js",
  "/_next/static/chunks/app/[locale]/contact/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/contact/page-2214d1f9047b97e4.js",
  "/_next/static/chunks/app/[locale]/credits/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/credits/page-5f51051f9f83dcf1.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-ac9ed54ede55d134.js",
  "/_next/static/chunks/app/[locale]/deckmarket/[deckId]/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/deckmarket/[deckId]/page-a290f25f9c8eca64.js",
  "/_next/static/chunks/app/[locale]/deckmarket/error-67c5d2b075a5ee8d.js",
  "/_next/static/chunks/app/[locale]/deckmarket/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/deckmarket/loading-4655ba9eddb8ad12.js",
  "/_next/static/chunks/app/[locale]/deckmarket/notes/[noteId]/page-3e416ebcec536a5c.js",
  "/_next/static/chunks/app/[locale]/deckmarket/page-9a22d7f9fe391f89.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-b13f04ff10069ef0.js",
  "/_next/static/chunks/app/[locale]/drill/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/drill/page-8653b556f56ef8a9.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-5a84b4ba052384b1.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-f54dcb0167a1db58.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-89005a50571ecabe.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-d4cefbd08eef0c85.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-4b244c93c097ac74.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-2e8bef263fb44172.js",
  "/_next/static/chunks/app/[locale]/games/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/games/page-3a768394bf658bd9.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-f9f304251387e536.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-ac24585a752c6e7a.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-921d16eec282c5ad.js",
  "/_next/static/chunks/app/[locale]/intro/page-77450f402ead6cf4.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-daf119f6df5b8bd1.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-81317aa94577dbe2.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-63499cf22c0f0b7b.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-5a4862f98fe3b7f9.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-67b93e538cf29862.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-79cb23070ec3f659.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-cb0dd903b55a70a6.js",
  "/_next/static/chunks/app/[locale]/layout-29526f58d78c4745.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-5476828b0b6dbdba.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-5d36ab7aea9280e3.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-f909ed3e6facff37.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-b7bbf3c5ec6ab5d0.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-4655ba9eddb8ad12.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-acf20a0b388e34ae.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-30d1f2a62d6826a1.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/practice/n4/page-23807a57411b8deb.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/practice/page-239ab3e50d2b1f83.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-3fbb35cb4118e73d.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-e6ac004d7a1f1cd9.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-37623d3630efeef4.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-47855cc5bb326da3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-37330f5e3b503305.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-7d3d1b9e037c4c21.js",
  "/_next/static/chunks/app/[locale]/library/page-e74809ac8c4a05a0.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-f1852e29310f34cd.js",
  "/_next/static/chunks/app/[locale]/lists/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/lists/page-7be0a7d3e67a27e2.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-c41f38145ed9d0e1.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-2452108045963ca7.js",
  "/_next/static/chunks/app/[locale]/news/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/news/page-bc8fc24e00a79fd5.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-684e6580db4f5e1d.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-18a1c69f3c84d067.js",
  "/_next/static/chunks/app/[locale]/not-found-740e49294d6f50d4.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-4a21a4db30824c68.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-f74d48266ccb71dd.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-d76c4f04b086a241.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-4655ba9eddb8ad12.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-1613f4d24cf66ca5.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-038717b429979abc.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-6452a48e27860acc.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-4e2017455f483931.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/pricing/page-2eb765b9bdfe9c2e.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/privacy/page-3ceb882451300f82.js",
  "/_next/static/chunks/app/[locale]/pwa-demo/page-b6872b7aaa954cf5.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-9c15cd9b2afcee10.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-916559009c4fa19e.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-285075f11768d75d.js",
  "/_next/static/chunks/app/[locale]/resources/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/resources/page-67dc432552bf418e.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-511a0c6716be557c.js",
  "/_next/static/chunks/app/[locale]/review/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/review/page-4655ba9eddb8ad12.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/review/session/page-220875ed649d9cda.js",
  "/_next/static/chunks/app/[locale]/server-error/page-0f5acd04cb70a1bc.js",
  "/_next/static/chunks/app/[locale]/settings/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/settings/page-6bdde7f2df6fbbf4.js",
  "/_next/static/chunks/app/[locale]/share/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/share/page-4a67a98e1b27fc9b.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/showcase/page-32732b8b688fa3eb.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/statistics/page-215a8549a9350bca.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-658b02b921ab206f.js",
  "/_next/static/chunks/app/[locale]/stories/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/stories/page-9e37664db03d2732.js",
  "/_next/static/chunks/app/[locale]/terms/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/terms/page-3549a8df0775e06e.js",
  "/_next/static/chunks/app/[locale]/test-celebration/page-4ed1dfdaf26d23e2.js",
  "/_next/static/chunks/app/[locale]/test-email/page-0bbdd2990e3e9c4a.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-191e812539a26438.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-129bbc97b9135bbb.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-4a99bf26591a05f6.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-51bf625be8c7353f.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-958efa4a77104356.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-4b200b5c37265b8a.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-3974405bb8e05825.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-112b1f7c91105a38.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-a000653d7af8327c.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-3768f660d7c89468.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-50718a02191d9198.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-f8ce8368061596f1.js",
  "/_next/static/chunks/app/[locale]/todos/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/todos/page-bc712df00c67f807.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/learn/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/learn/page-8061de3e139cbd73.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/page-656309a1d9065eb5.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-ebda2997b6e86dcc.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-119c80f4b4c10611.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-d31ddbc4809fc229.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-bb4e8fd842c3b09b.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-348040312d69f5ca.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-fd3b22fb32525c6f.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-598665602754582a.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-d452d415b5255642.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-731139c7a3de094d.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-2e2642255451fc74.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-7187a609fd0eb464.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-e9e93df7144f90f4.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-be45605ed9e50940.js",
  "/_next/static/chunks/app/_not-found/page-4655ba9eddb8ad12.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-1bdae8413011b4c3.js",
  "/_next/static/chunks/app/error-2c3f7b34137f1d81.js",
  "/_next/static/chunks/app/global-error-1851468b3bc397d6.js",
  "/_next/static/chunks/app/layout-269279cccd49dfe2.js",
  "/_next/static/chunks/app/not-found-cdb7a658bd7e9e72.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-app-8c1a3b4cf760b4a0.js",
  "/_next/static/chunks/main-cd55c576c37ced5a.js",
  "/_next/static/chunks/pages/_app-f365312a4d2529fb.js",
  "/_next/static/chunks/pages/_error-ff431fa75c297bd3.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-f8af7bd745c98fa6.js",
  "/_next/static/css/196aec2dddf02260.css",
  "/_next/static/css/a6ae4ab4bec43017.css",
  "/_next/static/css/af47b6060c4fddcc.css",
  "/_next/static/css/b18c1cd31eb00404.css"
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
