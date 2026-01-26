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

const CACHE_VERSION = 'moshimoshi-e0c4b7497d0f';
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
  "/_next/static/2uqRbbrEsEJ2PSwO2LbLA/_buildManifest.js",
  "/_next/static/2uqRbbrEsEJ2PSwO2LbLA/_ssgManifest.js",
  "/_next/static/chunks/10152-c63ff6c19e120921.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-58c9f3a9ad081a09.js",
  "/_next/static/chunks/10627-62468c7d33c30dc2.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/11599-4a5c4d8758824797.js",
  "/_next/static/chunks/12309-5d7ff06765c5b033.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/13585-d781d8b248da8465.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14673-e7741737d0d4eb68.js",
  "/_next/static/chunks/14777-1fb0b5e4dbe5bfe6.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/1673-19ab87a7a4309297.js",
  "/_next/static/chunks/17377-1a02db5ae13e0351.js",
  "/_next/static/chunks/17401-141e014b66b5574e.js",
  "/_next/static/chunks/17885-14ef6c1b56a894e9.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/19645-6d1360c06bdb2fd6.js",
  "/_next/static/chunks/20242-09dc5a2753990a14.js",
  "/_next/static/chunks/20461-cbea971ba25d4726.js",
  "/_next/static/chunks/20840-769c534cbb2e4766.js",
  "/_next/static/chunks/21544-e005b466da6197bb.js",
  "/_next/static/chunks/21960-fd4a8b2ab051e179.js",
  "/_next/static/chunks/22678-5d10e0354512b2f3.js",
  "/_next/static/chunks/23180-c6604cd2e1af2eda.js",
  "/_next/static/chunks/2353-7b8b1b2866055a08.js",
  "/_next/static/chunks/23868-4be701e3a063aab1.js",
  "/_next/static/chunks/23930-97fd13c4d5de9908.js",
  "/_next/static/chunks/24146-753abcb4dd26930a.js",
  "/_next/static/chunks/24366-6101194aa4c1ff3d.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25352-f1c0619d40546587.js",
  "/_next/static/chunks/26823-fb07f8964dfe825e.js",
  "/_next/static/chunks/27183-06448e86090a0a71.js",
  "/_next/static/chunks/27294-ed880dcf0dcfb340.js",
  "/_next/static/chunks/27890-8e2d03e3148187b1.js",
  "/_next/static/chunks/29142-6808aad8d31b318b.js",
  "/_next/static/chunks/2964-788711f49d21cc2e.js",
  "/_next/static/chunks/30760-7f663874dd645d7d.js",
  "/_next/static/chunks/31255-51683c9965fd7ee4.js",
  "/_next/static/chunks/31480-8353481404aba412.js",
  "/_next/static/chunks/32492-4465869dd5edcfee.js",
  "/_next/static/chunks/33251-df71511eb6b15dd4.js",
  "/_next/static/chunks/34244-5c3af7374b9079ca.js",
  "/_next/static/chunks/3509-f60824423c91d525.js",
  "/_next/static/chunks/35925-c3dbe8f5843da83e.js",
  "/_next/static/chunks/363642f4-9c205dcd9aea5ef1.js",
  "/_next/static/chunks/36996-6fe64dad01360cf1.js",
  "/_next/static/chunks/37005-7144c80a4d480360.js",
  "/_next/static/chunks/37255-baecd0c8efb3e477.js",
  "/_next/static/chunks/37553-c819c42ff88dbd94.js",
  "/_next/static/chunks/38151-2e9d1f1e0870deac.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/39452-1b9bf130325e3b3e.js",
  "/_next/static/chunks/40031-32b773af72a22789.js",
  "/_next/static/chunks/40144-7af537cf7ca46aa0.js",
  "/_next/static/chunks/40953-2ca062ff5ddf9b2d.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/43197-9197badd15e6a3c1.js",
  "/_next/static/chunks/45001-1d6797dc52d563c5.js",
  "/_next/static/chunks/45161-6373c2a3e4bda930.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/46693-a3b5904bc1087d7f.js",
  "/_next/static/chunks/46788-bef05697712a8b0c.js",
  "/_next/static/chunks/47919-f1ec9e032fce7110.js",
  "/_next/static/chunks/48026-4ac4a4fa4304dc2c.js",
  "/_next/static/chunks/49882-31c1f9167d13625a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50138-3cad8fc7ef18c99a.js",
  "/_next/static/chunks/50443-0735c720987a05cc.js",
  "/_next/static/chunks/52311-5ca920c037227a73.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53697-769c534cbb2e4766.js",
  "/_next/static/chunks/53799-2a937ed858941b00.js",
  "/_next/static/chunks/53807-33d65eb5285ac3bb.js",
  "/_next/static/chunks/54469-12f4b2c9734d7790.js",
  "/_next/static/chunks/54817-fd4a8b2ab051e179.js",
  "/_next/static/chunks/54a60aa6-3462a838c99f10b4.js",
  "/_next/static/chunks/56526-d068366c6f5deaf6.js",
  "/_next/static/chunks/56649-4b843b6a756a1fa4.js",
  "/_next/static/chunks/57356-12c4479e61a7287f.js",
  "/_next/static/chunks/57578-63879888138aead8.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-7144c80a4d480360.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-7d9835a452352da5.js",
  "/_next/static/chunks/603-3a2517df1c339c94.js",
  "/_next/static/chunks/61324-6dbfce78c7dfdce6.js",
  "/_next/static/chunks/62285-d7ebc9a095465037.js",
  "/_next/static/chunks/62310-4bff0e89170776a0.js",
  "/_next/static/chunks/62675-144b28e069d5dc4f.js",
  "/_next/static/chunks/63790-e12045dcaeb6b3c3.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64543-975d6f248175b78a.js",
  "/_next/static/chunks/64961-72ea4fbe01b4062f.js",
  "/_next/static/chunks/65053-d42ca5f0d2c09cb9.js",
  "/_next/static/chunks/65934-9c253ba0829fe664.js",
  "/_next/static/chunks/68645-3db87573959f6f2c.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/68792-a4f295b12e1f177d.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-4225c9c27672bba8.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71186-dcc2c4c890472bb8.js",
  "/_next/static/chunks/71288-58f1f35cf18df4ce.js",
  "/_next/static/chunks/74791-3ae3ab5564d308c9.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-60734f2f3e57c6bf.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76078-769c534cbb2e4766.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/79297-7ec92f3c39cf4e03.js",
  "/_next/static/chunks/79564-93847c7b8d72cece.js",
  "/_next/static/chunks/79928-bd825cf4050bc7a3.js",
  "/_next/static/chunks/805-799bd0c1a3006a20.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/81267-a6573da0d2250f21.js",
  "/_next/static/chunks/82182-ce2de98e351b7888.js",
  "/_next/static/chunks/8317-32b7dc27282c623f.js",
  "/_next/static/chunks/8382-7b8b1b2866055a08.js",
  "/_next/static/chunks/8386-24aba49692de162b.js",
  "/_next/static/chunks/83891-cf45de36ff2b027a.js",
  "/_next/static/chunks/84584-bdebc5f3eed19e08.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/86480-2b61bf5646b1872c.js",
  "/_next/static/chunks/87135-822ecc21ebda58eb.js",
  "/_next/static/chunks/87342-72ea4fbe01b4062f.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88087-a960b4f754f69975.js",
  "/_next/static/chunks/88470-5899a6a387eefc6a.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-3e557e7186b5ff80.js",
  "/_next/static/chunks/88751-4e0da2b3554e9e6d.js",
  "/_next/static/chunks/90378-7dab995d33ca3267.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/91445-b1767331c9c271e9.js",
  "/_next/static/chunks/91979-b3beba1c376bf9da.js",
  "/_next/static/chunks/92758-2306713be271c488.js",
  "/_next/static/chunks/93171-9688cbc95e8633b0.js",
  "/_next/static/chunks/94997-af8b57cdd441a1d1.js",
  "/_next/static/chunks/98295-1545bf2ab514a125.js",
  "/_next/static/chunks/98459-769c534cbb2e4766.js",
  "/_next/static/chunks/98723-8a13142e4e7f3dba.js",
  "/_next/static/chunks/99341-2dc6a1d8766537c1.js",
  "/_next/static/chunks/99579-fd4a8b2ab051e179.js",
  "/_next/static/chunks/99707-54aa065a05325437.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/(home)/page-7ee37eb04432a075.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-a99145a126524b72.js",
  "/_next/static/chunks/app/[locale]/account/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/account/page-ba4203f1754a81cc.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/achievements/page-cd7886cddb7e7f07.js",
  "/_next/static/chunks/app/[locale]/admin/auth-monitor/page-c065f49b3cda3fb2.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-b55de30dda5021da.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-348ce92f8cb9708c.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-b3f70ca425478a40.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-3b562b7c7f269beb.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-9d5fc5d13dd9897d.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-436ec3f2372373b9.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-b79859e8bc4932cb.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-6fde7247fc8eadcc.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-fad3bd509a7b6356.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-5793b042803ba78c.js",
  "/_next/static/chunks/app/[locale]/admin/content-clicks/page-e5f569203f347e57.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-1ea38bb63b483c43.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-31f5aaa00d1a9ddf.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/[id]/edit/page-69824b52b9ba835b.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/page-2e974d487040fc9b.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-7ed6cfa4dd918255.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-f6c54fd2f9f5a5d7.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-a5156aabdeb67ad8.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-260579c6aac25f36.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-a902c8d40d1c18bb.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-34d38a5c560ec6a4.js",
  "/_next/static/chunks/app/[locale]/admin/layout-f7fa69b3dbc2ed93.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-4aee8238385f9043.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-52a7f30d7439ca0e.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-7eefb27b28e00f4c.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-e69234b69e909e91.js",
  "/_next/static/chunks/app/[locale]/admin/page-18da447954b5f3fe.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-bbf289beedb0054c.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-e55abaeb7f47581d.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-bdfb48837b40533f.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-9cc4ac2326afd517.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-427e8a39db56a3df.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-d56f48a1df2540ea.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-520422f935223870.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-f7211ab9cea966e6.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-11b1bb7c63896af1.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-e7064494f21b2084.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-add2de7b353a9bd2.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-d463f25e3d9cb1e6.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-b5298fce00e42ce6.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-bbdab32f7584981b.js",
  "/_next/static/chunks/app/[locale]/admin/village-traffic/page-99cd66fa02e92a97.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-76418f49094d7d21.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-2108088df75238a4.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-34a11893baf08c45.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-4e2b7fd4104ec5e0.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-280c0a799783d05b.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-060ac01fd685b0a2.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-0768b385feecdcf4.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-0c354e782bf1cf80.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-7a232cd3bba098ac.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-e8921802245d543f.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-1aae659abb5eba84.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-87a81b9d5abdd508.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-ed88bb204fc2a434.js",
  "/_next/static/chunks/app/[locale]/blog/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/blog/page-849d6ae2d1c43f99.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-00e1e501e2f73232.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-189816f38d42300e.js",
  "/_next/static/chunks/app/[locale]/comics/page-bc80e83ef9673cd0.js",
  "/_next/static/chunks/app/[locale]/contact/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/contact/page-18b7dbdc4d94b70a.js",
  "/_next/static/chunks/app/[locale]/credits/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/credits/page-02c5978c779c6eb9.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-4ecb62308393ba02.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-aeacfdf67fbdd523.js",
  "/_next/static/chunks/app/[locale]/drill/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/drill/page-c80d9aa20c81a290.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-269422d234a46f50.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-70b87b0fc0fe9927.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-619745ae1ec3f40f.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-7be340f728f2fa9d.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-2fb68e61de530957.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-d0957ea977bd3630.js",
  "/_next/static/chunks/app/[locale]/games/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/page-66a0e645b99a726a.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-198b6893636c2880.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-f71e202d88ad8468.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-9ef9b6db46cbdb8a.js",
  "/_next/static/chunks/app/[locale]/intro/page-84fffda7aa42f846.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-c84ebb744590f883.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-0b45da15f3403f3a.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-9d572c0bba4c1758.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-f67a197430718ef5.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-f49c3404435bdc5e.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-2566a2cf9925093e.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-0366e69444b9ec01.js",
  "/_next/static/chunks/app/[locale]/layout-1b97de8388ca5131.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-d91095d4c4638aa3.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-f41a4150aed0d76e.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-7cdc3e8f4a3e1e8a.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-b6d577bec2face34.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-4ef64b9a4d2246da.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-88cbce280969ab7c.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-2b4ed9d519b1b261.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-3563044169a17f89.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-1a70e480bbc5802b.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-1afdcad062cb5f6e.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-c142589287ec5e2e.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-c28e3be0259a066c.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-d2688a75286903ac.js",
  "/_next/static/chunks/app/[locale]/library/page-101f7e3d76b86039.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-f69c7f0f6fd66535.js",
  "/_next/static/chunks/app/[locale]/lists/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/lists/page-b5c58658a94fead8.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-e21aa6b22c09dbd8.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-4b35ddebec05de1d.js",
  "/_next/static/chunks/app/[locale]/news/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/news/page-57ab2b5d23c6a6c6.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-338ed5c8418ca674.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-6c791d7f6ba3551b.js",
  "/_next/static/chunks/app/[locale]/not-found-46e54aa0ebae0960.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-1dce38222cfb14b5.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-3a3649e4027f6216.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-db5641cf5044d4cd.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-4ef64b9a4d2246da.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-7c2cc622f410a9f1.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-4c245aa53fc12c4d.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-6292c17428e74aae.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-208166a5a2759bc5.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/pricing/page-d11926d2ea41be84.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/privacy/page-6a5f3997ece49d41.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-7a28663a800f23a9.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-1cc5a3919c668eef.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-442f64d426a37462.js",
  "/_next/static/chunks/app/[locale]/resources/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/resources/page-2b4782d647fa065a.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-2adc0382d819ae8d.js",
  "/_next/static/chunks/app/[locale]/review/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review/page-4ef64b9a4d2246da.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review/session/page-1480ee91c50ce688.js",
  "/_next/static/chunks/app/[locale]/server-error/page-c7d61d07f96cbe7f.js",
  "/_next/static/chunks/app/[locale]/settings/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/settings/page-e864b7aefe5ed9f0.js",
  "/_next/static/chunks/app/[locale]/share/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/share/page-ea66fb5ebf40db0f.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/showcase/page-4d133122c72fd2ab.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/statistics/page-90d561adcc49d559.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-2f5f5d01817d5c15.js",
  "/_next/static/chunks/app/[locale]/stories/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/stories/page-b8aedcdfafe7b91e.js",
  "/_next/static/chunks/app/[locale]/terms/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/terms/page-83b1f1e1e9a45939.js",
  "/_next/static/chunks/app/[locale]/test-celebration/page-05c164319ff6007a.js",
  "/_next/static/chunks/app/[locale]/test-email/page-22d28f9393a37067.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-b161d8662d3588e1.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-f0f0ac20bd82649a.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-4ebc1d1c1afe7321.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-47967db2991dce1b.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-54191f24a56fa2fe.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-3286147038c53d11.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-812a133a78ed3702.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-4ef5806cb54f5ae0.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-7d98fd2c1060089d.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-29d2004603e8bbee.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-e9c9118040e7f171.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-4c63c78ca5e93f6f.js",
  "/_next/static/chunks/app/[locale]/todos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/todos/page-ea81bb2f07bee3a8.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-21a5032130988106.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-4120a71060a225a0.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-e609add4951a7d07.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-27265c81b947a50d.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-d5b8d2d1d410009d.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-59497f3306cbb59a.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-38e6de009c63df54.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-42bca0d288daccec.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-1c1933ecef616aeb.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-2f8d13d2bb351bf4.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-2e6218d7e1168c19.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-3368b0a2683f3ce2.js",
  "/_next/static/chunks/app/_not-found/page-4ef64b9a4d2246da.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-6d30fc39bf20a9a4.js",
  "/_next/static/chunks/app/error-515d87d42c7b502e.js",
  "/_next/static/chunks/app/global-error-3217d135f8c9e2c9.js",
  "/_next/static/chunks/app/layout-87753dae88e1f39a.js",
  "/_next/static/chunks/app/not-found-9a9737bf0edfbf95.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-app-f6252dbd1fe808b2.js",
  "/_next/static/chunks/main-cfb3db664140ef3f.js",
  "/_next/static/chunks/pages/_app-f365312a4d2529fb.js",
  "/_next/static/chunks/pages/_error-ff431fa75c297bd3.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-87063e4284546bc7.js",
  "/_next/static/css/2d2cfea04addd16e.css",
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
