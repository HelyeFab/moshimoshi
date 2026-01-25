# Grammar Stall Phase 2 - Release Checklist

Use this checklist before shipping.

---

## Build + Run (Required)

- `npm run build:full`
- `npm run start -- -p 4173`

If you see webpack runtime errors, clear `.next` and rebuild.

---

## Lighthouse (Prod)

Run against production server (not dev):

- `http://localhost:4173/en/learn/grammar`
- `http://localhost:4173/en/learn/grammar/{pointId}/practice`

Record:
- Performance
- Accessibility
- Best Practices
- SEO

---

## Tests

- `npm test -- --runInBand`

Note: Jest has previously timed out in this repo. If it hangs,
log the issue and proceed only with explicit approval.

---

## Functional Checks

- Grammar list loads (N5).
- Detail page renders for a sample point.
- Practice session loads and completes.
- XP + streak update through URE.
- Progress persists for free + premium users.
- Admin page `/admin/grammar-stall` loads with existing auth pattern.

---

## PWA / Service Worker (Local Only)

If pages appear broken or show chunk errors:
- Unregister service worker
- Clear site data
- Hard refresh

---

**Last Updated**: 2026-01-17
