# DeckMarket SEO

**Status:** ACTIVE
**Last Updated:** 2026-03-03

## Overview

DeckMarket has a complete SEO implementation covering dynamic metadata, structured data, sitemaps, hreflang, OpenGraph, and robots directives across all 6 locales (en, ja, de, es, fr, it).

---

## What's Implemented

### Metadata (generateMetadata in layout.tsx)

**Catalog page** (`/[locale]/deckmarket/layout.tsx`):
- Static title/description from i18n strings (`seo.deckmarket.list.title`, `seo.deckmarket.list.description`)
- 17 keywords (JLPT N5-N1, vocabulary, kanji, grammar, Anki)
- hreflang alternates for all 6 locales + x-default
- Canonical URL

**Detail page** (`/[locale]/deckmarket/[deckId]/layout.tsx`):
- Dynamic title/description from Firestore deck data (falls back to generic if fetch fails)
- Dynamic keywords from deck title, JLPT level, and tags
- OpenGraph with `type: 'article'`, locale variants, and explicit `og:image` (`/moshimoshi-logo.png`, 1200x630)
- Twitter card (`summary_large_image`)
- hreflang alternates for all 6 locales + x-default
- Canonical URL
- Robots: `index: true, follow: true, noarchive: true, max-image-preview: large, max-snippet: -1`
  - `noarchive` prevents Google caching stale snapshots (download counts, card counts are dynamic)

### Structured Data (JSON-LD via StructuredData component)

**Catalog page** (`/[locale]/deckmarket/page.tsx`):
- `CollectionPage` — describes DeckMarket as a collection of Japanese flashcard decks
- `BreadcrumbList` — Home > DeckMarket (2 levels)

**Detail page** (`/[locale]/deckmarket/[deckId]/page.tsx`):
- `LearningResource` — deck title, description, URL, JLPT level, language, provider, `datePublished`, `dateModified`
- `BreadcrumbList` — Home > DeckMarket > Deck Name (3 levels)

**XSS protection**: The `StructuredData` component escapes `<` as `\u003c` in all JSON-LD output to prevent script injection from user-sourced data (deck titles/descriptions).

### Sitemap

**Per-locale dynamic sitemap** (`/[locale]/deckmarket/sitemap.ts`):
- `generateSitemaps()` returns one sitemap per locale (indices 0-5)
- Each sitemap includes the catalog page (priority 0.8) and all published decks (priority 0.7)
- `lastModified` set from each deck's `updatedAt` field
- hreflang alternates on every entry
- Change frequency: weekly

**Main sitemap** (`/sitemap.ts`):
- `/deckmarket` listed at priority 0.8

**robots.txt** (`/public/robots.txt`):
- All 6 locale-specific deckmarket sitemaps registered

### i18n SEO Strings

All 6 locale files contain `seo.deckmarket.list` and `seo.deckmarket.detail` with localised title/description templates. The detail template uses `{deckTitle}` and `{deckDescription}` placeholders filled at build time from Firestore.

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Metadata in `layout.tsx`, not `page.tsx` | Detail page is `'use client'` — `generateMetadata` must be in a server component (layout) |
| `noarchive` on detail pages | Dynamic content (download count, versions) would show stale data in Google's cached view |
| Explicit `og:image` on detail | Root layout fallback isn't reliably inherited by all social platforms |
| `\u003c` escaping in JSON-LD | `deck.title` and `deck.description` are user-sourced; prevents XSS in `<script>` blocks |
| Per-locale sitemaps | Google recommends separate sitemaps per language for hreflang; mirrors blog/grammar pattern |
| `datePublished`/`dateModified` on LearningResource | Enables Google freshness signals and date display in search results |

---

## Checklist for Creating New Decks

When publishing a new deck to DeckMarket, ensure these fields are populated for maximum SEO value:

### Required Fields

