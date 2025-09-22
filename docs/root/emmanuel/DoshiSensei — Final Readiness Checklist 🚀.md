🚀 — you now have:

- ✅ **Entitlements system (v2)** → clean, auditable allow/deny + limits

- ✅ **User schema** in Firestore (profile + subscription facts)

- ✅ **Review system** (learning engine with spaced repetition & analytics hooks)

- ✅ **Stripe integration** (checkout, billing portal, webhooks, subscription lifecycle)

- ✅ **Core features** (hiragana/katakana drills etc.)

That already covers a *lot* of the product backbone. If we step back and think like a CTO + PM, here’s what you may still want to line up **before “production-ready”**:

---

## 1. **Cross-cutting Foundations**

- **Audit & Logging**:
  
  - You already log entitlements and Stripe events.
  
  - Consider centralizing logs in Firestore + exporting to BigQuery/Cloud Logging → query across *all* domains (auth, review, entitlements, payments).

- **Error Handling & Alerting**:
  
  - Alerts on webhook failures, daily entitlements anomalies, unusually high error rates.
  
  - Slack/Discord integration for ops.

- **Testing Strategy**:
  
  - You have unit/integration for entitlements/Stripe.
  
  - Add *load tests* (simulate 100s of users hitting `/api/usage`) to validate Firestore transaction costs & limits.

---

## 2. **User Experience / Retention**

- **Notifications & Reminders** (MVP later):
  
  - Daily practice reminders (email, push, in-app).
  
  - Quiet hours (already in spec).

- **Onboarding Flow**:
  
  - First-time experience: choose learning track (hiragana first, then katakana).
  
  - Guided tour of limits → “Upgrade to unlock unlimited drills.”

- **Progress & Streaks**:
  
  - You have review history, but **gamification** (streaks, badges) can be layered easily.

---

## 3. **Security & Compliance**

- **RBAC for Admin**:
  
  - Admin UI for policy editing, decision explorer → should be gated by role claims.

- **Data Retention Policy**:
  
  - Logs: how long do you keep `logs/stripe/events`?
  
  - User deletions (GDPR/CCPA): ensure Stripe customer + Firestore doc are wiped.

- **Webhooks**:
  
  - Already hardened, but add **retries monitoring** (alert if >N consecutive failures).

---

## 4. **Scalability Concerns**

- **Firestore Costing**:
  
  - Usage increments = many writes. Confirm you’re batching well.
  
  - Consider per-day usage buckets instead of per-increment docs.

- **Caching Layer**:
  
  - Entitlements decisions can be cached in memory or Redis (optional).

- **Multi-tenant Readiness**:
  
  - If you ever white-label DoshiSensei for schools/companies → entitlements must support tenant caps.

---

## 5. **Go-to-Market Layer**

- **SEO & Marketing**:
  
  - You already mentioned SEO reinstatement.
  
  - Add blog/content pipeline → connect learning resources with organic search.

- **Analytics**:
  
  - Product analytics (user funnels: “sign up → try drill → hit limit → upgrade”).
  
  - Already partially covered by review engine logs, but you may want amplitude/mixpanel/GTM.

- **Support / Feedback**:
  
  - Simple in-app “report issue” / “suggest feature” form feeding into Firestore or Discord.

---

## 6. **Optional Future-Proofing**

- **Offline Mode**:
  
  - Issue vouchers (already in entitlements v2 spec).
  
  - Cache drills/reviews for subway/offline use.

- **Internationalization (i18n)**:
  
  - If you want to serve non-English speakers, prep for multi-language UI.

- **Content Expansion**:
  
  - Beyond kana → KanjiQuest map integration, grammar drills, AI-powered reading.

---

⚖️ **So, short answer**:  
After **entitlements + schema + review engine + Stripe**, the big pillars still worth planning are:

1. **Observability** (logs, alerts, error handling)

2. **User onboarding & retention** (notifications, streaks, gamification)

3. **Security/compliance** (RBAC, GDPR, data lifecycle)

4. **Scalability** (Firestore writes, caching, multi-tenancy)

5. **Go-to-market** (SEO, analytics, feedback loops)







# DoshiSensei — Final Readiness Checklist 🚀

