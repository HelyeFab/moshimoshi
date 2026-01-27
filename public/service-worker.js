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

const CACHE_VERSION = 'moshimoshi-f045e3968df1';
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
  "/_next/static/7TEOuxirOowaEEE6sNK1H/_buildManifest.js",
  "/_next/static/7TEOuxirOowaEEE6sNK1H/_ssgManifest.js",
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-58c9f3a9ad081a09.js",
  "/_next/static/chunks/10627-bcf644fe12302657.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/12309-77e83b00a0da00b6.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/12687-e5c7fec2d6d080ad.js",
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
  "/_next/static/chunks/19645-fe67005559305911.js",
  "/_next/static/chunks/20756-8bee72c6e578e6c8.js",
  "/_next/static/chunks/20840-769c534cbb2e4766.js",
  "/_next/static/chunks/21544-e005b466da6197bb.js",
  "/_next/static/chunks/21960-fd040988c7ffd330.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-7b8b1b2866055a08.js",
  "/_next/static/chunks/23868-20854aed872efc80.js",
  "/_next/static/chunks/23930-97fd13c4d5de9908.js",
  "/_next/static/chunks/24146-3a8977781eaa5b82.js",
  "/_next/static/chunks/24366-6101194aa4c1ff3d.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25352-f1c0619d40546587.js",
  "/_next/static/chunks/25760-5a31a6708e5afa36.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/27183-39d671770276cc31.js",
  "/_next/static/chunks/27258-7d6a0a97bfc12527.js",
  "/_next/static/chunks/27294-a806238bc582b1e2.js",
  "/_next/static/chunks/2783-77fad2163e04908c.js",
  "/_next/static/chunks/29142-b18ac59e3a6c79ea.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31480-f9b411669effa204.js",
  "/_next/static/chunks/33145-209c609ab4e5871f.js",
  "/_next/static/chunks/34244-5c3af7374b9079ca.js",
  "/_next/static/chunks/3509-f60824423c91d525.js",
  "/_next/static/chunks/35925-c3dbe8f5843da83e.js",
  "/_next/static/chunks/363642f4-9c205dcd9aea5ef1.js",
  "/_next/static/chunks/36996-5a51412719734de1.js",
  "/_next/static/chunks/37005-7144c80a4d480360.js",
  "/_next/static/chunks/37553-28669643b9d942b8.js",
  "/_next/static/chunks/38151-f460c7ec9232112a.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/39452-1af4b4a8fc2fa6fe.js",
  "/_next/static/chunks/39853-4b9e50b84c22b8a5.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/4122-b1cbfec634c8a68d.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/43197-6002b5f2f37837a7.js",
  "/_next/static/chunks/45001-1d6797dc52d563c5.js",
  "/_next/static/chunks/45161-6373c2a3e4bda930.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-04d89b9120557c53.js",
  "/_next/static/chunks/46693-964286f43e066e11.js",
  "/_next/static/chunks/46788-c4b5e1cfb7da6b8a.js",
  "/_next/static/chunks/46993-165e9148c90f5cd1.js",
  "/_next/static/chunks/47919-0f1ac89d8e33293e.js",
  "/_next/static/chunks/48725-8197b2f1bf43a4dd.js",
  "/_next/static/chunks/49882-9a836a5347a47a9a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50138-3cad8fc7ef18c99a.js",
  "/_next/static/chunks/50443-0735c720987a05cc.js",
  "/_next/static/chunks/52311-5da5889dc103ae82.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53697-769c534cbb2e4766.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-0148078f5edea993.js",
  "/_next/static/chunks/54469-9d212910eeb4c719.js",
  "/_next/static/chunks/54817-fd040988c7ffd330.js",
  "/_next/static/chunks/54a60aa6-3462a838c99f10b4.js",
  "/_next/static/chunks/56526-551845d29a79074f.js",
  "/_next/static/chunks/57578-5fe71dae6f68751b.js",
  "/_next/static/chunks/58126-ddb4f9779a7dcf02.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-7144c80a4d480360.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-a3b268c8bd291b61.js",
  "/_next/static/chunks/61024-462865cae6d50307.js",
  "/_next/static/chunks/61324-4e990da90c694db1.js",
  "/_next/static/chunks/62310-f7486dea3b363a6d.js",
  "/_next/static/chunks/62675-4d185e2f4d7176b2.js",
  "/_next/static/chunks/63-52baec9cf791023d.js",
  "/_next/static/chunks/63790-5d51db9e7c6b5dc7.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64543-8b7b2aff66ba0270.js",
  "/_next/static/chunks/64558-3a6ea8aa01a50739.js",
  "/_next/static/chunks/64961-72ea4fbe01b4062f.js",
  "/_next/static/chunks/669-35cfb2e73ce5388e.js",
  "/_next/static/chunks/68645-3db87573959f6f2c.js",
  "/_next/static/chunks/68689-50c9dd4e65cbb019.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/68792-2ff3086b4887ff08.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-dcbd81112abf1596.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71186-e2e494145961085c.js",
  "/_next/static/chunks/71187-698e72dc442e0368.js",
  "/_next/static/chunks/71288-865018a9ff192085.js",
  "/_next/static/chunks/74791-c3f610f8382296e6.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-7a7a1f5ac65836d0.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76078-769c534cbb2e4766.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/79297-828feebdccfee949.js",
  "/_next/static/chunks/79564-8105f153913a5a91.js",
  "/_next/static/chunks/79928-a4c904b352c66a68.js",
  "/_next/static/chunks/80137-a376634f6bee5d4c.js",
  "/_next/static/chunks/805-afd6955f4de4955a.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/82182-7ccde2b363979852.js",
  "/_next/static/chunks/8317-32b7dc27282c623f.js",
  "/_next/static/chunks/8382-7b8b1b2866055a08.js",
  "/_next/static/chunks/83891-b4f86c63cd4e7209.js",
  "/_next/static/chunks/84584-bdebc5f3eed19e08.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/85497-1fcc076d52015e75.js",
  "/_next/static/chunks/86480-6d1f37f43348a055.js",
  "/_next/static/chunks/86611-44c9438ef951db31.js",
  "/_next/static/chunks/87135-165b64127c326a1c.js",
  "/_next/static/chunks/87342-72ea4fbe01b4062f.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88087-a960b4f754f69975.js",
  "/_next/static/chunks/88470-60fd253f580ccef9.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-3e557e7186b5ff80.js",
  "/_next/static/chunks/88751-c323f07322c58860.js",
  "/_next/static/chunks/90378-7dab995d33ca3267.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/91445-b1767331c9c271e9.js",
  "/_next/static/chunks/91979-b3beba1c376bf9da.js",
  "/_next/static/chunks/92758-2306713be271c488.js",
  "/_next/static/chunks/93171-9688cbc95e8633b0.js",
  "/_next/static/chunks/94997-7115073b51bc81df.js",
  "/_next/static/chunks/95125-69d1051d31730985.js",
  "/_next/static/chunks/95858-e9efa3f0221115cf.js",
  "/_next/static/chunks/97825-4db850dd05bb0e8c.js",
  "/_next/static/chunks/98295-a2a6b0cdf6d8ca95.js",
  "/_next/static/chunks/98459-769c534cbb2e4766.js",
  "/_next/static/chunks/98710-c3c4c3c5bb30aa4f.js",
  "/_next/static/chunks/98723-74f03a3a15591194.js",
  "/_next/static/chunks/99341-2dc6a1d8766537c1.js",
  "/_next/static/chunks/99579-fd040988c7ffd330.js",
  "/_next/static/chunks/99707-7b43a77a6167bf66.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/(home)/page-2eb9f9cedf1c96cd.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-30310c51a7e24824.js",
  "/_next/static/chunks/app/[locale]/account/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/account/page-34874fe740e6e8e5.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/achievements/page-d7e82048e2a1a1d1.js",
  "/_next/static/chunks/app/[locale]/admin/announcements/page-da5c3065e9be5c1d.js",
  "/_next/static/chunks/app/[locale]/admin/auth-monitor/page-1251d162af546d02.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-c7b57f8455bad5e2.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-aa2dbe4e2b2b42f5.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-8123b06b22a2234e.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-d453a954e2d9bd1e.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-41ea4caf1212e00f.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-9e6e7ddd2f486aa9.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-5182a8547dd38c6f.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-da8f98ddb2fbf227.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-98273cdc3724d5f0.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-8e8d08cab450bbbc.js",
  "/_next/static/chunks/app/[locale]/admin/content-clicks/page-67f126fbfdbccf28.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-62df1f2c97945c3b.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-3553959fe68710a8.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/[id]/edit/page-031c967c1194c621.js",
  "/_next/static/chunks/app/[locale]/admin/email-templates/page-004175bd0e6fb4d6.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-d884ae4f39d73204.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-84d69382b986372b.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-49150e4f808f7b98.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-88e62cce5eeaaf93.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-c38a3d6a0b42dc73.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-d182f04d6fcdc16d.js",
  "/_next/static/chunks/app/[locale]/admin/layout-533812b4c3a970dd.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-dfb96c6894e5b637.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-b1f9136a133d5919.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-58860ac69199f34d.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-1b088a39bf58901b.js",
  "/_next/static/chunks/app/[locale]/admin/page-ffad4c66e36e7c4e.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-b420a99c147a4873.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-0d350626eb8a5c8e.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-f193bcc33e975f49.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-e353c35f54e277a8.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-70b0d3edbc7415f2.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-e6c4cd835aec0888.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-14789ad21397d527.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-5d418d2650b87013.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-af9ca8f088e90713.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-447ec0a9e4c8b8f8.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-1641806cb7a7cfa4.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-4b5751921fcadc45.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-c55cc1430dc16ca4.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-162c04a66fcada1f.js",
  "/_next/static/chunks/app/[locale]/admin/village-traffic/page-377d8ac412c82bdf.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-619f5989b92801a5.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-75a816a5172eb93a.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-9564dc4bb727bf2a.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-31b81616c5aa8701.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-51a7a1ed0369a1f4.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-ea57d543bc93f95f.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-18a6b7d0564ebed4.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-36c8559261f33684.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-4b00187e3958f091.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-3c7be65b56b1eb67.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-9303040263061bb2.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-59586a2460d71e7f.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-f56ceab9d6a595c9.js",
  "/_next/static/chunks/app/[locale]/blog/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/blog/page-39bbc1839208f2fc.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-4a099b83d3115c22.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-ad8b643519a4f49a.js",
  "/_next/static/chunks/app/[locale]/comics/page-8d7ed1efc604de99.js",
  "/_next/static/chunks/app/[locale]/contact/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/contact/page-4829d2ff48dce343.js",
  "/_next/static/chunks/app/[locale]/credits/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/credits/page-6194f75500954d74.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-6c2064712986b031.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-b269355e7bf2db78.js",
  "/_next/static/chunks/app/[locale]/drill/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/drill/page-fee30c62976610ec.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-649d20651aafa3fb.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-8124a88a3f1b9801.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-0fee52859033bf61.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-adc7b6d881ec4da8.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-ceacd5fa47e58366.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-c582a8d944bf9f3d.js",
  "/_next/static/chunks/app/[locale]/games/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/games/page-77a9e2cd063dc3de.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-15347dc5ded6da13.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-71367f8d295ff33b.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-51a34018a8d44329.js",
  "/_next/static/chunks/app/[locale]/intro/page-9861708e91183d6c.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-6e5bab035dbb1e17.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-37b53ec8d2d73463.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-5d1e12ec870bfa44.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-c41bd5a10c5aa0be.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-2330038132e15409.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-2e800b23f0ef1455.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-6a54e9aa0fb22b30.js",
  "/_next/static/chunks/app/[locale]/layout-752fddb46c6e3efe.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-243b797fd52f3d09.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-c5a102aae18bff1c.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-659c3d430b03b584.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-52de8f67ae6fd61e.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-366adcb0e80be051.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-43a96c025bf87aba.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-3c89162c79295430.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-9d53325545edd46c.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-dbee1dedb25be462.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-499be0f532b1e82e.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-11addc4eb41c2170.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-18c3e3284642f023.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-dadd73043d0b371d.js",
  "/_next/static/chunks/app/[locale]/library/page-7853502ee7f438d4.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-963cdf91fecff7b8.js",
  "/_next/static/chunks/app/[locale]/lists/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/lists/page-61388f364cd80ee8.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-a15ef3a736265301.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-de4f59173e89a4f6.js",
  "/_next/static/chunks/app/[locale]/news/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/news/page-434db3f36c780911.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-c87328a9d7228b7e.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-5411ba4072f21ba4.js",
  "/_next/static/chunks/app/[locale]/not-found-715d23df2e574b94.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-2219196f38a6829e.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-11ae8ad79b59291c.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-556e1d76045d4e1a.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-366adcb0e80be051.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-b1d5b96b5a216af7.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-2de8477cf4a64ca9.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-08c8db5bbf54981d.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-bbbb94801d35be43.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/pricing/page-849d7f7e25f4825a.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/privacy/page-0f5d138fbd01a660.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-39db1c5c3f443786.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-38702942b92681ba.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-713b84563ec8600b.js",
  "/_next/static/chunks/app/[locale]/resources/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/resources/page-1df1a93b705ccabd.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-1c0a5f5d833df820.js",
  "/_next/static/chunks/app/[locale]/review/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/review/page-366adcb0e80be051.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/review/session/page-b567f6263a8ecfa2.js",
  "/_next/static/chunks/app/[locale]/server-error/page-8c8465b3e0918e17.js",
  "/_next/static/chunks/app/[locale]/settings/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/settings/page-62078dd4af9b7d28.js",
  "/_next/static/chunks/app/[locale]/share/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/share/page-316f87be4db64a1c.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/showcase/page-2d19228330c0047c.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/statistics/page-68fa814ba10115b0.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-2a345ccec06ba06b.js",
  "/_next/static/chunks/app/[locale]/stories/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/stories/page-ad510dcae5ef06c7.js",
  "/_next/static/chunks/app/[locale]/terms/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/terms/page-55a3f63dfdf404c0.js",
  "/_next/static/chunks/app/[locale]/test-celebration/page-a5ecfaba21ba943d.js",
  "/_next/static/chunks/app/[locale]/test-email/page-e4db53da41a1542d.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-5b1a1ba6b0d4d75a.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-84b37e5a3f6ed98b.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-ae533b84f5f27822.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-e7bd05f753dc78d0.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-5e2f3c9836ced1cb.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-5a1a98189fd0631e.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-29436e6c8dbab317.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-4621d32e2ae118b8.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-68574f575aa5da43.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-2b13463f6e457e95.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-448d73d2e3a288e1.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-6b6c13b73612fa9e.js",
  "/_next/static/chunks/app/[locale]/todos/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/todos/page-c60809c3bc5c3ed4.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-ccce592841136878.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-227bcceb98b35bb6.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-42165aff36796c6d.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-0052691f530abd96.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-24c1d77af274b3aa.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-e0ff2dccdc6db465.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-1e392525769720ec.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-99779428249d1bc7.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-2d3a708874afec8c.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-a6d3a731f023ca8d.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-7c99ee11cf16f536.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-a7a94dbe2f841b56.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-ee792eea0c96804b.js",
  "/_next/static/chunks/app/_not-found/page-366adcb0e80be051.js",
  "/_next/static/chunks/app/email-previews/waitlist/page-57cfa96fc46a183f.js",
  "/_next/static/chunks/app/error-4a71e58e5f0bbef0.js",
  "/_next/static/chunks/app/global-error-88d6b733ea7a2c2a.js",
  "/_next/static/chunks/app/layout-7365b0ccc849d39a.js",
  "/_next/static/chunks/app/not-found-3afd4dbdef24c4c6.js",
  "/_next/static/chunks/e58627ac-e3d73c64776bb36b.js",
  "/_next/static/chunks/framework-f57887b72ce4232f.js",
  "/_next/static/chunks/main-app-699e1260b65ea725.js",
  "/_next/static/chunks/main-cd55c576c37ced5a.js",
  "/_next/static/chunks/pages/_app-f365312a4d2529fb.js",
  "/_next/static/chunks/pages/_error-ff431fa75c297bd3.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-b629b5474c4ceb86.js",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/9017952f9f4a7f70.css",
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
