# Next Steps — Review API Test Migration

The review-api endpoints now have focused Jest suites and a dedicated config (`jest.config.review-api.js`) plus the script `npm run test:review:api`. The remaining work falls into three buckets: finish migrating other legacy tests, stabilise middleware and validator suites, and integrate the new package into CI.

## 1. Migrate Remaining Review Scenarios
- [ ] Audit the legacy `__tests__` (session start, queue, pin) to confirm every business rule we still care about is covered. For any missing cases (e.g. streak freeze interactions, premium edge cases), port them into the new suites using `configureSessionSuccess`/helpers.
- [ ] Expand the helpers if needed (e.g. ability to customise Redis responses or to simulate cache hits across users).
- [ ] Delete any now-obsolete fixtures or docs referencing the old 1k-line tests to avoid drift.

## 2. Clean Up Adjacent Packages
- [ ] Fix the TypeScript parse error in `src/app/api/review/_middleware/__tests__/middleware.test.ts` (line 1206). Most likely caused by residual code from the earlier auto-generated suites; trim or rewrite that test file.
- [ ] Address the real test failures in:
  - `src/lib/review-engine/validation/__tests__/base-validator.test.ts` (similarity expectations and null handling).
  - `src/lib/review-engine/srs/__tests__/algorithm.test.ts` (interval cap, ease factor, etc.).
- [ ] Once those suites are stabilised, consider creating separate Jest configs/scripts (`jest.config.middleware.js`, `jest.config.review-engine.js`) to run them independently.

## 3. CI & Documentation
- [ ] Update CI pipelines to include `npm run test:review:api` (and future package scripts) so the targeted suites run in isolation before the global run.
- [ ] Document the new helpers in `/src/lib/review-engine/__tests__/README.md` (or similar) so contributors know how to stage requests without touching Firebase/Redis.
- [ ] Update contributor docs (`AGENTS.md` or README) with a short section on running package-specific tests (`npm run test:review:api`, forthcoming scripts).

## 4. Optional Enhancements
- [ ] Add an auth stub helper to `ApiRouteTestHelper` so middleware tests can re-use the authentication scaffolding introduced here.
- [ ] Consider extracting the middleware mocks (auth/rate-limit/validation) into re-usable factories under `__tests__/mocks/` to avoid duplication between API suites.
- [ ] Add coverage thresholds for the review API config if desired (e.g. extend `jest.config.review-api.js` with `collectCoverageFrom`).

Once these tasks are complete, re-run:
```
npm run test:review:api
npm run test:unit -- --runInBand
```
to confirm both the package-specific and global suites are green.***
