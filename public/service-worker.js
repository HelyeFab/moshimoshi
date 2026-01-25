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

const CACHE_VERSION = 'moshimoshi-642681a3c143';
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
  "/_next/static/G9q-zDEoyNFvvK9Xho2um/_buildManifest.js",
  "/_next/static/G9q-zDEoyNFvvK9Xho2um/_ssgManifest.js",
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-58c9f3a9ad081a09.js",
  "/_next/static/chunks/10627-bcf644fe12302657.js",
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
  "/_next/static/chunks/1673-8f625db55ae992b4.js",
  "/_next/static/chunks/17377-1a02db5ae13e0351.js",
  "/_next/static/chunks/17401-141e014b66b5574e.js",
  "/_next/static/chunks/17885-14ef6c1b56a894e9.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/19645-fe67005559305911.js",
  "/_next/static/chunks/20242-09dc5a2753990a14.js",
  "/_next/static/chunks/20461-cbea971ba25d4726.js",
  "/_next/static/chunks/20840-769c534cbb2e4766.js",
  "/_next/static/chunks/21544-e005b466da6197bb.js",
  "/_next/static/chunks/21960-fd4a8b2ab051e179.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-7b8b1b2866055a08.js",
  "/_next/static/chunks/23868-20854aed872efc80.js",
  "/_next/static/chunks/23930-97fd13c4d5de9908.js",
  "/_next/static/chunks/24146-753abcb4dd26930a.js",
  "/_next/static/chunks/24366-6101194aa4c1ff3d.js",
  "/_next/static/chunks/24495-2a5c5131197562f2.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25760-5a31a6708e5afa36.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/27183-39d671770276cc31.js",
  "/_next/static/chunks/27294-a806238bc582b1e2.js",
  "/_next/static/chunks/27890-0e69a191b8463e87.js",
  "/_next/static/chunks/2964-788711f49d21cc2e.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31480-f9b411669effa204.js",
  "/_next/static/chunks/32492-4465869dd5edcfee.js",
  "/_next/static/chunks/33251-df71511eb6b15dd4.js",
  "/_next/static/chunks/34244-5c3af7374b9079ca.js",
  "/_next/static/chunks/3509-f60824423c91d525.js",
  "/_next/static/chunks/35925-c3dbe8f5843da83e.js",
  "/_next/static/chunks/36996-6fe64dad01360cf1.js",
  "/_next/static/chunks/37005-7144c80a4d480360.js",
  "/_next/static/chunks/37255-baecd0c8efb3e477.js",
  "/_next/static/chunks/37553-28669643b9d942b8.js",
  "/_next/static/chunks/38151-f460c7ec9232112a.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/39452-1af4b4a8fc2fa6fe.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/40953-2ca062ff5ddf9b2d.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/43197-6002b5f2f37837a7.js",
  "/_next/static/chunks/45001-1d6797dc52d563c5.js",
  "/_next/static/chunks/45161-6373c2a3e4bda930.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-04d89b9120557c53.js",
  "/_next/static/chunks/46693-a3b5904bc1087d7f.js",
  "/_next/static/chunks/46788-05519c496080b0c3.js",
  "/_next/static/chunks/47919-0f1ac89d8e33293e.js",
  "/_next/static/chunks/49882-9a836a5347a47a9a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50138-3cad8fc7ef18c99a.js",
  "/_next/static/chunks/50443-0735c720987a05cc.js",
  "/_next/static/chunks/52311-5da5889dc103ae82.js",
  "/_next/static/chunks/52413-1421dc014ea61920.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53697-769c534cbb2e4766.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-0148078f5edea993.js",
  "/_next/static/chunks/54469-a7347a4509cfaceb.js",
  "/_next/static/chunks/54817-fd4a8b2ab051e179.js",
  "/_next/static/chunks/54a60aa6-fde3c27555179f9b.js",
  "/_next/static/chunks/56526-8dbb70d9d12f58b9.js",
  "/_next/static/chunks/56649-4b843b6a756a1fa4.js",
  "/_next/static/chunks/57356-fedef35d2015a315.js",
  "/_next/static/chunks/57578-63879888138aead8.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-7144c80a4d480360.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-94575a6e0e50b932.js",
  "/_next/static/chunks/61324-4e990da90c694db1.js",
  "/_next/static/chunks/62285-37efeea768198f4c.js",
  "/_next/static/chunks/62310-8d3114cfda636653.js",
  "/_next/static/chunks/62675-d36056d345ceeedb.js",
  "/_next/static/chunks/63790-5d51db9e7c6b5dc7.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64543-8b7b2aff66ba0270.js",
  "/_next/static/chunks/64961-72ea4fbe01b4062f.js",
  "/_next/static/chunks/65053-bbd350159074fc14.js",
  "/_next/static/chunks/669-35cfb2e73ce5388e.js",
  "/_next/static/chunks/68645-3db87573959f6f2c.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/68792-2ff3086b4887ff08.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-dcbd81112abf1596.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71186-e2e494145961085c.js",
  "/_next/static/chunks/71288-865018a9ff192085.js",
  "/_next/static/chunks/74791-3ae3ab5564d308c9.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-7a7a1f5ac65836d0.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76078-769c534cbb2e4766.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/79297-7ec92f3c39cf4e03.js",
  "/_next/static/chunks/79564-8105f153913a5a91.js",
  "/_next/static/chunks/79928-79b50e4938229a4a.js",
  "/_next/static/chunks/80137-a376634f6bee5d4c.js",
  "/_next/static/chunks/805-35f185dfdaa1d8e8.js",
  "/_next/static/chunks/8079-4892b192ae2fd960.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/81267-a6573da0d2250f21.js",
  "/_next/static/chunks/82182-7ccde2b363979852.js",
  "/_next/static/chunks/8317-32b7dc27282c623f.js",
  "/_next/static/chunks/8382-7b8b1b2866055a08.js",
  "/_next/static/chunks/83891-b4f86c63cd4e7209.js",
  "/_next/static/chunks/84584-bdebc5f3eed19e08.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/86480-87214caeae6a448c.js",
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
  "/_next/static/chunks/91979-b3beba1c376bf9da.js",
  "/_next/static/chunks/92758-2306713be271c488.js",
  "/_next/static/chunks/93171-9688cbc95e8633b0.js",
  "/_next/static/chunks/94997-0b77d9795f29f79a.js",
  "/_next/static/chunks/97125-785dbbe18d161138.js",
  "/_next/static/chunks/98459-769c534cbb2e4766.js",
  "/_next/static/chunks/99341-2dc6a1d8766537c1.js",
  "/_next/static/chunks/99579-fd4a8b2ab051e179.js",
  "/_next/static/chunks/99707-7b43a77a6167bf66.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/(home)/page-3427a7cf55339596.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-a99145a126524b72.js",
  "/_next/static/chunks/app/[locale]/account/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/account/page-c9846121b14681f5.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/achievements/page-cd7886cddb7e7f07.js",
  "/_next/static/chunks/app/[locale]/admin/auth-monitor/page-c100ca38c86c7f91.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-7e328a0926fc3476.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-5ab682755fc42fc6.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-aade73387aa427e7.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-bd9cd9271a2de46e.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-4ad2705b2a5ba177.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-419e0082fa4be5c9.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-6f0fe2ec8ec15a33.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-297070042867f8a6.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-c8700aeee94cc615.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-582df253dfc00eac.js",
  "/_next/static/chunks/app/[locale]/admin/content-clicks/page-0793a4b2622c11fb.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-1ea38bb63b483c43.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-a58191dd25bb7b0e.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-9249dbacff1ac45d.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-9dab5baac60406fb.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-8ebe81291db20a2b.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-e3b3c8240a8d8cdf.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-93136f9b902d0ee7.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-6e148cbc0fd8618f.js",
  "/_next/static/chunks/app/[locale]/admin/layout-f7fa69b3dbc2ed93.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-9a8288a055520236.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-14e329ab364ed2d2.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-70b56ec29bb95baa.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-5eda128c284e0dca.js",
  "/_next/static/chunks/app/[locale]/admin/page-d3590dc9b6bbe4b8.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-9868b016fc277d47.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-2eb8ce6871d35f73.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-0d2779fb349fdc39.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-9cc4ac2326afd517.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-427e8a39db56a3df.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-7adc1237ddedfb9b.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-ccd1c333a7847b27.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-c128571e520ab0cb.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-f7bf56189ab345fa.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-bbafdb8e8767f6c4.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-cfc587b9a5ec4a21.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-ce0d86e36378f02a.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-10abc16e0baee28c.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-bbdab32f7584981b.js",
  "/_next/static/chunks/app/[locale]/admin/village-traffic/page-99cd66fa02e92a97.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-dc4f82d74eba4a9d.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-8e695bbb0c3ed944.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-fd673bfd8793288a.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-4e2b7fd4104ec5e0.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-df63c40965bd2928.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-060ac01fd685b0a2.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-0768b385feecdcf4.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-62c0029fc281e517.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-066f93a86b7d8ced.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-e8921802245d543f.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-c56d4d072365ca92.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-85efb852bc5881c1.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-00f32af6f2e3a3ee.js",
  "/_next/static/chunks/app/[locale]/blog/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/blog/page-ed31be1c711d9bb6.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-00e1e501e2f73232.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-af42ff46906992fe.js",
  "/_next/static/chunks/app/[locale]/comics/page-a3776b863684e4a5.js",
  "/_next/static/chunks/app/[locale]/contact/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/contact/page-89444c02df081f84.js",
  "/_next/static/chunks/app/[locale]/credits/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/credits/page-9d5c6d7795f3c3b0.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-aab4cb0d82129def.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-aeacfdf67fbdd523.js",
  "/_next/static/chunks/app/[locale]/drill/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/drill/page-317465fac1d72d6a.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-cb6fca66f37e3a9a.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-15d79f7e09f5f8a1.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-fff17206463a6257.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-f51164f57cce3426.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-4d61985b7f04b949.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-d0957ea977bd3630.js",
  "/_next/static/chunks/app/[locale]/games/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/page-9d33ce437fe29ea5.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-198b6893636c2880.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-dafeda7b80158bbf.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-4c9e1ec2bc9f2a8a.js",
  "/_next/static/chunks/app/[locale]/intro/page-64fba16c62dfa71c.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-f9b33b42c5fc9370.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-d89607023a1f01d9.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-b85b43cd4940f71a.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-228364492a01c17c.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-e63fe92d5f5d92a5.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-243c204046b51a5f.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-781f482063b2a292.js",
  "/_next/static/chunks/app/[locale]/layout-443274f44e97cd49.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-b8339481eb442af4.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-56f675ac9ab5ace5.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-266fc58c45f8bde0.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-ea4ff43f74cb92d1.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-4b860dfcc278980b.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-88cbce280969ab7c.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-2b4ed9d519b1b261.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-3563044169a17f89.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-1a70e480bbc5802b.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-4029762bb2771d82.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-88360eb4359decd9.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-c2422470384cc0c7.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-99a171e46b93c3d7.js",
  "/_next/static/chunks/app/[locale]/library/page-b30779ef659ca312.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-c9796931c3e504a9.js",
  "/_next/static/chunks/app/[locale]/lists/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/lists/page-3601815a0b0f3c16.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-071bb492f40d7e74.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-d422bc0ca2f37b2a.js",
  "/_next/static/chunks/app/[locale]/news/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/news/page-a0d4eda0e6b7a908.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-338ed5c8418ca674.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-185df0c72c39a800.js",
  "/_next/static/chunks/app/[locale]/not-found-eec993b8731aab90.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-1dce38222cfb14b5.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-3a3649e4027f6216.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-db5641cf5044d4cd.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-4b860dfcc278980b.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-7c2cc622f410a9f1.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-1f6483655429fe43.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-2c3a9cae385b446a.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-caba3c2249c60cfd.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/pricing/page-834de468d36d14a8.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/privacy/page-c63e6a05de2978b2.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-7a28663a800f23a9.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-1cc5a3919c668eef.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-da6aa79a7626815b.js",
  "/_next/static/chunks/app/[locale]/resources/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/resources/page-1f78b6e4c0ba2ff0.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-fb37ebbad2a96e54.js",
  "/_next/static/chunks/app/[locale]/review/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review/page-4b860dfcc278980b.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review/session/page-e0a3c8a8a13f63fb.js",
  "/_next/static/chunks/app/[locale]/server-error/page-0724ff66ee8396f6.js",
  "/_next/static/chunks/app/[locale]/settings/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/settings/page-49f849ebc7ad3c19.js",
  "/_next/static/chunks/app/[locale]/share/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/share/page-b1232af767ef65b2.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/showcase/page-4d133122c72fd2ab.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/statistics/page-18e2e1dd7b163c8a.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-60396d6f63b0ebc4.js",
  "/_next/static/chunks/app/[locale]/stories/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/stories/page-58443668b581acd2.js",
  "/_next/static/chunks/app/[locale]/terms/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/terms/page-faf16f6c1fa4273d.js",
  "/_next/static/chunks/app/[locale]/test-celebration/page-05c164319ff6007a.js",
  "/_next/static/chunks/app/[locale]/test-email/page-22d28f9393a37067.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-85e4435d2862a519.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-f0f0ac20bd82649a.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-f78117ae9ed2a83d.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-0175912f53c7f31e.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-9d241abb67372c4b.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-3286147038c53d11.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-1a1b374468099b3f.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-475be448bbe6d4fd.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-7d98fd2c1060089d.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-29d2004603e8bbee.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-b7e4779ab5d8b3b1.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-c67d10f25a9be8e3.js",
  "/_next/static/chunks/app/[locale]/todos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/todos/page-25ea7d32ccd08a85.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-237344784b3d2083.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-cb808d2d630ee448.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-95e741e603b50e96.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-27265c81b947a50d.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-74132aea72e27880.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-9799f8daed968a2c.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-949e5365dea82480.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-c802c1ea9495a35e.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-02663412f89307f9.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-ad79a3a6f8747c82.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-f189032260f57b58.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-e1e88a48ae5d08ce.js",
  "/_next/static/chunks/app/_not-found/page-4b860dfcc278980b.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-46c8e0e0b090ec8f.js",
  "/_next/static/chunks/app/error-95dc052268e8e853.js",
  "/_next/static/chunks/app/global-error-02f2cd1277ce1234.js",
  "/_next/static/chunks/app/layout-dec655e10387de11.js",
  "/_next/static/chunks/app/not-found-7e34f0bad2ce5bdd.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-app-f6252dbd1fe808b2.js",
  "/_next/static/chunks/main-cd55c576c37ced5a.js",
  "/_next/static/chunks/pages/_app-f365312a4d2529fb.js",
  "/_next/static/chunks/pages/_error-ff431fa75c297bd3.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-9bf3dee126c194fa.js",
  "/_next/static/css/580bcbd48a70ee00.css",
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