**Purpose:** Before production launch, ensure all **critical systems** (entitlements, user schema, review engine, Stripe, etc.) are hardened, observable, and compliant.  
**Audience:** Core dev team + product lead (Emmanuel).

---

## 1. Core Systems ✅

- **Entitlements v2**
  
  - Single Source Schema drives all features.
  
  - Policy evaluator tested (plan × feature matrix).
  
  - Atomic usage API live with idempotency keys.

- **User Schema**
  
  - `/users/{uid}` doc includes subscription facts only.
  
  - GDPR/CCPA deletion path clears Stripe + Firestore.

- **Review Engine**
  
  - Daily windows tested (fake date advance).
  
  - History & streak persistence validated.
  
  - Analytics events fired (`session_started`, `graded`, `completed`).

- **Stripe Integration**
  
  - Checkout & Billing Portal endpoints tested.
  
  - Webhooks verified with signature, retries safe.
  
  - Facts in Firestore match Stripe Dashboard truth.

---

## 2. Observability & Reliability 📊

- **Central Logs**
  
  - Entitlement decisions (`logs/entitlements`)
  
  - Stripe events (`logs/stripe/events`)
  
  - Review actions

- **Alerting**
  
  - Webhook failures >3 retries → Slack/Discord alert.
  
  - Daily quota anomalies (unexpected spikes).

- **Error Handling**
  
  - Functions fail safe, return JSON error consistently.
  
  - User-facing errors localized (e.g., “limit reached”).

---

## 3. Security & Compliance 🔒

- **Secrets**
  
  - All Stripe keys, webhook secrets stored in **Google Secret Manager**.
  
  - No secrets in `.env.local` or repo.

- **RBAC**
  
  - Admin UI gated by Firebase custom claims.
  
  - Policy edits PR-reviewed (no hot edits in prod).

- **Data Lifecycle**
  
  - Retention policy: logs purged or exported after 90d.
  
  - GDPR delete verified (`/users/{uid}` + Stripe customer delete).

---

## 4. Scalability & Cost ⚖️

- **Firestore Writes**
  
  - Usage counters bucketed per day, not per event.
  
  - Batch writes used where possible.

- **Caching**
  
  - Entitlement checks cached 60s on server.
  
  - Client caches last decision for UI smoothness.

- **Multi-tenant Ready**
  
  - Tenant caps supported in evaluator (optional toggle).

---

## 5. User Experience 🎨

- **Onboarding Flow**
  
  - First-run tutorial (hiragana → katakana path).
  
  - CTA for upgrade visible when hitting free limits.

- **Retention Features**
  
  - Streaks and badges displayed.
  
  - Notifications (email/push) configurable, quiet hours honored.

- **Accessibility**
  
  - Drill UI passes a11y audit (contrast, keyboard nav, ARIA).
  
  - Review screens screen-reader friendly.

---

## 6. Go-to-Market 🌍

- **SEO**
  
  - `robots.txt` + `sitemap.xml` deployed.
  
  - Canonical URLs + OG/Twitter cards tested.
  
  - Blog pipeline ready (first post live).

- **Analytics**
  
  - Funnels tracked: *signup → first drill → hit limit → upgrade*.
  
  - Event logs mirrored into GA/Mixpanel.

- **Feedback Loop**
  
  - In-app “report issue / suggest feature” form connected to Firestore.
  
  - Support contact visible in footer.

---

## 7. Testing Strategy 🧪

- **Unit Tests**
  
  - Policy evaluator edge cases.
  
  - Firestore helpers idempotency.
  
  - Stripe handlers with mock payloads.

- **Integration Tests**
  
  - Checkout flow (test card `4242`).
  
  - Cancel flow → subscription.deleted event.
  
  - Invoice fail flow (test card `0341`).

- **Load Tests**
  
  - 100 concurrent drill starts → Firestore cost observed.
  
  - No double counts under stress.

- **E2E Tests (Staging)**
  
  - Guest → Free → Premium upgrade path.
  
  - Webhook replay → Firestore unchanged.
  
  - Stripe Dashboard vs Firestore → 100% match.

---

## 8. Launch Gate 🚀

- Staging environment mirrors prod config.

- Canary users run through full upgrade/downgrade flow.

- Rollback plan: Stripe + Firestore back to “free-only” mode.

- All agents sign off (A1–A4 + product).
