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

const CACHE_VERSION = 'moshimoshi-b7493497b024';
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
  "/_next/static/R7wF6TLXYhb1XStLfxf_h/_buildManifest.js",
  "/_next/static/R7wF6TLXYhb1XStLfxf_h/_ssgManifest.js",
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-58c9f3a9ad081a09.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/11576-f99f32e1774d806b.js",
  "/_next/static/chunks/11912-bbd0e5a0d742e33b.js",
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
  "/_next/static/chunks/24455-b4ed182a0c6a84fd.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25352-f1c0619d40546587.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/27183-804b337612556fc2.js",
  "/_next/static/chunks/27258-9e289bc9b3bca44e.js",
  "/_next/static/chunks/27294-7b03e3fefc628190.js",
  "/_next/static/chunks/2783-77fad2163e04908c.js",
  "/_next/static/chunks/29142-b18ac59e3a6c79ea.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31316-48aca5bb34ba504d.js",
  "/_next/static/chunks/31480-993dabee3b2f7ab3.js",
  "/_next/static/chunks/34244-987503fa1199c62f.js",
  "/_next/static/chunks/34541-2f5c7588ee515891.js",
  "/_next/static/chunks/3509-f60824423c91d525.js",
  "/_next/static/chunks/35925-c3dbe8f5843da83e.js",
  "/_next/static/chunks/363642f4-9c205dcd9aea5ef1.js",
  "/_next/static/chunks/36996-5a51412719734de1.js",
  "/_next/static/chunks/37005-7144c80a4d480360.js",
  "/_next/static/chunks/37553-5978985ec3df7e66.js",
  "/_next/static/chunks/38151-a4e44ac7dcb36a27.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/39261-21a61d7e7753b35c.js",
  "/_next/static/chunks/39452-2cca46b2414333c0.js",
  "/_next/static/chunks/39853-4b9e50b84c22b8a5.js",
  "/_next/static/chunks/40031-a7b02704f8a66d36.js",
  "/_next/static/chunks/41238-6735cb85a4b2aa74.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/43197-6002b5f2f37837a7.js",
  "/_next/static/chunks/44425-e5446feac5eb7d2e.js",
  "/_next/static/chunks/45001-1d6797dc52d563c5.js",
  "/_next/static/chunks/45060-e71ceccbd543ae30.js",
  "/_next/static/chunks/45664-3310b769e61b8961.js",
  "/_next/static/chunks/4586-04d89b9120557c53.js",
  "/_next/static/chunks/46693-964286f43e066e11.js",
  "/_next/static/chunks/46788-d02ee9de88899d72.js",
  "/_next/static/chunks/46993-9c2fe4ffb6f60500.js",
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
  "/_next/static/chunks/56526-1db7c54a84e96d82.js",
  "/_next/static/chunks/57578-5fe71dae6f68751b.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-7144c80a4d480360.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-a3b268c8bd291b61.js",
  "/_next/static/chunks/60216-66469c4b38ef3fc5.js",
  "/_next/static/chunks/61024-462865cae6d50307.js",
  "/_next/static/chunks/61324-55924d488acbefbd.js",
  "/_next/static/chunks/61731-e293384bb7d0a40d.js",
  "/_next/static/chunks/62285-37efeea768198f4c.js",
  "/_next/static/chunks/62310-f7486dea3b363a6d.js",
  "/_next/static/chunks/62675-229e2feae50db795.js",
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
  "/_next/static/chunks/74791-c3f610f8382296e6.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-7a672e61689a21fe.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76004-3e80144ef1089623.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/78843-2439e8d89633dadd.js",
  "/_next/static/chunks/79297-828feebdccfee949.js",
  "/_next/static/chunks/79564-09d051cc5519e6c8.js",
  "/_next/static/chunks/80137-a376634f6bee5d4c.js",
  "/_next/static/chunks/805-93484b807a94826d.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/82182-6d3fe5fd065dcf8e.js",
  "/_next/static/chunks/8317-32b7dc27282c623f.js",
  "/_next/static/chunks/8382-7b8b1b2866055a08.js",
  "/_next/static/chunks/83891-b4f86c63cd4e7209.js",
  "/_next/static/chunks/84584-bdebc5f3eed19e08.js",
  "/_next/static/chunks/84702-8b7a315425403eff.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/86480-f83f0d2f380c9001.js",
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
  "/_next/static/chunks/94997-a8f9f0387f3cd189.js",
  "/_next/static/chunks/95125-69d1051d31730985.js",
  "/_next/static/chunks/95498-9f77e7b9c5825182.js",
  "/_next/static/chunks/95858-65c8e079c3083475.js",
  "/_next/static/chunks/9694-664593c28f04f59d.js",
  "/_next/static/chunks/97825-4db850dd05bb0e8c.js",
  "/_next/static/chunks/98295-0c6d0c8de171ec7d.js",
  "/_next/static/chunks/98459-48aca5bb34ba504d.js",
  "/_next/static/chunks/98710-fee074466f00c282.js",
  "/_next/static/chunks/98723-c8e4afc018a43cad.js",
  "/_next/static/chunks/99341-2dc6a1d8766537c1.js",
  "/_next/static/chunks/99579-fd040988c7ffd330.js",
  "/_next/static/chunks/99707-94ec089499617d41.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/(home)/page-34b4babc082f17ec.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-ecdd1ff8ef481565.js",
  "/_next/static/chunks/app/[locale]/account/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/account/page-372c95f40871a796.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/achievements/page-8f818bb8b62eb737.js",
  "/_next/static/chunks/app/[locale]/admin/announcements/page-e44d88e318668ea7.js",
  "/_next/static/chunks/app/[locale]/admin/auth-monitor/page-7b7271214a5d4a64.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-0a23dc89a75d8b41.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-eb98ffacab59724a.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-50c37d2852fe3b88.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-6804468bee541474.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-5d457ceeb352deff.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-d683c90e6438b454.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-e69d0f66230caeef.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-6eda5e878765e837.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-412f7eb5e0b68bc9.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-bce8e06664434317.js",
  "/_next/static/chunks/app/[locale]/admin/content-clicks/page-b3f50e1b98697b1b.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-d7baaf19ce686406.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-f6c8dc6f96c41c19.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/[id]/edit/page-af8533aeb3f83c8c.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/page-0467775ab6f0e95e.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-ed297a748f07693a.js",
  "/_next/static/chunks/app/[locale]/admin/error-455f08996d41e1b4.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-ec26f99a80d6cf04.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-0148a8ad39a29ba3.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-95b52ecfdd6cb61f.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-783a50af9483a6f9.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-364bb2c6d8a3f6a4.js",
  "/_next/static/chunks/app/[locale]/admin/layout-cb58faac04353192.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-1791a3924fd23464.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-b108ffba525af50d.js",
  "/_next/static/chunks/app/[locale]/admin/loading-1869e5704d64b494.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-47c9ace0dd9c21d3.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-696dba3b0b2d15b6.js",
  "/_next/static/chunks/app/[locale]/admin/page-f2969db061f8a233.js",
  "/_next/static/chunks/app/[locale]/admin/page-visits/page-52d1f6c584f85726.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-2b552e52a6202ec4.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-636444105dc5a98a.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-a6ecd98f865329d5.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-8dba05bfa3ca3a62.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-395389e8e815a5b3.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-ff60f7c1e1bc0205.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-02e680fc81ebb26c.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-572abd5c717af3a3.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-0677bd843cece27f.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-055ed0ec9078df70.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-a3f8f4905f214af1.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-5f3fea9790b32bea.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-6c2e2b748b69f2f2.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-3f566b321218cc5e.js",
  "/_next/static/chunks/app/[locale]/admin/village-traffic/page-170e049106db4a78.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-5a7f1270c42b226b.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-2fefccbb5c779ef6.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-247c3034df475d52.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-ffe63fedc772cc5c.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-8ba40b742427697e.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-6d9c74d60f03be5a.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-ea51cd5118ba68ee.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-2e7e62fd910f77c5.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-51b55f4123af960e.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-e8f5925d11f3cb40.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-6730d241c7ab494e.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-339b1ff3a50cfdbd.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-b00a925226b9f09d.js",
  "/_next/static/chunks/app/[locale]/blog/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/blog/page-7e0740fa115d4644.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-07ba823f2cd0cefc.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-cd26586779938cc1.js",
  "/_next/static/chunks/app/[locale]/comics/page-d1c9d0d1a984ad7a.js",
  "/_next/static/chunks/app/[locale]/contact/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/contact/page-b046c3c2f84a12dc.js",
  "/_next/static/chunks/app/[locale]/credits/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/credits/page-eeb8a71a1ca73a29.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-809ef4bc9bc8d514.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-e9e92a9654b37b5f.js",
  "/_next/static/chunks/app/[locale]/drill/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/drill/page-573671e8689f94f3.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-6402c05639e0ed97.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-d8f16f0a903026ab.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-db29287ef10c5da4.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-17c4394b065b0f6b.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-5e39627b6c252be2.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-48ab342e54bda116.js",
  "/_next/static/chunks/app/[locale]/games/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/games/page-fe81e9cd6e62fc56.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-de3032445ad328bc.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-07434c069f86e800.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-25232013e1ab0b14.js",
  "/_next/static/chunks/app/[locale]/intro/page-fd70941140f7b624.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-6b288ad543ba1c83.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-c211f9730b1f43e8.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-5598e6d5fb9c0764.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-4a6c0e9ab2d75001.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-61005eeeba0d75a6.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-3918cf0d84b9face.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-f7f0b89bf601470f.js",
  "/_next/static/chunks/app/[locale]/layout-f3d7b62029a49840.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-948c612c93aec17d.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-f6b92cdbe2c444b7.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-7ceb586e6ce5d2ec.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-8a64bf522dfe1fbb.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-ca3f3a7256745fca.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-98adbbb121a17301.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-125529244f647b14.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/practice/n4/page-fedbd98cdb7a68d6.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/practice/page-181506a1191af91d.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-b619c5329764a1fe.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-e94fd2eb2d9419ce.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-2b133da0b76c9b23.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-85c040f9476173ec.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-1baeec15689c2d4d.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-65cd9cf8486646d5.js",
  "/_next/static/chunks/app/[locale]/library/page-2ff21e2e1f445eeb.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-b3e742d361eaf115.js",
  "/_next/static/chunks/app/[locale]/lists/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/lists/page-e9ffdb4203dc25d5.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-8292749c4eafd07c.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-b7e7341719191f05.js",
  "/_next/static/chunks/app/[locale]/news/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/news/page-4e1f72d67c9f17f6.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-53227ced1fa640bf.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-54d3ededa4738f8c.js",
  "/_next/static/chunks/app/[locale]/not-found-674171dccf311962.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-0f28842fa29a12cb.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-f4e73e557b9c54b3.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-a949d70060f8b70f.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-ca3f3a7256745fca.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-4251b4ef843704a3.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-4ecdf73908db4e9c.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-215da1907dffbe68.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-d6b43ceb6263cd82.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/pricing/page-b9616ae1bb7e1866.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/privacy/page-c3e616e08644ee5a.js",
  "/_next/static/chunks/app/[locale]/pwa-demo/page-da44a081074f453c.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-bebbc9df85ff1557.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-1ee67711ca1edcd2.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-87396f8b05695763.js",
  "/_next/static/chunks/app/[locale]/resources/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/resources/page-eaddf8649cd978a3.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-9440468e0358ed2c.js",
  "/_next/static/chunks/app/[locale]/review/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/review/page-ca3f3a7256745fca.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/review/session/page-09282865501c18e3.js",
  "/_next/static/chunks/app/[locale]/server-error/page-4292fc98dd6f2000.js",
  "/_next/static/chunks/app/[locale]/settings/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/settings/page-8d848b113d3b0c71.js",
  "/_next/static/chunks/app/[locale]/share/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/share/page-f4ac935133f0e2c2.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/showcase/page-45a1c994e7a0c73c.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/statistics/page-d66c19fab695a0ba.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-017d5838da4cbb73.js",
  "/_next/static/chunks/app/[locale]/stories/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/stories/page-856efd90d228067c.js",
  "/_next/static/chunks/app/[locale]/terms/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/terms/page-78d44832aee083d2.js",
  "/_next/static/chunks/app/[locale]/test-celebration/page-7c539ea591b4e197.js",
  "/_next/static/chunks/app/[locale]/test-email/page-9ebec031dd637565.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-9ca63ccae25fe851.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-2a5e1765ec2ccc60.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-b3e89c27854ffae7.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-b954936a69af7091.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-03ac1fba82f19a20.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-9d7881475080a82a.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-125b3290da6bfd10.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-f98d073cd6956c04.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-2f1e88d0dd26ba43.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-d3d66c54c1530121.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-bae5be1343f8fadc.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-dec6231211354865.js",
  "/_next/static/chunks/app/[locale]/todos/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/todos/page-7e0a028c172df861.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/learn/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/learn/page-2ff9478f6af02452.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/page-c72490e92fa78a82.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-77fdf3a55175bc75.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-42c0e67c4e66192c.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-3619b77442ada033.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-73d7cd0c25828343.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-71b7b370edbcfb74.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-530681d1e64d7d08.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-ccbac75b4c1086ec.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-9f10dacb08b2d15f.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-85750f0ba1cc06f2.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-b3d66fef802f11a2.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-b3fa6e9a9ee80e4b.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-065b87ca08bf9ead.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-19c999afad1dd74a.js",
  "/_next/static/chunks/app/_not-found/page-ca3f3a7256745fca.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-97bc3744a71cb6b6.js",
  "/_next/static/chunks/app/error-f5efda31a85c8065.js",
  "/_next/static/chunks/app/global-error-18b3a192f0f21df3.js",
  "/_next/static/chunks/app/layout-8b3721fe4ded7abd.js",
  "/_next/static/chunks/app/not-found-94d7f5b58d90591a.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-5075e6225560ce76.js",
  "/_next/static/chunks/main-app-bdbfafa6c592b486.js",
  "/_next/static/chunks/pages/_app-e564eff480095266.js",
  "/_next/static/chunks/pages/_error-a67830c81dc5db36.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-d97eb233c5245d5b.js",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/a6ae4ab4bec43017.css",
  "/_next/static/css/af47b6060c4fddcc.css",
  "/_next/static/css/cfea14d04fa7ebde.css"
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
