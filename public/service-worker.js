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

const CACHE_VERSION = 'moshimoshi-4100a52ed608';
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
  "/_next/static/OdMDYW0vnneBQHnejOgI4/_buildManifest.js",
  "/_next/static/OdMDYW0vnneBQHnejOgI4/_ssgManifest.js",
  "/_next/static/chunks/10152-ef8441d3e4c2aca0.js",
  "/_next/static/chunks/1036-a680cf451ab48a19.js",
  "/_next/static/chunks/10409-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/10627-bcf644fe12302657.js",
  "/_next/static/chunks/11315-a216f345714f29e3.js",
  "/_next/static/chunks/11599-4a5c4d8758824797.js",
  "/_next/static/chunks/12309-8df4ba7801de0d6b.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/13523-fd15821c144a9307.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14673-e7741737d0d4eb68.js",
  "/_next/static/chunks/14777-1fb0b5e4dbe5bfe6.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/15341-ce89721ad9183bd3.js",
  "/_next/static/chunks/15361-9056bd6d4f47f1e4.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/16588-e452ffced9f807aa.js",
  "/_next/static/chunks/17401-141e014b66b5574e.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/20461-cbea971ba25d4726.js",
  "/_next/static/chunks/20541-0587e0cca425ed7a.js",
  "/_next/static/chunks/20840-769c534cbb2e4766.js",
  "/_next/static/chunks/21544-f208d151bf3276db.js",
  "/_next/static/chunks/21960-0a16a56a14db765a.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-2b7d70ae2c5a7b5f.js",
  "/_next/static/chunks/23868-20854aed872efc80.js",
  "/_next/static/chunks/23930-bb56d8a54b71cc4e.js",
  "/_next/static/chunks/24008-72c2cb5dad04e079.js",
  "/_next/static/chunks/24146-753abcb4dd26930a.js",
  "/_next/static/chunks/24366-09486c582bc045d2.js",
  "/_next/static/chunks/24495-2a5c5131197562f2.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25410-7df4cc370d951ab3.js",
  "/_next/static/chunks/25760-5a31a6708e5afa36.js",
  "/_next/static/chunks/26823-34c76b1d6c440283.js",
  "/_next/static/chunks/26909-a8fc83a439a20d66.js",
  "/_next/static/chunks/27183-39d671770276cc31.js",
  "/_next/static/chunks/27890-0e69a191b8463e87.js",
  "/_next/static/chunks/2964-788711f49d21cc2e.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/32477-49dba87e3f551115.js",
  "/_next/static/chunks/32790-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/33655-433799dea052d081.js",
  "/_next/static/chunks/34244-3385b88ff34de9fd.js",
  "/_next/static/chunks/35925-c3dbe8f5843da83e.js",
  "/_next/static/chunks/36996-6c3d4896f406779e.js",
  "/_next/static/chunks/37005-7144c80a4d480360.js",
  "/_next/static/chunks/37255-baecd0c8efb3e477.js",
  "/_next/static/chunks/37889-68492c8411229b55.js",
  "/_next/static/chunks/38151-7a2439b264d22aa5.js",
  "/_next/static/chunks/38402-5f8494d838d9d457.js",
  "/_next/static/chunks/38477-54e41718040f84cf.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/40619-b66e7853369f8923.js",
  "/_next/static/chunks/41615-a07c61b990eb008d.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/43197-6002b5f2f37837a7.js",
  "/_next/static/chunks/44597-a698d0b129d1dd92.js",
  "/_next/static/chunks/45001-1d6797dc52d563c5.js",
  "/_next/static/chunks/45119-5ef32194b4e87e5a.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-04d89b9120557c53.js",
  "/_next/static/chunks/46693-a3b5904bc1087d7f.js",
  "/_next/static/chunks/46788-05519c496080b0c3.js",
  "/_next/static/chunks/49882-9a836a5347a47a9a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50443-355a4ea1282114fa.js",
  "/_next/static/chunks/52311-5da5889dc103ae82.js",
  "/_next/static/chunks/52413-1421dc014ea61920.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53005-537433508e12a878.js",
  "/_next/static/chunks/53348-e5eee7cd33aec827.js",
  "/_next/static/chunks/53697-769c534cbb2e4766.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-0148078f5edea993.js",
  "/_next/static/chunks/54469-a7347a4509cfaceb.js",
  "/_next/static/chunks/54a60aa6-fde3c27555179f9b.js",
  "/_next/static/chunks/56036-433799dea052d081.js",
  "/_next/static/chunks/56526-8dbb70d9d12f58b9.js",
  "/_next/static/chunks/56649-94717f36c93e31de.js",
  "/_next/static/chunks/57292-0fc48d43026e13a1.js",
  "/_next/static/chunks/57578-63879888138aead8.js",
  "/_next/static/chunks/58126-2fbfb092029e48ea.js",
  "/_next/static/chunks/5832-10c8d4e935dce849.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-7144c80a4d480360.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-94575a6e0e50b932.js",
  "/_next/static/chunks/61203-dfa7584a2304b573.js",
  "/_next/static/chunks/61324-ee1311648d71fe5a.js",
  "/_next/static/chunks/62310-8d3114cfda636653.js",
  "/_next/static/chunks/63134-17444764ecd4cb92.js",
  "/_next/static/chunks/63140-a7e3d0da43b48780.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/64719-aeaa1e31026757b5.js",
  "/_next/static/chunks/64961-72ea4fbe01b4062f.js",
  "/_next/static/chunks/68645-3db87573959f6f2c.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69294-dcbd81112abf1596.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/71186-e2e494145961085c.js",
  "/_next/static/chunks/74233-978195f3f23478cc.js",
  "/_next/static/chunks/7439-2cfbd68761add394.js",
  "/_next/static/chunks/74467-3f2947e39dc176c7.js",
  "/_next/static/chunks/74586-d6615e945aa18ea6.js",
  "/_next/static/chunks/74791-338ece3ab04b5cf0.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-7a7a1f5ac65836d0.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76078-769c534cbb2e4766.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/79297-7ec92f3c39cf4e03.js",
  "/_next/static/chunks/80137-a376634f6bee5d4c.js",
  "/_next/static/chunks/80314-ce791ca26fc6f229.js",
  "/_next/static/chunks/805-b790e7924fb3beaa.js",
  "/_next/static/chunks/80750-b916f9994ac27540.js",
  "/_next/static/chunks/8079-4954e6da50e31312.js",
  "/_next/static/chunks/80853-2c50f9f855b9eb67.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/82182-987957df4aeb3cde.js",
  "/_next/static/chunks/83057-f1744d8c1bb4d748.js",
  "/_next/static/chunks/8382-2b7d70ae2c5a7b5f.js",
  "/_next/static/chunks/84584-bdebc5f3eed19e08.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/86412-0bc8bdc1e6aaa118.js",
  "/_next/static/chunks/86480-d1f51a909755b942.js",
  "/_next/static/chunks/87135-165b64127c326a1c.js",
  "/_next/static/chunks/87342-72ea4fbe01b4062f.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88087-9c5ce31e50b4119b.js",
  "/_next/static/chunks/88470-5899a6a387eefc6a.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-3e557e7186b5ff80.js",
  "/_next/static/chunks/88751-c323f07322c58860.js",
  "/_next/static/chunks/90378-7dab995d33ca3267.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/90909-5417a68ce2e859cc.js",
  "/_next/static/chunks/91445-b1767331c9c271e9.js",
  "/_next/static/chunks/92758-2306713be271c488.js",
  "/_next/static/chunks/94997-6586e7bf409d833b.js",
  "/_next/static/chunks/97125-785dbbe18d161138.js",
  "/_next/static/chunks/97627-b15d88a15f0d2da3.js",
  "/_next/static/chunks/98459-769c534cbb2e4766.js",
  "/_next/static/chunks/98698-fe89575a2f06e830.js",
  "/_next/static/chunks/99341-2dc6a1d8766537c1.js",
  "/_next/static/chunks/99579-0a16a56a14db765a.js",
  "/_next/static/chunks/99707-7b43a77a6167bf66.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/(home)/page-ae8d952946e74d74.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-a0c2aa8ae8e321ba.js",
  "/_next/static/chunks/app/[locale]/account/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/account/page-7e0deb2dd5682852.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/achievements/page-1c88aa2412149dff.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-53b125a5bdd28db5.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-f866075694314958.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-aade73387aa427e7.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-2e5d477ad11bd81f.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-243d3cf22844b430.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-934478fb09a1f946.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-938174e70e44bc71.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-822d078691e9ca1e.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-de1ccee15aeb0b41.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-d176d685df066c9f.js",
  "/_next/static/chunks/app/[locale]/admin/content-clicks/page-08444d7a55c63f47.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-e29ca3c575cad228.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-5b46e16c31ba347c.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-30dab7c87add07cb.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-9dab5baac60406fb.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-a996ba0918c59d30.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-e3b3c8240a8d8cdf.js",
  "/_next/static/chunks/app/[locale]/admin/grammar-stall/page-93136f9b902d0ee7.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-65f59f8b4b75c5d7.js",
  "/_next/static/chunks/app/[locale]/admin/layout-dc21bf4c014ad873.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-9a8288a055520236.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-14e329ab364ed2d2.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-f3a621cb3dd19915.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-68624146b198c224.js",
  "/_next/static/chunks/app/[locale]/admin/page-d3590dc9b6bbe4b8.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-9868b016fc277d47.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-2eb8ce6871d35f73.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-0d2779fb349fdc39.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-4911bb81ec616fbb.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-427e8a39db56a3df.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-e0ed5669c408786f.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-22e9e78d2ff5e4f0.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-410e1871e0602bcc.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-2ee6765ca1c5eb61.js",
  "/_next/static/chunks/app/[locale]/admin/stories/validate/page-bbafdb8e8767f6c4.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-cfc587b9a5ec4a21.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-ce0d86e36378f02a.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-5023f34239c78004.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-98dc08d78f942946.js",
  "/_next/static/chunks/app/[locale]/admin/village-traffic/page-2e73f8ddb36d46ac.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-dc4f82d74eba4a9d.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-d24c68bbe141d0ce.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-5a51dd787cb81e37.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-4e2b7fd4104ec5e0.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-b725d6ad941d9c69.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-060ac01fd685b0a2.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-0768b385feecdcf4.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-d5f8ac0e25c5a181.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-4ca4b697347c0948.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-e8921802245d543f.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-c56d4d072365ca92.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-85efb852bc5881c1.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-00f32af6f2e3a3ee.js",
  "/_next/static/chunks/app/[locale]/blog/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/blog/page-8501f7aa973e352a.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-00e1e501e2f73232.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-73943af3f8a85020.js",
  "/_next/static/chunks/app/[locale]/comics/page-c26c153d9f150189.js",
  "/_next/static/chunks/app/[locale]/contact/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/contact/page-1196e8700cdbc7bb.js",
  "/_next/static/chunks/app/[locale]/credits/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/credits/page-ef690843616771f0.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-a79de855ef09ea13.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-aeacfdf67fbdd523.js",
  "/_next/static/chunks/app/[locale]/drill/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/drill/page-534095b2f029ba4d.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-fe7c97d201ebdcf5.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-e6e857ab1abc1ba4.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-fff17206463a6257.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-3a512a6df29f32b9.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-0e9d8a9641dbaa84.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-541c75d392d8dab5.js",
  "/_next/static/chunks/app/[locale]/games/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/page-9de648d57818f701.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-46f1a4c2fd684d17.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-d46644ea422fcfc1.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-474184679f70dd0c.js",
  "/_next/static/chunks/app/[locale]/intro/page-64fba16c62dfa71c.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-e886b8d18fc5d445.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-5287dccba9576d16.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-3f861e98b378402a.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-d7655100f3840ae7.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-3ffb10a07bc6b05d.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-2b6671265e6774ae.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-5b1d3af80214a372.js",
  "/_next/static/chunks/app/[locale]/layout-4ecb89cc34231554.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-7f08961df9e2ea10.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-658869f44d66a380.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/page-a1bfbdbbd3616aa3.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/[pointId]/practice/page-8c2e5c2751f95cc7.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/layout-972a2393a5b165d2.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/n4/page-8f914dc1019e6028.js",
  "/_next/static/chunks/app/[locale]/learn/grammar/page-47f05a64fd6d8aeb.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-c2372941f7df9ec2.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-21203b7b2a8f9a10.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-b46b37d8ff06357d.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-9d857eee36c87b6b.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-a5686dcd21fcbcf9.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-8a033560da9b22ad.js",
  "/_next/static/chunks/app/[locale]/library/page-907ca247643fb63a.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-8feebfc874915de4.js",
  "/_next/static/chunks/app/[locale]/lists/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/lists/page-753b4d53df919ce2.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-ab3200a3c1b6f1fc.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-3b4983688657f582.js",
  "/_next/static/chunks/app/[locale]/news/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/news/page-fe1181478d759172.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-338ed5c8418ca674.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-185df0c72c39a800.js",
  "/_next/static/chunks/app/[locale]/not-found-eec993b8731aab90.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-56b86562e03f216a.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-3a3649e4027f6216.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-db5641cf5044d4cd.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-972a2393a5b165d2.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-7c2cc622f410a9f1.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-1f6483655429fe43.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-2c3a9cae385b446a.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-9b9811da756706b7.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/pricing/page-e6b40fb965c06672.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/privacy/page-c63e6a05de2978b2.js",
  "/_next/static/chunks/app/[locale]/pwa-diagnostics/page-7a28663a800f23a9.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-1cc5a3919c668eef.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-707f7de6d4dd7701.js",
  "/_next/static/chunks/app/[locale]/resources/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/resources/page-d506adc6e801d82a.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-2faef21cfff68bf4.js",
  "/_next/static/chunks/app/[locale]/review/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review/page-972a2393a5b165d2.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/review/session/page-3faf20ecc917f746.js",
  "/_next/static/chunks/app/[locale]/server-error/page-0724ff66ee8396f6.js",
  "/_next/static/chunks/app/[locale]/settings/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/settings/page-042229681468be2f.js",
  "/_next/static/chunks/app/[locale]/share/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/share/page-f0b1aeee37ad0eec.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/showcase/page-478d57f1b0dd69ce.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/statistics/page-288cdf8d1cd11b7e.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-050882aaa8e98507.js",
  "/_next/static/chunks/app/[locale]/stories/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/stories/page-4b3b66ff74539051.js",
  "/_next/static/chunks/app/[locale]/terms/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/terms/page-faf16f6c1fa4273d.js",
  "/_next/static/chunks/app/[locale]/test-celebration/page-05c164319ff6007a.js",
  "/_next/static/chunks/app/[locale]/test-email/page-22d28f9393a37067.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-212edacc2d01d030.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-f86e78678c403a95.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-f78117ae9ed2a83d.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-090da8b2d223abe3.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-cb83f872070e4d41.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-23ca344c6acd61ee.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-1a1b374468099b3f.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-1f9c55c1460ad558.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-7d98fd2c1060089d.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-7ecaa5dfbe4e3067.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-25e96cc2003eea30.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-fc49cecb57abadac.js",
  "/_next/static/chunks/app/[locale]/todos/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/todos/page-864f0247bb5be421.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-486d64b6a6ffffff.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-5a138b8536c89463.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-95e741e603b50e96.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-27265c81b947a50d.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-e5b53e93e9f05922.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-37f23811729c778f.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-6b0ba0e116383d96.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-553ae415f9538279.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-f3b503c832290976.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-94dd0a93b480891f.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-156e9eac4aeab381.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-d2d0d06b87ef6ae3.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-f4072067a5fa93f4.js",
  "/_next/static/chunks/app/_not-found/page-972a2393a5b165d2.js",
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
  "/_next/static/chunks/webpack-4eceddb4e958ec60.js",
  "/_next/static/css/43958bad23cd245f.css",
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
