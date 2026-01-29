# Admin Dashboard Metric Map + Active Today Audit

**Status:** ACTIVE  
**Last Updated:** 2026-01-29  

This document maps each metric in `/en/admin` to:
1) the exact documentation section,
2) the UI render location, and
3) the API/data source location (line-level).

It also audits the "Active Today" tracking pipeline against the documented behavior.

---

## Metric Map (UI ↔ Docs ↔ Code)

**Legend**
- UI: `src/app/[locale]/admin/page.tsx`
- API: `src/app/api/admin/stats/route.ts`
- Docs: `02-PRODUCTION_DOCS/admin-dashboard/*.md`

### Core Stat Cards

**Total Users**
- Docs: `METRICS_EXPLANATION.md` → "Understanding the Numbers"
- UI: `src/app/[locale]/admin/page.tsx:160`
- API: `src/app/api/admin/stats/route.ts:83`
- Data: Firestore `users` collection count

**Active Today**
- Docs: `METRICS_EXPLANATION.md` → "Active Today / Returning Users (Current Behavior)"
- UI: `src/app/[locale]/admin/page.tsx:169`
- API: `src/app/api/admin/stats/route.ts:101`
- Data: Firestore `users.lastActive >= today`

**New Today**
- Docs: `METRICS_EXPLANATION.md` → "Understanding the Numbers"
- UI: `src/app/[locale]/admin/page.tsx:177`
- API: `src/app/api/admin/stats/route.ts:98`
- Data: Firestore `users.createdAt >= today`

**Subscriptions (Active Subscriptions)**
- Docs: `METRICS_EXPLANATION.md` → "Monthly Revenue (MRR)" + "Subscription Data Location"
- UI: `src/app/[locale]/admin/page.tsx:185`
- API: `src/app/api/admin/stats/route.ts:106`
- Data: `users/{uid}/subscription.plan` via `getUserTier()` / `isPremiumUser()`

**MRR**
- Docs: `METRICS_EXPLANATION.md` → "Monthly Revenue (MRR)"
- UI: `src/app/[locale]/admin/page.tsx:193`
- API: `src/app/api/admin/stats/route.ts:109`
- Data: sum of `premium_monthly` + monthly equivalent of `premium_yearly`

### Content Views (All‑time Cumulative)

**Article Views**
- Docs: `METRICS_EXPLANATION.md` → "Article Views (All-Time Cumulative)"
- UI: `src/app/[locale]/admin/page.tsx:201`
- API: `src/app/api/admin/stats/route.ts:172`
- Data: sum of `news_articles.viewCount`

**Book Views**
- Docs: `METRICS_EXPLANATION.md` → "Book Views (All-Time Cumulative)"
- UI: `src/app/[locale]/admin/page.tsx:209`
- API: `src/app/api/admin/stats/route.ts:160`
- Data: sum of `books.viewCount` (published)

**Story Views**
- Docs: `METRICS_EXPLANATION.md` → "Story Views (All-Time Cumulative)"
- UI: `src/app/[locale]/admin/page.tsx:217`
- API: `src/app/api/admin/stats/route.ts:164`
- Data: sum of `stories.viewCount` (published)

**Comic Views**
- Docs: `METRICS_EXPLANATION.md` → "Comic Views (All-Time Cumulative)"
- UI: `src/app/[locale]/admin/page.tsx:225`
- API: `src/app/api/admin/stats/route.ts:168`
- Data: sum of `comics.viewCount` (published)

### Baseline / “Since Reset”

**Since Reset (Article/Book/Story/Comic Views)**
- Docs: **Not explicitly documented** (baseline tracking described only in code)
- UI: `src/app/[locale]/admin/page.tsx:203` (and 211, 219, 227)
- API: `src/app/api/admin/stats/route.ts:186`
- Data: Firestore `admin/stats_baseline` vs current totals

**Baseline Date (Tracking Since)**
- Docs: **Not explicitly documented**
- UI: `src/app/[locale]/admin/page.tsx:258`
- API: `src/app/api/admin/stats/route.ts:183`
- Data: `admin/stats_baseline.timestamp`

### Recent Users

**Recent Users List**
- Docs: **Not explicitly documented**
- UI: `src/app/[locale]/admin/page.tsx:565`
- API: `src/app/api/admin/stats/route.ts:196`
- Data: Firestore `users` ordered by `createdAt desc`, limit 5

### System Status

**Database / API Response / Cache Hit Rate / Error Rate / Uptime**
- Docs: **Not explicitly documented** (monitoring values are implied in code and `SECURITY_HARDENING.md`)
- UI: `src/app/[locale]/admin/page.tsx:629`
- API: `src/app/api/admin/stats/route.ts:249`
- Data: `reviewMetrics.getDashboardSummary()` + `metrics` (SLA tracker store)

---

## Active Today Tracking Audit

**Doc expectation**
- `METRICS_EXPLANATION.md` → "Active Today / Returning Users (Current Behavior)"
- `DEVELOPER_GUIDE.md` → "Activity Tracking"
- Definition: `users.lastActive` is updated on page visits and key content interactions.

**Current implementation (trackUserActivity call sites)**
- Page visit tracker (global):  
  - Client: `src/components/analytics/PageVisitTracker.tsx:52`  
  - Server: `src/app/api/analytics/page-visit/route.ts:58`
- Content + tracking endpoints:  
  - Books: `src/app/api/library/books/route.ts:37`  
  - Stories: `src/app/api/stories/[slug]/route.ts:27`  
  - Comics: `src/app/api/comics/episodes/[episodeId]/route.ts:23`  
  - Articles: `src/app/api/news/article/[id]/route.ts:27`  
  - Unified view tracking: `src/app/api/track-view/route.ts:92`
- Kanji mastery (session activity):  
  - POST: `src/app/api/kanji-mastery/session/route.ts:21`  
  - GET: `src/app/api/kanji-mastery/session/route.ts:151`

**Coverage assessment**
- ✅ PageVisitTracker is mounted in the locale layout (`src/app/[locale]/layout.tsx:80`), so authenticated page views should update `lastActive` consistently.
- ✅ Content endpoints and `/api/track-view` also update activity for engagement beyond simple page loads.
- ⚠️ Potential gaps: any authenticated user actions that do not trigger page-visit events or `/api/track-view` (e.g., background-only API usage) may not update `lastActive`.
