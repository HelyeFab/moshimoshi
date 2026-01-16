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

const CACHE_VERSION = 'moshimoshi-c4725658b817';
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
  "/_next/static/chunks/10152-ce5cb8b0f37c62a2.js",
  "/_next/static/chunks/10194-e73b4ae0755f46bf.js",
  "/_next/static/chunks/10409-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/10627-396235919220cf3a.js",
  "/_next/static/chunks/11599-e986443a5e668d37.js",
  "/_next/static/chunks/12435-bf58e778fff44c0c.js",
  "/_next/static/chunks/12497-b5e9ac73f8b8bd2c.js",
  "/_next/static/chunks/12622-e3835f8101160b12.js",
  "/_next/static/chunks/12899-d86baf79ef36c2af.js",
  "/_next/static/chunks/13523-fd15821c144a9307.js",
  "/_next/static/chunks/14395-94a95db46de12db8.js",
  "/_next/static/chunks/1452-6475f485ffaa79be.js",
  "/_next/static/chunks/14777-519d0e9b10e6b729.js",
  "/_next/static/chunks/15239-fe082bf828cd2872.js",
  "/_next/static/chunks/15361-9056bd6d4f47f1e4.js",
  "/_next/static/chunks/16474-b665afb3f9c3f3b0.js",
  "/_next/static/chunks/19075-fdcb55410bfcfd6d.js",
  "/_next/static/chunks/19406-f7bb48e86926b2fb.js",
  "/_next/static/chunks/20461-cbea971ba25d4726.js",
  "/_next/static/chunks/20554-c6b7d5a59f66ff79.js",
  "/_next/static/chunks/20840-d72d5c335f7c40bc.js",
  "/_next/static/chunks/21474-6fa30a8b114b9dc1.js",
  "/_next/static/chunks/21544-a8f0b60cb83afb43.js",
  "/_next/static/chunks/22678-b71fd125fc153f87.js",
  "/_next/static/chunks/23180-b7f2926028221d98.js",
  "/_next/static/chunks/2353-f7480e9567d150b8.js",
  "/_next/static/chunks/23868-265ec8dce87653b4.js",
  "/_next/static/chunks/23930-b7fde159df4d447e.js",
  "/_next/static/chunks/24146-3c5faee6bd4acfd2.js",
  "/_next/static/chunks/24366-79a6a6e781a39914.js",
  "/_next/static/chunks/24909-e6034bdbe90d1a47.js",
  "/_next/static/chunks/25410-7df4cc370d951ab3.js",
  "/_next/static/chunks/26823-dc133f301c3ded03.js",
  "/_next/static/chunks/27183-3d6fec5d22557a17.js",
  "/_next/static/chunks/27890-5574533d48c8132a.js",
  "/_next/static/chunks/28278-9bcc0397dc13c059.js",
  "/_next/static/chunks/29558-3d894dc98fd81df0.js",
  "/_next/static/chunks/30827-bf46b8bd335575cc.js",
  "/_next/static/chunks/31255-2b43ea3d000ae5cf.js",
  "/_next/static/chunks/31949-24e6805fad57aa9a.js",
  "/_next/static/chunks/32790-6d4e4d0c8b82e5c5.js",
  "/_next/static/chunks/33316-7e5bd5eaa451ba2b.js",
  "/_next/static/chunks/34244-625aae32c784d13d.js",
  "/_next/static/chunks/35925-9ef41eca727c630e.js",
  "/_next/static/chunks/37005-8b4610f027540d23.js",
  "/_next/static/chunks/37255-5cf20eddb3387839.js",
  "/_next/static/chunks/3783-6fab11f794e20472.js",
  "/_next/static/chunks/38017-20c374fea69b3c9c.js",
  "/_next/static/chunks/38151-c5ba4ea22a434063.js",
  "/_next/static/chunks/39035-455c41cf78dcd6ad.js",
  "/_next/static/chunks/39186-ee4d0c149c92e1e2.js",
  "/_next/static/chunks/40031-192c9a70c40b89b9.js",
  "/_next/static/chunks/4164-4d3a9fe77c657fb1.js",
  "/_next/static/chunks/43952-2a78232b5e4574d3.js",
  "/_next/static/chunks/45119-5ef32194b4e87e5a.js",
  "/_next/static/chunks/45405-19b235bed20d58b6.js",
  "/_next/static/chunks/4586-609151be89639177.js",
  "/_next/static/chunks/46693-9fdcdf28acd12b95.js",
  "/_next/static/chunks/46875-2128efea6bb8f84d.js",
  "/_next/static/chunks/46982-fbece33f6554bf27.js",
  "/_next/static/chunks/49483-247923524eb943b9.js",
  "/_next/static/chunks/49882-9a836a5347a47a9a.js",
  "/_next/static/chunks/4bd1b696-2135e4d8b8354323.js",
  "/_next/static/chunks/50443-56e61b140c52d8dc.js",
  "/_next/static/chunks/52068-cdd3b2b8210acc78.js",
  "/_next/static/chunks/52084-f8d19be1067b7f28.js",
  "/_next/static/chunks/52413-483d77342fc9ed10.js",
  "/_next/static/chunks/52619-f2cabc0d7be67480.js",
  "/_next/static/chunks/53697-d72d5c335f7c40bc.js",
  "/_next/static/chunks/53799-478beaa6da9e62c7.js",
  "/_next/static/chunks/53807-893f17a452e831fb.js",
  "/_next/static/chunks/5441-887df823fd4c1a80.js",
  "/_next/static/chunks/54469-80a2f9dda48676d7.js",
  "/_next/static/chunks/54a60aa6-fde3c27555179f9b.js",
  "/_next/static/chunks/55487-4e448bfad9ce7d0f.js",
  "/_next/static/chunks/56526-9bf5f8683f783b8d.js",
  "/_next/static/chunks/57292-d8131e72761ce81a.js",
  "/_next/static/chunks/58448-e458de2a0b325839.js",
  "/_next/static/chunks/59386-8b4610f027540d23.js",
  "/_next/static/chunks/59717-b00e443af50515df.js",
  "/_next/static/chunks/5b86099a-94575a6e0e50b932.js",
  "/_next/static/chunks/61324-ee1311648d71fe5a.js",
  "/_next/static/chunks/61807-4ee603fe66543ac9.js",
  "/_next/static/chunks/62241-035b5f9a9f90d5c8.js",
  "/_next/static/chunks/62748-8560821a94448a5e.js",
  "/_next/static/chunks/63134-17444764ecd4cb92.js",
  "/_next/static/chunks/63140-a7e3d0da43b48780.js",
  "/_next/static/chunks/63436-1513aad4a9c40114.js",
  "/_next/static/chunks/6350-c29a9620a1d06367.js",
  "/_next/static/chunks/64445-9aaa11589ddf0e34.js",
  "/_next/static/chunks/68157-796c422c0ff0278c.js",
  "/_next/static/chunks/68727-9c10895e89df7dac.js",
  "/_next/static/chunks/68781-b1148ea5d433332f.js",
  "/_next/static/chunks/69000-b063f7123f3e8d25.js",
  "/_next/static/chunks/69256-2128efea6bb8f84d.js",
  "/_next/static/chunks/69294-96061b07d5c31b05.js",
  "/_next/static/chunks/70e0d97a-589a37b07df0bca7.js",
  "/_next/static/chunks/72253-b0adda0c6c31eabb.js",
  "/_next/static/chunks/72917-a2f61205aeed25cf.js",
  "/_next/static/chunks/73372-f8e01f3785e2cbdd.js",
  "/_next/static/chunks/73766-92912bf2c0ae9fcd.js",
  "/_next/static/chunks/74586-d6615e945aa18ea6.js",
  "/_next/static/chunks/74791-811ab311db3f91fb.js",
  "/_next/static/chunks/7508b87c-b1919550f138b567.js",
  "/_next/static/chunks/75359-504d79a2531d0d88.js",
  "/_next/static/chunks/7580-b4f13c0bc8b31ffe.js",
  "/_next/static/chunks/75961-c7445895221b04f0.js",
  "/_next/static/chunks/76078-d72d5c335f7c40bc.js",
  "/_next/static/chunks/76462-f34c7f2ebb954e08.js",
  "/_next/static/chunks/77572-943d9dc7ed8fde41.js",
  "/_next/static/chunks/77804-3cd51be2c62fb45c.js",
  "/_next/static/chunks/79297-1889737bfab1aa21.js",
  "/_next/static/chunks/805-b790e7924fb3beaa.js",
  "/_next/static/chunks/80692-c36fc609abab09a9.js",
  "/_next/static/chunks/8079-d95ff85cf6afd80f.js",
  "/_next/static/chunks/80853-74ccce1e7d13e14e.js",
  "/_next/static/chunks/81029-b57e3d08425b1a3a.js",
  "/_next/static/chunks/81075-518adf0097c246f2.js",
  "/_next/static/chunks/82182-b244022eed4bcc2f.js",
  "/_next/static/chunks/83057-f1744d8c1bb4d748.js",
  "/_next/static/chunks/8382-f7480e9567d150b8.js",
  "/_next/static/chunks/84584-362b7b6c9580d167.js",
  "/_next/static/chunks/85361-0e7684f50440b44f.js",
  "/_next/static/chunks/85911-50fe5721183489ff.js",
  "/_next/static/chunks/86981-c7b0984985a7fe38.js",
  "/_next/static/chunks/87135-4ac84e87ff9e7824.js",
  "/_next/static/chunks/87998-a4773ef7a91106b9.js",
  "/_next/static/chunks/88087-69029424f7c77388.js",
  "/_next/static/chunks/88470-5899a6a387eefc6a.js",
  "/_next/static/chunks/88684-29138f6ae24b421b.js",
  "/_next/static/chunks/88739-e66bdfba72b3be0c.js",
  "/_next/static/chunks/88751-c323f07322c58860.js",
  "/_next/static/chunks/89223-9348dee26f44d2eb.js",
  "/_next/static/chunks/90878-8883a03b10c0ed3f.js",
  "/_next/static/chunks/90909-5417a68ce2e859cc.js",
  "/_next/static/chunks/91445-b1767331c9c271e9.js",
  "/_next/static/chunks/92758-d10552e41edd32e9.js",
  "/_next/static/chunks/93138-1c2ac3127f197672.js",
  "/_next/static/chunks/93463-310649cfb1ae0895.js",
  "/_next/static/chunks/94733-627e84c5b4dc29dd.js",
  "/_next/static/chunks/94997-4c87fadd09656737.js",
  "/_next/static/chunks/9512-02b48f115046beb8.js",
  "/_next/static/chunks/96909-cb842d1e199e0806.js",
  "/_next/static/chunks/97627-b15d88a15f0d2da3.js",
  "/_next/static/chunks/98459-d72d5c335f7c40bc.js",
  "/_next/static/chunks/98698-fe89575a2f06e830.js",
  "/_next/static/chunks/99341-5bb921ca23fd36e3.js",
  "/_next/static/chunks/99579-d5b8b10ca3499ac2.js",
  "/_next/static/chunks/99707-eb12c0f46a0a7f84.js",
  "/_next/static/chunks/9c4e2130-9af91afdfe80adac.js",
  "/_next/static/chunks/a4634e51-fadde5bb5e34f614.js",
  "/_next/static/chunks/app/[locale]/(home)/layout-74b849589c0cfcbf.js",
  "/_next/static/chunks/app/[locale]/(home)/page-9dcc4597a7fbd108.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/(public)/landing/page-4f3004498ef83429.js",
  "/_next/static/chunks/app/[locale]/account/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/account/page-5a3053daa9d9ea2b.js",
  "/_next/static/chunks/app/[locale]/achievements/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/achievements/page-dc3b17972bfd281f.js",
  "/_next/static/chunks/app/[locale]/admin/blog/[id]/edit/page-485e79fcf51623f7.js",
  "/_next/static/chunks/app/[locale]/admin/blog/new/page-5a5864360de80faf.js",
  "/_next/static/chunks/app/[locale]/admin/blog/page-b7d64e3dbd4180cc.js",
  "/_next/static/chunks/app/[locale]/admin/books/edit/[id]/page-b5bddb57d4740881.js",
  "/_next/static/chunks/app/[locale]/admin/books/generate/page-0192d45ec5c6d5b7.js",
  "/_next/static/chunks/app/[locale]/admin/books/page-218bae07cd4df481.js",
  "/_next/static/chunks/app/[locale]/admin/comics/[episodeId]/edit/page-39f81eeeddbabb4f.js",
  "/_next/static/chunks/app/[locale]/admin/comics/generate/page-a9ed47ccbf18c4eb.js",
  "/_next/static/chunks/app/[locale]/admin/comics/page-c1ef8e7f5af9d046.js",
  "/_next/static/chunks/app/[locale]/admin/comics/schedule/page-2f62a9f4a6d13c89.js",
  "/_next/static/chunks/app/[locale]/admin/decision-explorer/page-5d1fc2eea8aa66b7.js",
  "/_next/static/chunks/app/[locale]/admin/email-campaigns/page-25bdb21010ddb28a.js",
  "/_next/static/chunks/app/[locale]/admin/entitlements/page-bf1157fc2711ccc9.js",
  "/_next/static/chunks/app/[locale]/admin/feature-flags/page-5335acb24c77a1e2.js",
  "/_next/static/chunks/app/[locale]/admin/firebase-monitoring/page-fb7859096a681364.js",
  "/_next/static/chunks/app/[locale]/admin/gamification-xp-config/page-a96e12acbe91465b.js",
  "/_next/static/chunks/app/[locale]/admin/integrity-monitor/page-1a1d1e2caf34ca31.js",
  "/_next/static/chunks/app/[locale]/admin/layout-c42b52413419b705.js",
  "/_next/static/chunks/app/[locale]/admin/leaderboard/page-3ba1927e9d2316c7.js",
  "/_next/static/chunks/app/[locale]/admin/learning-village/page-fbdfb39756721976.js",
  "/_next/static/chunks/app/[locale]/admin/monitoring/page-fcdd5b7eb278442f.js",
  "/_next/static/chunks/app/[locale]/admin/moodboards/page-20c9087f6a776f9b.js",
  "/_next/static/chunks/app/[locale]/admin/page-7978577fb95d66c7.js",
  "/_next/static/chunks/app/[locale]/admin/resources/[id]/edit/page-1929f26b0cfe9385.js",
  "/_next/static/chunks/app/[locale]/admin/resources/new/page-f6ad4d8cccc299cc.js",
  "/_next/static/chunks/app/[locale]/admin/resources/page-a62da16294bede5a.js",
  "/_next/static/chunks/app/[locale]/admin/scripts/page-e454be8e5fa75588.js",
  "/_next/static/chunks/app/[locale]/admin/stats-consistency/page-3eafe5c23533a0c2.js",
  "/_next/static/chunks/app/[locale]/admin/stories/edit/[id]/page-55411f24eff2d76a.js",
  "/_next/static/chunks/app/[locale]/admin/stories/generate/page-e8b6bf80f058d77a.js",
  "/_next/static/chunks/app/[locale]/admin/stories/new/page-aafbb14b481f5ef5.js",
  "/_next/static/chunks/app/[locale]/admin/stories/page-2336149ef2733abf.js",
  "/_next/static/chunks/app/[locale]/admin/streak/page-76be5d5349b57b4a.js",
  "/_next/static/chunks/app/[locale]/admin/stripe-testing/page-55fd77801338fb94.js",
  "/_next/static/chunks/app/[locale]/admin/subscriptions/page-1bb3e66c1a046cd7.js",
  "/_next/static/chunks/app/[locale]/admin/user-lookup/page-dbd8a098b44f2ad3.js",
  "/_next/static/chunks/app/[locale]/admin/xp-config/page-9f942272f069d31b.js",
  "/_next/static/chunks/app/[locale]/admin/youtube-series/page-ae5050747e5869c2.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/anki-study/[deckId]/page-e12a53c8a958f3bb.js",
  "/_next/static/chunks/app/[locale]/auth-test/page-838053b53c6dcfc1.js",
  "/_next/static/chunks/app/[locale]/auth/action/page-3e6d702863b8183c.js",
  "/_next/static/chunks/app/[locale]/auth/error/page-7aa7eacfd15f4fa8.js",
  "/_next/static/chunks/app/[locale]/auth/reset-password/page-2b3628b03ce6220f.js",
  "/_next/static/chunks/app/[locale]/auth/signin/page-e29afc0de76a9a7b.js",
  "/_next/static/chunks/app/[locale]/auth/signup/page-b4552cdb06b8709c.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-error/page-8c711f00dba17e5e.js",
  "/_next/static/chunks/app/[locale]/auth/verify-email-success/page-7dc859e64983db58.js",
  "/_next/static/chunks/app/[locale]/auth/verify-magic-link/page-333a593e92ed6785.js",
  "/_next/static/chunks/app/[locale]/blog/[slug]/page-24186641013c63a9.js",
  "/_next/static/chunks/app/[locale]/blog/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/blog/page-6c97f7860df71e34.js",
  "/_next/static/chunks/app/[locale]/clear-storage/page-9d180204b0be37bf.js",
  "/_next/static/chunks/app/[locale]/comics/[episodeId]/page-39241bb95d12b24c.js",
  "/_next/static/chunks/app/[locale]/comics/page-5f43d4e7297516b8.js",
  "/_next/static/chunks/app/[locale]/contact/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/contact/page-092e0a3fa2a16c96.js",
  "/_next/static/chunks/app/[locale]/credits/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/credits/page-0faed0678249edb2.js",
  "/_next/static/chunks/app/[locale]/dashboard/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/dashboard/page-0a61bc36d630da47.js",
  "/_next/static/chunks/app/[locale]/demo/nhk/page-561804948b54ad16.js",
  "/_next/static/chunks/app/[locale]/drill/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/drill/page-11e8b73832f89bee.js",
  "/_next/static/chunks/app/[locale]/flashcards/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/flashcards/page-af8f709014d4ed5c.js",
  "/_next/static/chunks/app/[locale]/flashcards/restore/page-f7d0340471f2e167.js",
  "/_next/static/chunks/app/[locale]/forbidden/page-9819660d1a4293ce.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/games/kana-drop/page-bda49a28a4bd17df.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/[boardId]/page-87365c1b9d0c82c6.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/games/kanji-simon/page-421adbf78769d23e.js",
  "/_next/static/chunks/app/[locale]/games/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/games/page-0ca5fb6ae3027eb9.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/games/reading-routes/page-aa2a3849969d7562.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/games/sentence-scramble/page-46a8891aa6388fcc.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/games/stroke-order/page-b0e9f1b10319f7fc.js",
  "/_next/static/chunks/app/[locale]/intro/page-ae8a315b8c9a7a13.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/kanji-browser/page-96a2133e83fff4e2.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/families/page-38b9e2ffcb24398f.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/page-b7bd30226e454f9f.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/radicals/page-f093b956c2f2b9ea.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/kanji-connection/visual-layout/page-99cadce490c4f824.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/[boardId]/page-435fc1ef1df24674.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/kanji-moods/page-ea62390a0456aef2.js",
  "/_next/static/chunks/app/[locale]/layout-376b178f8de478e1.js",
  "/_next/static/chunks/app/[locale]/leaderboard/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/leaderboard/page-14729aa4cbfba9ca.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/learn/conjugation/page-10d633e080c61377.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/learn/hiragana/page-0e377be9d0e7ff7e.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/learn/katakana/page-47b2905639970d07.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/complete/page-89d72ef914ca4d8c.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/page-7e9a7fc9e26458a9.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/learn/word-learning/session/page-179820ef9ef3dfa7.js",
  "/_next/static/chunks/app/[locale]/library/[id]/page-d04cb912fa3f4b50.js",
  "/_next/static/chunks/app/[locale]/library/page-017e0004ef80fd05.js",
  "/_next/static/chunks/app/[locale]/lists/[listId]/page-1e1e7ad6c91ab1e2.js",
  "/_next/static/chunks/app/[locale]/lists/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/lists/page-21a7da12b8d56790.js",
  "/_next/static/chunks/app/[locale]/my-videos/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/my-videos/page-4850931c9634d99a.js",
  "/_next/static/chunks/app/[locale]/news/[id]/page-b9f8fc21a9be171d.js",
  "/_next/static/chunks/app/[locale]/news/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/news/page-601da4bc1dae6f93.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-error/page-90af254991881db6.js",
  "/_next/static/chunks/app/[locale]/newsletter/verify-success/page-c469d362479eed05.js",
  "/_next/static/chunks/app/[locale]/not-found-37388fbf00aaa050.js",
  "/_next/static/chunks/app/[locale]/notifications-demo/page-58bf25cd30c795cd.js",
  "/_next/static/chunks/app/[locale]/onboarding/experience-level/page-cb2b25f641aa1914.js",
  "/_next/static/chunks/app/[locale]/onboarding/feature-showcase/page-9cef68208e3a88cb.js",
  "/_next/static/chunks/app/[locale]/onboarding/layout-74b849589c0cfcbf.js",
  "/_next/static/chunks/app/[locale]/onboarding/learning-goal/page-b7867bc9dc09d301.js",
  "/_next/static/chunks/app/[locale]/onboarding/page-4447006b256fb6ad.js",
  "/_next/static/chunks/app/[locale]/onboarding/ready-to-go/page-894ab849768899ee.js",
  "/_next/static/chunks/app/[locale]/popular-videos/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/popular-videos/page-ece90fa194684f72.js",
  "/_next/static/chunks/app/[locale]/pricing/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/pricing/page-29e891f2be367c5a.js",
  "/_next/static/chunks/app/[locale]/privacy/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/privacy/page-83eabcf3057bd0c1.js",
  "/_next/static/chunks/app/[locale]/reset-password/page-e0bbb4cc87154762.js",
  "/_next/static/chunks/app/[locale]/resources/[id]/page-37971b748a430a53.js",
  "/_next/static/chunks/app/[locale]/resources/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/resources/page-940a5fdf461b0baf.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/review-dashboard/page-d801158fa054c638.js",
  "/_next/static/chunks/app/[locale]/review/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/review/page-74b849589c0cfcbf.js",
  "/_next/static/chunks/app/[locale]/review/session/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/review/session/page-1b99267e0bdd9eed.js",
  "/_next/static/chunks/app/[locale]/server-error/page-5b982c80b88c404e.js",
  "/_next/static/chunks/app/[locale]/settings/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/settings/page-dfa2869562868114.js",
  "/_next/static/chunks/app/[locale]/share/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/share/page-26ab43d12108f5d2.js",
  "/_next/static/chunks/app/[locale]/showcase/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/showcase/page-fef2684fb5b1add3.js",
  "/_next/static/chunks/app/[locale]/statistics/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/statistics/page-c2d9b3fedc535d39.js",
  "/_next/static/chunks/app/[locale]/stories/[slug]/page-93419667f9d8b7e2.js",
  "/_next/static/chunks/app/[locale]/stories/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/stories/page-6708ff31c8af84de.js",
  "/_next/static/chunks/app/[locale]/terms/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/terms/page-a70ae4ca0a789c61.js",
  "/_next/static/chunks/app/[locale]/test-email/page-ede50d39463ec693.js",
  "/_next/static/chunks/app/[locale]/test-entitlements/page-4fee2722c1e483b8.js",
  "/_next/static/chunks/app/[locale]/test-flashcards/page-1cb5dbdd27836cf2.js",
  "/_next/static/chunks/app/[locale]/test-furigana/page-02f73c1d8c80c0dc.js",
  "/_next/static/chunks/app/[locale]/test-install-toast/page-c6326d92eed81e18.js",
  "/_next/static/chunks/app/[locale]/test-limits-display/page-4fa7d47fa1535be2.js",
  "/_next/static/chunks/app/[locale]/test-modal/page-4889454aaa02c16f.js",
  "/_next/static/chunks/app/[locale]/test-notifications/page-4498be200a038306.js",
  "/_next/static/chunks/app/[locale]/test-pricing/alternative/page-ef80e632aeb23710.js",
  "/_next/static/chunks/app/[locale]/test-pricing/page-d49a730f04f015e5.js",
  "/_next/static/chunks/app/[locale]/test-toast/page-1b3f3698fd09ccc6.js",
  "/_next/static/chunks/app/[locale]/test-village-personalization/page-32ade7e70596b117.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/textbook-vocabulary/page-0b605d57899c3ddc.js",
  "/_next/static/chunks/app/[locale]/todos/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/todos/page-e3ad237667442f6b.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/learn/page-18b2f602cf180f68.js",
  "/_next/static/chunks/app/[locale]/tools/kanji-mastery/page-bba03f2ef0375538.js",
  "/_next/static/chunks/app/[locale]/tts-demo/page-83600854189ce813.js",
  "/_next/static/chunks/app/[locale]/tts-playground/page-6967cebfa01b1f9e.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/edit/page-2f99225ae45b04d0.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/[id]/page-b18d80ef8aba7b67.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/ask/page-c8fcb0c40dbf6816.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/village/tea-house/page-d77f41ae992b89bf.js",
  "/_next/static/chunks/app/[locale]/vocabulary/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/vocabulary/page-88d2395334d5dc43.js",
  "/_next/static/chunks/app/[locale]/waitlist/page-09edd450913771f3.js",
  "/_next/static/chunks/app/[locale]/youtube-series/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/youtube-series/page-602e933cacd9c503.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/layout-fe0a19cc628d6fa0.js",
  "/_next/static/chunks/app/[locale]/youtube-shadowing/page-dd492916447a01c8.js",
  "/_next/static/chunks/app/_not-found/page-74b849589c0cfcbf.js",
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
  "/_next/static/chunks/webpack-2e5595fc78545df0.js",
  "/_next/static/css/58ca86956afb7910.css",
  "/_next/static/css/6e09cdf58928be98.css",
  "/_next/static/css/af47b6060c4fddcc.css",
  "/_next/static/css/b92c2ca386d2129f.css",
  "/_next/static/x5z34u_k-kdDQab9ZtTTb/_buildManifest.js",
  "/_next/static/x5z34u_k-kdDQab9ZtTTb/_ssgManifest.js"
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
