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

const CACHE_VERSION = 'moshimoshi-53b98b61828b';
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
  "/_next/static/7Q-hU9AeUpDvKx9eRA8tw/_buildManifest.js",
  "/_next/static/7Q-hU9AeUpDvKx9eRA8tw/_ssgManifest.js",
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/10409-58c9f3a9ad081a09.js",
  "/_next/static/chunks/1084-9e43dba61dfbf31a.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/11326-09db94cbf0d817d7.js",
  "/_next/static/chunks/11576-f99f32e1774d806b.js",
  "/_next/static/chunks/1179-b0f0a243f5df38d3.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/13585-6ec55d864ea5139f.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14673-e7741737d0d4eb68.js",
  "/_next/static/chunks/14777-1fb0b5e4dbe5bfe6.js",
  "/_next/static/chunks/15130-70bc75fbeab6b06a.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/15441-51bc4a5e3b6bcfca.js",
  "/_next/static/chunks/16287-60441fd658c35ac4.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/1673-8f625db55ae992b4.js",
  "/_next/static/chunks/17377-846c8e34c63e73f8.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/19645-92331487d10fc902.js",
  "/_next/static/chunks/20756-8bee72c6e578e6c8.js",
  "/_next/static/chunks/20840-48aca5bb34ba504d.js",
  "/_next/static/chunks/21163-63d1ff005fcfca9e.js",
  "/_next/static/chunks/21544-e005b466da6197bb.js",
  "/_next/static/chunks/22129-92860cc1a7cafb4f.js",
  "/_next/static/chunks/22530-750e84c0348f2674.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23092-cc9687cd1412b875.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-7b8b1b2866055a08.js",
  "/_next/static/chunks/23560-b0f0a243f5df38d3.js",
  "/_next/static/chunks/23868-20854aed872efc80.js",
  "/_next/static/chunks/23930-97fd13c4d5de9908.js",
  "/_next/static/chunks/24366-6101194aa4c1ff3d.js",
  "/_next/static/chunks/24859-a52712c769090be8.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25352-f1c0619d40546587.js",
  "/_next/static/chunks/25398-c6dd9c5d0d36ce26.js",
  "/_next/static/chunks/25615-06cf6e632f446efe.js",
  "/_next/static/chunks/26020-5c69affefdb35fe7.js",
  "/_next/static/chunks/26600-282ca69924b1f911.js",
  "/_next/static/chunks/26621-97b00c233b6bd22e.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/27183-804b337612556fc2.js",
  "/_next/static/chunks/27258-9e289bc9b3bca44e.js",
  "/_next/static/chunks/27760-af09c346de0a9ee9.js",
  "/_next/static/chunks/2783-77fad2163e04908c.js",
  "/_next/static/chunks/28428-926511f4f69c03ae.js",
  "/_next/static/chunks/29081-77cc99fd574117e2.js",
  "/_next/static/chunks/29142-b18ac59e3a6c79ea.js",
  "/_next/static/chunks/30297-535abb3b06f10795.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31316-48aca5bb34ba504d.js",
  "/_next/static/chunks/31969-662866b39ad737e5.js",
  "/_next/static/chunks/32584-3a6353913498eee2.js",
  "/_next/static/chunks/34244-61dc5b8b015e94db.js",
  "/_next/static/chunks/34535-e8d8504fc3b3cc85.js",
  "/_next/static/chunks/3509-f60824423c91d525.js",
  "/_next/static/chunks/35478-58fd1683e71477a3.js",
  "/_next/static/chunks/36110-3fb5b1602300d670.js",
  "/_next/static/chunks/363642f4-9c205dcd9aea5ef1.js",
  "/_next/static/chunks/36824-b80e5456f35289dc.js",
  "/_next/static/chunks/37005-7144c80a4d480360.js",
  "/_next/static/chunks/38017-4e290a540f7cb444.js",
  "/_next/static/chunks/38151-7a4d9e006058f352.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/39853-4b9e50b84c22b8a5.js",
  "/_next/static/chunks/40031-a7b02704f8a66d36.js",
  "/_next/static/chunks/40924-73d9b8d533350c57.js",
  "/_next/static/chunks/41238-6735cb85a4b2aa74.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/41964-13d980efeeb95316.js",
  "/_next/static/chunks/41989-7fadaed345b18d9d.js",
  "/_next/static/chunks/43197-2db949b830e131fc.js",
  "/_next/static/chunks/43544-63d1ff005fcfca9e.js",
  "/_next/static/chunks/44955-76126d2da7c11983.js",
  "/_next/static/chunks/45060-e71ceccbd543ae30.js",
  "/_next/static/chunks/45664-3310b769e61b8961.js",
  "/_next/static/chunks/46788-92e7185b13a141c8.js",
  "/_next/static/chunks/46980-f849b2b20e5c6b9c.js",
  "/_next/static/chunks/46993-165e9148c90f5cd1.js",
  "/_next/static/chunks/47889-82a4c2f3df3cabdc.js",
  "/_next/static/chunks/47919-bbaa10033e3a70b9.js",
  "/_next/static/chunks/48206-e2959cd0f9c39c4c.js",
  "/_next/static/chunks/48725-8197b2f1bf43a4dd.js",
  "/_next/static/chunks/49214-b95694f5108ca999.js",
  "/_next/static/chunks/49882-916136963c4a8fbe.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50138-3cad8fc7ef18c99a.js",
  "/_next/static/chunks/51671-4051598e964426a0.js",
  "/_next/static/chunks/52311-c7a8c6b47c5820f4.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53697-48aca5bb34ba504d.js",
  "/_next/static/chunks/54469-9d212910eeb4c719.js",
  "/_next/static/chunks/54a60aa6-3462a838c99f10b4.js",
  "/_next/static/chunks/55079-7e28db69b012b975.js",
  "/_next/static/chunks/56417-b0f0a243f5df38d3.js",
  "/_next/static/chunks/56526-9294f14b2b4ea722.js",
  "/_next/static/chunks/57198-f4e37d0db1f95bb5.js",
  "/_next/static/chunks/57455-0cbeb611054d38a1.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/5881-5c36c28c47315903.js",
  "/_next/static/chunks/58877-5c69affefdb35fe7.js",
  "/_next/static/chunks/59119-e26e4aac53b32516.js",
  "/_next/static/chunks/59386-7144c80a4d480360.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-a3b268c8bd291b61.js",
  "/_next/static/chunks/60216-66469c4b38ef3fc5.js",
  "/_next/static/chunks/61731-e293384bb7d0a40d.js",
  "/_next/static/chunks/6183-6c8c8d9397e66010.js",
  "/_next/static/chunks/61931-d9e94c638d17a5e1.js",
  "/_next/static/chunks/62285-37efeea768198f4c.js",
  "/_next/static/chunks/62310-f7486dea3b363a6d.js",
  "/_next/static/chunks/63-52baec9cf791023d.js",
  "/_next/static/chunks/6335-0326d7ee3f70ce6d.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64558-3a6ea8aa01a50739.js",
  "/_next/static/chunks/64961-72ea4fbe01b4062f.js",
  "/_next/static/chunks/68645-3db87573959f6f2c.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-0a69d493a797ed44.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/73025-16e76caf8c5f66f0.js",
  "/_next/static/chunks/73619-1cf35c480097cb0f.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76004-3e80144ef1089623.js",
  "/_next/static/chunks/76092-f4e06d0625470ad4.js",
  "/_next/static/chunks/77587-06d881f634abc98e.js",
  "/_next/static/chunks/78052-2f22ae1f512493c6.js",
  "/_next/static/chunks/78843-2439e8d89633dadd.js",
  "/_next/static/chunks/805-9c03c158ca5324ee.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81258-5c69affefdb35fe7.js",
  "/_next/static/chunks/81886-22275742ca3a4c6e.js",
  "/_next/static/chunks/82182-a0ecf047144dde19.js",
  "/_next/static/chunks/83057-7ff97018ad2d9281.js",
  "/_next/static/chunks/8317-32b7dc27282c623f.js",
  "/_next/static/chunks/83413-f3f8083e1f7275c1.js",
  "/_next/static/chunks/8382-7b8b1b2866055a08.js",
  "/_next/static/chunks/83891-b4f86c63cd4e7209.js",
  "/_next/static/chunks/84584-bdebc5f3eed19e08.js",
  "/_next/static/chunks/84702-8b7a315425403eff.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/86293-92e294fb3295a844.js",
  "/_next/static/chunks/87135-165b64127c326a1c.js",
  "/_next/static/chunks/87342-72ea4fbe01b4062f.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88087-a960b4f754f69975.js",
  "/_next/static/chunks/88470-5899a6a387eefc6a.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-3e557e7186b5ff80.js",
  "/_next/static/chunks/88751-c323f07322c58860.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/91543-9e260f7b089d417b.js",
  "/_next/static/chunks/91979-b3beba1c376bf9da.js",
  "/_next/static/chunks/92028-01f6bc406d49a3c5.js",
  "/_next/static/chunks/92758-2306713be271c488.js",
  "/_next/static/chunks/93207-217f4ecb7211180c.js",
  "/_next/static/chunks/94483-16bac38184a0fc77.js",
  "/_next/static/chunks/94997-386223eefeeb788e.js",
  "/_next/static/chunks/95125-69d1051d31730985.js",
  "/_next/static/chunks/95648-17be3f39a804c248.js",
  "/_next/static/chunks/95858-d59a1e3ee77e7649.js",
  "/_next/static/chunks/97825-4db850dd05bb0e8c.js",
  "/_next/static/chunks/98295-8be6d45c02c9ce33.js",
  "/_next/static/chunks/98459-48aca5bb34ba504d.js",
  "/_next/static/chunks/98473-d617e0083bfb5749.js",
  "/_next/static/chunks/98710-fee074466f00c282.js",
  "/_next/static/chunks/99341-2dc6a1d8766537c1.js",
  "/_next/static/chunks/99707-94ec089499617d41.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/(home)/page-27dcb12ff65d7892.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-0810e68504a982fe.js",
  "/_next/static/chunks/app/[locale]/account/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/account/page-5a53cd99404b8264.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/achievements/page-3e725e861e82fbd2.js",
  "/_next/static/chunks/app/[locale]/admin/announcements/page-f305d2bd3ae3fb89.js",
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
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-9577ae71cf34feba.js",
  "/_next/static/chunks/app/[locale]/admin/content-clicks/page-4df4329ef668a1e3.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-2fe14a7b37c2d0f8.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/[deckId]/page-be2e40e1cde6bb26.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/error-6819c135d6a91dab.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/loading-6597ef9fa8947df7.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/new/page-b4846cf117b3a62c.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/notes/[noteId]/page-b1f85ebc99fbe554.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/notes/new/page-9ede58eaea663891.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/notes/page-28d8a32998bca489.js",
  "/_next/static/chunks/app/[locale]/admin/deckmarket/page-e2ae75bf42bc5803.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-ef6d72339472cf62.js",
  "/_next/static/chunks/app/[locale]/admin/email-send-journal/page-72e0cddbe7d8da78.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/[id]/edit/page-fb059927c4b38136.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/page-f111858c46337c8f.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-baa7d890cd908b35.js",
  "/_next/static/chunks/app/[locale]/admin/error-2b7cd7d12656da42.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-d19cc12325c7af3f.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-3aefcba017af5757.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-89998f3529c58356.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-7192735bf79480fe.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-9e0bb67a34c4ea67.js",
  "/_next/static/chunks/app/[locale]/admin/layout-c033aa952602d256.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-0e262ca8c73c2553.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-d42e116b06482853.js",
  "/_next/static/chunks/app/[locale]/admin/loading-d5314f55ec8cd967.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-647d50a28722543a.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-d09d8722062b0331.js",
  "/_next/static/chunks/app/[locale]/admin/page-a11c1fab6cfe4511.js",
  "/_next/static/chunks/app/[locale]/admin/page-visits/page-38e543af3a835c40.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-b6b48ebbf6440e39.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-bc3c4e22dd35e2b4.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-26b56ca04a75c67b.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-ce795c1cd2c5eb7c.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-eeae25dddd57ab2a.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-58abecccee6560bc.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-41220de3d41c1bae.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-05c17f8d15870c3e.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-4a6da68162da6df8.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-895117bf4770a89e.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-402189f614f1a98a.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-3d50d51ffb2ac8d0.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-fef1b75213bf12a9.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-91f9b345118bcf98.js",
  "/_next/static/chunks/app/[locale]/admin/village-traffic/page-8c4913d1b0a01090.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-03288aab73119e1a.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-5cd3f28e3451d561.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-transcripts/page-5bb622c3e7efed89.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-cc1df275b997319a.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-82664e3b39246866.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-cc995fe7e65d67d1.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-833142f96ecdda8d.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-edf3a87b9ec1ef78.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-4c52d10388f2abce.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-3a011f1280374a05.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-63fb6f10f7c0b264.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-2e5be28b2de6f7e9.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-04a00e66d8b3d7fb.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-b874828df7b187df.js",
  "/_next/static/chunks/app/[locale]/blog/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/blog/page-807a75702710b4a3.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-2e4a72aea6555d3d.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-aa464048d2a3439d.js",
  "/_next/static/chunks/app/[locale]/comics/page-2bed53f9ba73f2a3.js",
  "/_next/static/chunks/app/[locale]/contact/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/contact/page-2214d1f9047b97e4.js",
  "/_next/static/chunks/app/[locale]/credits/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/credits/page-5f51051f9f83dcf1.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-87dfca73de429392.js",
  "/_next/static/chunks/app/[locale]/deckmarket/[deckId]/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/deckmarket/[deckId]/page-d248dfd9734aa6a3.js",
  "/_next/static/chunks/app/[locale]/deckmarket/error-67c5d2b075a5ee8d.js",
  "/_next/static/chunks/app/[locale]/deckmarket/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/deckmarket/loading-6597ef9fa8947df7.js",
  "/_next/static/chunks/app/[locale]/deckmarket/notes/[noteId]/page-e5d4adddbfb42c2a.js",
  "/_next/static/chunks/app/[locale]/deckmarket/page-7c23df49c9aa3505.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-b13f04ff10069ef0.js",
  "/_next/static/chunks/app/[locale]/drill/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/drill/page-3e441e1c0d81c18b.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-23e21d2c806e85d2.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-d651b6a7bcc04d2b.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-89005a50571ecabe.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-d4cefbd08eef0c85.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-e896daca6a8f3705.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-2e8bef263fb44172.js",
  "/_next/static/chunks/app/[locale]/games/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/games/page-8898ee6df5770895.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-f9f304251387e536.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-e926a00b08f5d435.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-6b1e4f0810b018b9.js",
  "/_next/static/chunks/app/[locale]/intro/page-77450f402ead6cf4.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-7a6fffc1daee6c96.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-afaedbb15ad61170.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-c7c748fe2e3849f4.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-af5b64222b37c3e8.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-e3b8a2f33eede62c.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-2dc1de88ddf8e214.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-bd0ba6435e93970e.js",
  "/_next/static/chunks/app/[locale]/layout-4099b56c0300d543.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-65c4b5db97a7e583.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-db3386f80c4eac67.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-c85ad63d1780c4e1.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-04d4e6cfcc2e1ff1.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-6597ef9fa8947df7.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-df93ba0eada6f75a.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-ead8407da0f090ac.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/practice/n4/page-f81939aaaab2c7e4.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/practice/page-064ef545f636c991.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-c1858785ec84e27a.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-54e442d791a4727c.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-37623d3630efeef4.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-47855cc5bb326da3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-37330f5e3b503305.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-8cc83a2993047260.js",
  "/_next/static/chunks/app/[locale]/library/page-8a6f958c9f312360.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-2ee7a45856530aac.js",
  "/_next/static/chunks/app/[locale]/lists/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/lists/page-4d38afc4fbc4380d.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-bd71f2dc410d24c7.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-838a38b51536cea9.js",
  "/_next/static/chunks/app/[locale]/news/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/news/page-75d4b30cc75f420c.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-684e6580db4f5e1d.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-18a1c69f3c84d067.js",
  "/_next/static/chunks/app/[locale]/not-found-740e49294d6f50d4.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-763d86a156b8cc03.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-f74d48266ccb71dd.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-d76c4f04b086a241.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-6597ef9fa8947df7.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-1613f4d24cf66ca5.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-038717b429979abc.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-6452a48e27860acc.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-686f54e0601e0e35.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/pricing/page-2eb765b9bdfe9c2e.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/privacy/page-3ceb882451300f82.js",
  "/_next/static/chunks/app/[locale]/pwa-demo/page-b6872b7aaa954cf5.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-9c15cd9b2afcee10.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-916559009c4fa19e.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-001d4bea9423cb7d.js",
  "/_next/static/chunks/app/[locale]/resources/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/resources/page-1105d01b9bbfbdd7.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-743f0d0170866109.js",
  "/_next/static/chunks/app/[locale]/review/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/review/page-6597ef9fa8947df7.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/review/session/page-d6a0f71913e037e1.js",
  "/_next/static/chunks/app/[locale]/server-error/page-0f5acd04cb70a1bc.js",
  "/_next/static/chunks/app/[locale]/settings/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/settings/page-6e5566a2dc5747dc.js",
  "/_next/static/chunks/app/[locale]/share/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/share/page-4a67a98e1b27fc9b.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/showcase/page-59632eb5717fba1c.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/statistics/page-4bca2763d17ce861.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-21f2a0391095eed9.js",
  "/_next/static/chunks/app/[locale]/stories/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/stories/page-cb0863b9383132d9.js",
  "/_next/static/chunks/app/[locale]/terms/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/terms/page-3549a8df0775e06e.js",
  "/_next/static/chunks/app/[locale]/test-celebration/page-4ed1dfdaf26d23e2.js",
  "/_next/static/chunks/app/[locale]/test-email/page-0bbdd2990e3e9c4a.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-191e812539a26438.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-1f9b254c636b646d.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-4a99bf26591a05f6.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-d6d801ef01d63616.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-49d22bab7cc09c0c.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-4b200b5c37265b8a.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-6707e8edaa7da005.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-112b1f7c91105a38.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-a000653d7af8327c.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-de61ab8cc9948999.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-50718a02191d9198.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-ddad4fb5ff007473.js",
  "/_next/static/chunks/app/[locale]/todos/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/todos/page-ec75063b76551047.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/learn/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/learn/page-ded2d90ab562894e.js",
  "/_next/static/chunks/app/[locale]/tools/blast-mode/page-f6589b44d8609983.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/drawing/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/drawing/page-5b2c65e08644087c.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-152ea62f8e055e83.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-15b5a724d3fa1dd2.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-b93a3979e3c5dc1c.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-bb4e8fd842c3b09b.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-5ac2ace3a9b55016.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-f9a37cedf20fe8c5.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-8a27293ba25ed839.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-8378f3f1e1747bb9.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-61c0643f1d612c85.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-2e2642255451fc74.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-f17d24e2a48fd650.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-a8deabdfce7e9a6e.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-07e4e10bb35cad91.js",
  "/_next/static/chunks/app/_not-found/page-6597ef9fa8947df7.js",
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
  "/_next/static/chunks/webpack-246eab326cc694a8.js",
  "/_next/static/css/196aec2dddf02260.css",
  "/_next/static/css/47232e22c3e22e5f.css",
  "/_next/static/css/5c8ac3dc5edc2b63.css",
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