- **title** — Clear, descriptive name. Include the subject and level if applicable (e.g. "Genki 2 Lesson 13 Vocabulary"). Max 255 chars. This becomes the page title and BreadcrumbList name.
- **description** — 1-2 sentences explaining what the deck covers and who it's for. Max 160 chars is ideal for search snippet display (max 2000 allowed). This becomes the meta description.
- **isPublished** — Must be `true` for the deck to appear in sitemaps, search, and the catalog.

### Strongly Recommended Fields

- **jlpt** — Set to `N5`, `N4`, `N3`, `N2`, or `N1` if applicable. Generates JLPT-specific keywords automatically (e.g. "JLPT N3 Anki deck"). Leave `null` only if the deck genuinely isn't JLPT-aligned.
- **tags** — Up to 10 tags (max 50 chars each). Each tag generates a keyword like "Japanese {tag} deck". Good tags: `vocabulary`, `kanji`, `grammar`, `sentences`, `listening`. Avoid generic tags like `Japanese` or `study`.
- **language** — Defaults to `ja`. Set correctly for the deck's target language.

### Automatic Fields (no action needed)

- **createdAt** / **updatedAt** — Set automatically by Firestore. Used for `datePublished`/`dateModified` in structured data and `lastModified` in sitemap.
- **downloadCount** — Tracked automatically. Displayed on the page but not currently in structured data.
- **id** (slug) — Used in the canonical URL. Use descriptive, hyphenated slugs (e.g. `genki2-lesson-02` not `deck-abc123`).

### After Publishing

1. **Verify sitemap** — Check `https://moshimoshi.app/{locale}/deckmarket/sitemap.xml` includes the new deck.
2. **Validate structured data** — Run the deck URL through [Google Rich Results Test](https://search.google.com/test/rich-results). Should show LearningResource + BreadcrumbList.
3. **Check social preview** — Share the URL on Twitter/Slack/Discord to verify the og:image and title appear correctly.
4. **Request indexing** (optional) — In Google Search Console, use "URL Inspection" > "Request Indexing" for faster discovery.

### Writing SEO-Friendly Descriptions

Good:
> "Master 200+ essential JLPT N4 grammar patterns with example sentences. Covers て-form, potential form, and conditional expressions."

Bad:
> "Grammar deck for studying."

The description appears in Google search results and social previews. Front-load the most important information. Mention specific content (grammar points, vocabulary count, textbook chapter) and the target level.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/[locale]/deckmarket/layout.tsx` | Catalog page metadata + CollectionPage structured data |
| `src/app/[locale]/deckmarket/page.tsx` | Catalog page CollectionPage + BreadcrumbList JSON-LD |
| `src/app/[locale]/deckmarket/[deckId]/layout.tsx` | Detail page metadata (OG, robots, hreflang, keywords) |
| `src/app/[locale]/deckmarket/[deckId]/page.tsx` | Detail page LearningResource + BreadcrumbList JSON-LD |
| `src/app/[locale]/deckmarket/sitemap.ts` | Per-locale dynamic sitemap generation |
| `src/components/StructuredData.tsx` | Shared JSON-LD component with XSS escaping |
| `src/i18n/locales/*/strings.ts` | Localised SEO title/description templates |
| `public/robots.txt` | Sitemap registrations |
| `02-PRODUCTION_DOCS/deckMarket/WAVE6_AGENT2_SEO.md` | Original implementation reference |

---

## Validation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] Catalog page has `<meta name="description">` with localised content
- [ ] Detail page has `<meta property="og:image">` pointing to `/moshimoshi-logo.png`
- [ ] Detail page has `<meta name="robots">` including `noarchive`
- [ ] Detail page source contains two `<script type="application/ld+json">` blocks (LearningResource + BreadcrumbList)
- [ ] LearningResource includes `datePublished` and `dateModified`
- [ ] Sitemap XML lists all published decks with correct `lastmod` dates
- [ ] Google Rich Results Test passes for both catalog and detail pages
- [ ] Social share preview shows image, title, and description
