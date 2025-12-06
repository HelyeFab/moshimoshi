# I18n Migration Plan: Client-State to URL-Routing

**Objective:** Migrate from a client-side, state-based i18n system to a Next.js App Router URL-based system (e.g., `/en/dashboard`, `/fr/pricing`) to enable SEO indexing for international languages.

**Constraint:** The default language (English) must remain at the root (e.g., `/dashboard`, not `/en/dashboard`) to preserve existing SEO ranking and prevent broken external links.

---

## Phase 1: Infrastructure & Configuration (Agent A)

**Goal:** Set up the routing capability without moving the actual UI yet.

### 1.1 Define Locale Config

Create a server-friendly configuration file (separate from the React Context) to be used by Middleware and Server Components.

- **Action:** Create `src/i18n/server-config.ts`
- **Content:** Define supported locales, default locale, and the "hide default locale prefix" strategy.

### 1.2 Create Navigation Helpers

We need to replace standard `Link` usage and `useRouter` calls to automatically handle the locale prefix.

- **Action:** Create `src/components/i18n/LocalizedLink.tsx`.
  - _Logic:_ If `lang` is English, return href as `/path`. If `lang` is French, return `/fr/path`.
- **Action:** Create `src/hooks/useLocalizedRouter.ts`.
  - _Logic:_ Wrapper around `useRouter` that prepends the current locale to `push()` calls if necessary.

### 1.3 Update Middleware

The middleware is the traffic controller. It must intercept requests and rewrite them to the correct folder structure.

- **Action:** Update `src/middleware.ts`.
- **Logic:**
  - Ignore `_next`, `api`, and static files.
  - Check if URL starts with a locale (e.g., `/fr`).
  - **Case 1 (English/Default):** URL is `/about`. Rewrite internally to `/en/about` (so Next.js finds the file), but keep browser URL as `/about`.
  - **Case 2 (Foreign):** URL is `/fr/about`. Rewrite internally to `/fr/about`.
  - **Case 3 (Missing):** Detect user preference? (Optional, usually redirect to default).

---

## Phase 2: Structural Migration (The "Split" Phase)

**Goal:** Move pages into the `[lang]` directory.
**Note:** `src/app/api` and `src/app/layout.tsx` (Root Layout) generally stay outside or require specific handling.

### 2.0 Prepare the Directory

- **Action:** Create directory `src/app/[lang]`.
- **Action:** Create `src/app/[lang]/layout.tsx`. This will be the new main layout that receives `params.lang`.

### 2.1 Chunk A: Public Pages (Agent B)

Migrate the static marketing pages. These are the most critical for SEO.

- **Files:**
  - `src/app/page.tsx` (Landing)
  - `src/app/pricing/page.tsx`
  - `src/app/auth/*` (SignIn/SignUp)
- **Task:** Move into `src/app/[lang]/...`. Update imports. Replace `<Link>` with `<LocalizedLink>`.

### 2.2 Chunk B: Core Application (Agent C)

Migrate the authenticated user dashboard and features.

- **Files:**
  - `src/app/dashboard/page.tsx`
  - `src/app/settings/page.tsx`
  - `src/app/account/page.tsx`
- **Task:** Move into `src/app/[lang]/...`. Ensure `useLocalizedRouter` is used for navigation events (like redirect after login).

### 2.3 Chunk C: Feature Modules (Agent D)

Migrate complex nested routes.

- **Files:**
  - `src/app/news/*`
  - `src/app/drill/*`
  - `src/app/stories/*`
- **Task:** Move into `src/app/[lang]/...`. Check for any hardcoded strings in URL construction.

---

## Phase 3: Data Fetching & Hydration (Agent E)

**Goal:** Ensure the server knows the language to render the initial HTML correctly (SSG/SSR).

### 3.1 Server-Side Translation

The current `getTranslation` is synchronous and client-focused. We need a pattern for Server Components.

- **Action:** Create a utility `getDictionary(lang)` in `src/i18n/get-dictionary.ts`.
- **Logic:** Load the `strings.ts` for the requested locale.

### 3.2 Client Hydration

Pass the `lang` param from the Server Layout to the Client Context provider.

- **Action:** Update `src/i18n/I18nContext.tsx` to accept `initialLocale` from props (passed down from `[lang]/layout.tsx`) instead of reading generic LocalStorage immediately. This prevents the "hydration mismatch" flicker.

---

## Phase 4: SEO & Metadata (Agent F)

**Goal:** Tell Google about the languages.

### 4.1 Dynamic Metadata

Update `generateMetadata` in `page.tsx` files.

- **Action:** Use the `params.lang` to fetch the localized title/description.
  - _Before:_ `title: "Learn Japanese"`
  - _After:_ `title: t('landing.hero.headline')`

### 4.2 Hreflang Headers

- **Action:** Add `alternate` tags in the Root Layout or specific pages so Google knows `/fr/about` is the French version of `/about`.

---

## Execution Checklist

- [ ] **Phase 1:** Infrastructure
  - [ ] `server-config.ts` created
  - [ ] `LocalizedLink` component created
  - [ ] Middleware updated for locale detection
- [ ] **Phase 2:** Migration
  - [ ] `[lang]` folder created
  - [ ] Public pages moved
  - [ ] Auth pages moved
  - [ ] Dashboard/App pages moved
- [ ] **Phase 3:** Integration
  - [ ] Server-side `getDictionary` implemented
  - [ ] Client Context adapted for hydration
- [ ] **Phase 4:** Final Polish
  - [ ] Metadata localization
  - [ ] `sitemap.xml` updated (if applicable)
