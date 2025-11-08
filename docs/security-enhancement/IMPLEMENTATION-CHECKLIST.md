# Implementation Checklist
## Security & Modernization Project Tracking

**Project**: Moshimoshi Security Enhancement
**Branch**: `security-modernization-refactor`
**Started**: 2025-01-08
**Duration**: 9 weeks

---

## 📅 Phase 1: Critical Security (Week 1-2)

### JWT Secret Rotation
- [x] Generate cryptographically secure JWT_SECRET
- [x] Document rotation procedure
- [ ] Update production environment variables
- [ ] Implement dual-key grace period (optional)
- [ ] Test token validation with new secret
- [ ] Deploy to staging
- [ ] Monitor auth success rate for 48 hours
- [ ] Deploy to production (maintenance window)
- [ ] Remove old secret after grace period

### Admin Route Protection (11 routes)
- [ ] Update `/api/admin/generate-story-from-moodboard/route.ts`
- [ ] Update `/api/admin/generate-story/route.ts`
- [ ] Update `/api/admin/generate-audio/route.ts`
- [ ] Update `/api/admin/generate-image/route.ts`
- [ ] Update `/api/admin/generate-moodboard/route.ts`
- [ ] Update `/api/admin/generate-kanji-moodboard/route.ts`
- [ ] Update `/api/admin/init/route.ts`
- [ ] Update `/api/admin/news/trigger-scraping/route.ts`
- [ ] Update `/api/admin/streak-analytics/route.ts`
- [ ] Update `/api/admin/entitlements/config/route.ts`
- [ ] Update `/api/admin/entitlements/types/route.ts`
- [ ] Test each route with/without admin token
- [ ] Update frontend to send Firebase tokens

### Debug Routes (4 routes)
- [ ] DELETE `/api/debug/env/route.ts` ⚠️ CRITICAL
- [ ] DELETE or protect `/api/debug/user/[uid]/route.ts`
- [ ] DELETE or protect `/api/debug/firebase-test/route.ts`
- [ ] DELETE or protect `/api/debug-storage/route.ts`
- [ ] Verify routes return 404 or 401
- [ ] Remove debug route references from frontend

### Rate Limiting (56 public routes)
- [ ] Create `/lib/rate-limit/public-api.ts`
- [ ] Configure Redis rate limiters
- [ ] Add rate limiting to Kanji endpoints (8 routes)
- [ ] Add rate limiting to Furigana endpoints (6 routes)
- [ ] Add rate limiting to News endpoints (4 routes)
- [ ] Add rate limiting to Tatoeba endpoints (2 routes)
- [ ] Add rate limiting to Grammar endpoints (~10 routes)
- [ ] Add rate limiting to Vocabulary endpoints (~10 routes)
- [ ] Add rate limiting to other public APIs (~16 routes)
- [ ] Test rate limits (verify 429 after threshold)
- [ ] Add rate limit headers to responses
- [ ] Monitor Redis for rate limit performance

### Security Headers
- [ ] Add Strict-Transport-Security (HSTS)
- [ ] Add comprehensive Content-Security-Policy
- [ ] Test CSP doesn't break functionality
- [ ] Configure CSP reporting endpoint

### Testing & Deployment
- [ ] Run security scan (npm audit)
- [ ] Test all protected routes
- [ ] Test all public routes with rate limits
- [ ] Staging deployment
- [ ] 48-hour staging stability test
- [ ] Production deployment
- [ ] Monitor error rates for 48 hours
- [ ] Document any issues found

**Exit Criteria**:
- ✅ 0 admin routes without auth
- ✅ 0 debug routes exposed
- ✅ All public routes rate limited
- ✅ Security headers present
- ✅ No increase in error rates

---

## 📅 Phase 2: TypeScript Cleanup (Week 2)

### Fix TypeScript Errors
- [ ] Fix UniversalProgressManager.ts line 211 (unused variable)
- [ ] Fix UniversalProgressManager.ts line 214 (continuation error)
- [ ] Run `npx tsc --noEmit` (should show 0 errors)
- [ ] Test build: `npm run build`

### Enable Strict Checking
- [ ] Remove `ignoreBuildErrors: true` from next.config.ts
- [ ] Remove `ignoreDuringBuilds: true` for ESLint
- [ ] Test build fails on TS errors
- [ ] Run `npm run type-check`

### Verification
- [ ] All builds pass without errors
- [ ] No regression in functionality
- [ ] ESLint passes
- [ ] Prettier formatting consistent

**Exit Criteria**:
- ✅ 0 TypeScript errors
- ✅ Strict checking enabled
- ✅ Builds fail on future errors

---

## 📅 Phase 3A: Bundle Optimization (Week 3-6)

### Week 3: Quick Wins
- [ ] **react-icons → lucide-react** (Day 1-3)
  - [ ] Audit all react-icons imports (find pattern)
  - [ ] Replace with lucide-react imports
  - [ ] Test all icons render correctly
  - [ ] Remove react-icons from package.json
  - [ ] Measure bundle size reduction
  - [ ] Expected: -40MB

- [ ] **Dynamic Import framer-motion** (Day 4-5)
  - [ ] Identify pages using framer-motion
  - [ ] Wrap in dynamic imports
  - [ ] Add loading states
  - [ ] Test animations still work
  - [ ] Expected: -40MB initial bundle

### Week 4: Code Splitting
- [ ] **Lazy Load Tiptap Editor**
  - [ ] Dynamic import on admin pages only
  - [ ] Add skeleton loader
  - [ ] Test editor functionality

- [ ] **Lazy Load Recharts**
  - [ ] Dynamic import on dashboard/admin
  - [ ] Add chart skeleton
  - [ ] Test chart rendering

- [ ] **Lazy Load Kuromoji**
  - [ ] Dynamic import for furigana
  - [ ] Client-side only (ssr: false)
  - [ ] Test Japanese tokenization

- [ ] **Lazy Load Games**
  - [ ] Dynamic import all game components
  - [ ] Add game-specific loaders
  - [ ] Test game functionality

### Week 5: Optimization
- [ ] **Firebase Tree-Shaking**
  - [ ] Audit all Firebase imports
  - [ ] Convert to modular imports
  - [ ] Remove unused Firebase services
  - [ ] Test Firebase functionality

- [ ] **Image Optimization**
  - [ ] Configure WebP/AVIF formats
  - [ ] Add responsive image sizes
  - [ ] Optimize existing images
  - [ ] Test image loading

- [ ] **Add Memoization**
  - [ ] Identify expensive calculations
  - [ ] Add React.memo to pure components
  - [ ] Add useMemo for SRS calculations
  - [ ] Profile performance improvements

### Week 6: Caching & CDN
- [ ] **Setup Bundle Analyzer**
  - [ ] Install @next/bundle-analyzer
  - [ ] Run analysis
  - [ ] Document findings
  - [ ] Create optimization targets

- [ ] **CDN Configuration**
  - [ ] Setup Vercel/Cloudflare CDN
  - [ ] Move static assets to CDN
  - [ ] Configure cache headers
  - [ ] Test asset loading

- [ ] **Performance Monitoring**
  - [ ] Setup Lighthouse CI
  - [ ] Configure Sentry Performance
  - [ ] Add custom metrics
  - [ ] Create performance dashboard

### Testing
- [ ] Run bundle analyzer before/after
- [ ] Lighthouse scores all pages
- [ ] Test on slow connection (3G)
- [ ] Verify no functionality breaks

**Exit Criteria**:
- ✅ Build size <1.5GB (-30%)
- ✅ Initial bundle <500KB (-60%)
- ✅ Lighthouse Performance >90

---

## 📅 Phase 3B: React 19 Suspense (Week 3-6)

### Week 3: Fix Existing
- [ ] **Add Fallbacks (5 files)**
  - [ ] Identify Suspense without fallback
  - [ ] Design skeleton loaders
  - [ ] Implement fallback components
  - [ ] Test loading states

- [ ] **Replace Spinners (10 files)**
  - [ ] Identify generic spinner usage
  - [ ] Design page-specific skeletons
  - [ ] Replace spinners with skeletons
  - [ ] Test perceived performance

### Week 4: High-Value Pages
- [ ] **News Articles**
  - [ ] Add nested Suspense (article + comments)
  - [ ] Create article skeleton
  - [ ] Create comments skeleton
  - [ ] Test streaming behavior
  - [ ] Measure TTFB improvement

- [ ] **Review Dashboard**
  - [ ] Add parallel data loading
  - [ ] Create stats skeleton
  - [ ] Create queue skeleton
  - [ ] Test progressive rendering
  - [ ] Profile performance

### Week 5: Medium-Value Pages
- [ ] **Leaderboard**
  - [ ] Add streaming Suspense
  - [ ] Stream top 10 first
  - [ ] Then stream rest
  - [ ] Test on large dataset

- [ ] **Resources List**
  - [ ] Progressive card loading
  - [ ] Image lazy loading
  - [ ] Test scroll performance

- [ ] **YouTube Series**
  - [ ] Async API calls
  - [ ] Cached vs fresh data
  - [ ] Test external API handling

### Week 6: Optimization
- [ ] **Add Preloading**
  - [ ] Identify critical paths
  - [ ] Add preload hints
  - [ ] Test prefetch on hover

- [ ] **Error Boundaries**
  - [ ] Add to all Suspense boundaries
  - [ ] Implement retry logic
  - [ ] Test error recovery

- [ ] **Performance Testing**
  - [ ] Measure TTFB improvements
  - [ ] Measure FCP improvements
  - [ ] Check CLS <0.1
  - [ ] Profile with React DevTools

**Exit Criteria**:
- ✅ 15 pages with Suspense boundaries
- ✅ TTFB improves 20-30%
- ✅ CLS <0.1
- ✅ All skeletons match content

---

## 📅 Phase 4: PWA Migration (Week 7-8)

### Week 7: Setup & Configuration
- [ ] **Install Package**
  - [ ] `npm install @ducanh2912/next-pwa`
  - [ ] Verify package version
  - [ ] Check compatibility

- [ ] **Configure next.config.ts**
  - [ ] Wrap config with withPWA
  - [ ] Set dest: 'public'
  - [ ] Configure register: true
  - [ ] Set skipWaiting: true
  - [ ] Disable in development

- [ ] **Migrate Caching Strategies**
  - [ ] Read current sw.js
  - [ ] Map to Workbox runtimeCaching
  - [ ] Configure static asset caching
  - [ ] Configure API caching
  - [ ] Configure image caching

- [ ] **Custom Service Worker Handlers**
  - [ ] Extract notification logic from sw.js
  - [ ] Create `/public/custom-sw-handlers.js`
  - [ ] Configure importScripts in Workbox

### Week 8: Testing & Deployment
- [ ] **Test PWA Features**
  - [ ] Install to home screen (iOS)
  - [ ] Install to home screen (Android)
  - [ ] Install to desktop (Chrome/Edge)
  - [ ] Test offline functionality
  - [ ] Test push notifications
  - [ ] Test background sync (new feature)

- [ ] **Staging Deployment**
  - [ ] Deploy to staging
  - [ ] Test PWA on multiple devices
  - [ ] Monitor service worker registration
  - [ ] Check cache hit rates

- [ ] **Production Rollout**
  - [ ] Deploy to 10% of users
  - [ ] Monitor error rates
  - [ ] Check PWA install rate
  - [ ] Deploy to 50% of users
  - [ ] Monitor metrics
  - [ ] Deploy to 100% of users

- [ ] **Cleanup**
  - [ ] Remove old sw.js file
  - [ ] Remove manual registration code
  - [ ] Update PWA documentation
  - [ ] Archive old service worker

**Exit Criteria**:
- ✅ PWA installs successfully
- ✅ Offline mode works
- ✅ Push notifications functional
- ✅ Background sync enabled
- ✅ No increase in errors

---

## 📅 Phase 5: Monitoring & Testing (Week 9)

### Setup Monitoring
- [ ] **Lighthouse CI**
  - [ ] Configure Lighthouse CI
  - [ ] Set performance budgets
  - [ ] Add to CI/CD pipeline
  - [ ] Create reports dashboard

- [ ] **Error Tracking**
  - [ ] Verify Sentry configuration
  - [ ] Add performance monitoring
  - [ ] Configure alerts
  - [ ] Test error capture

- [ ] **Bundle Monitoring**
  - [ ] Setup bundle size tracking
  - [ ] Configure size budgets
  - [ ] Add to CI/CD pipeline
  - [ ] Create alerts for size increases

### End-to-End Testing
- [ ] **Critical User Flows**
  - [ ] Sign up → Login → Dashboard
  - [ ] Start review session → Complete review
  - [ ] Create payment → Subscribe
  - [ ] Admin login → User management

- [ ] **Security Testing**
  - [ ] Attempt unauthorized access (should 401)
  - [ ] Test rate limiting (should 429)
  - [ ] Verify CSRF protection
  - [ ] Check security headers
  - [ ] Run OWASP ZAP scan

- [ ] **Performance Testing**
  - [ ] Lighthouse all pages (target >90)
  - [ ] Test on 3G connection
  - [ ] Test on slow device
  - [ ] Load testing with Artillery

### Performance Benchmarking
- [ ] **Metrics Collection**
  - [ ] Record TTFB for all pages
  - [ ] Record FCP for all pages
  - [ ] Record LCP for all pages
  - [ ] Record CLS for all pages
  - [ ] Record bundle sizes

- [ ] **Comparison**
  - [ ] Compare with baseline (before)
  - [ ] Calculate improvements
  - [ ] Document in report
  - [ ] Share with team

### Documentation
- [ ] **Update README**
  - [ ] Add security section
  - [ ] Document new features
  - [ ] Update dependencies
  - [ ] Add troubleshooting

- [ ] **Update CLAUDE.md**
  - [ ] Document architectural changes
  - [ ] Update key file references
  - [ ] Add new patterns
  - [ ] Update insights

- [ ] **Create Changelog**
  - [ ] List all changes
  - [ ] Categorize by type
  - [ ] Note breaking changes
  - [ ] Credit contributors

- [ ] **Create Runbook**
  - [ ] Emergency procedures
  - [ ] Rollback steps
  - [ ] Monitoring guide
  - [ ] Common issues

**Exit Criteria**:
- ✅ All tests passing
- ✅ Performance targets met
- ✅ Documentation complete
- ✅ Monitoring operational

---

## 🎯 Final Success Criteria

### Security (Must Pass)
- [ ] 0 critical vulnerabilities
- [ ] 0 high vulnerabilities
- [ ] 100% admin routes protected
- [ ] 0 exposed debug endpoints
- [ ] Rate limiting on all public routes
- [ ] Security headers present
- [ ] OWASP ZAP scan clean

### Performance (Must Pass)
- [ ] Build size <1.5GB (currently 2.1GB)
- [ ] Initial bundle <500KB
- [ ] Page load <2s on 3G
- [ ] Lighthouse score >90 (all pages)
- [ ] TTFB improvement >20%
- [ ] FCP improvement >10%
- [ ] CLS <0.1

### Code Quality (Must Pass)
- [ ] 0 TypeScript errors
- [ ] 0 ESLint errors
- [ ] Strict mode enabled
- [ ] All tests passing
- [ ] Code coverage >80%

### User Experience (Must Pass)
- [ ] 0% increase in error rates
- [ ] PWA install rate >10%
- [ ] Offline functionality works
- [ ] Progressive loading smooth
- [ ] No layout shifts
- [ ] No broken features

---

## 📊 Metrics Dashboard

### Before Project
- Build Size: 2.1GB
- Initial Bundle: Unknown
- Lighthouse: Unknown
- TypeScript Errors: 2
- Security Vulnerabilities: 11 critical
- Protected Admin Routes: 0/11 (0%)
- Rate Limited Public Routes: 0/56 (0%)

### Target After Project
- Build Size: <1.5GB (-30%)
- Initial Bundle: <500KB
- Lighthouse: >90
- TypeScript Errors: 0
- Security Vulnerabilities: 0
- Protected Admin Routes: 11/11 (100%)
- Rate Limited Public Routes: 56/56 (100%)

### Actual Results (To Be Filled)
- Build Size: ___GB (___%)
- Initial Bundle: ___KB
- Lighthouse: ___
- TypeScript Errors: ___
- Security Vulnerabilities: ___
- Protected Admin Routes: ___/11 (___%)
- Rate Limited Public Routes: ___/56 (___%)

---

## 📝 Notes & Issues

### Blockers
_Document any blockers encountered_

### Decisions Made
_Document key technical decisions_

### Lessons Learned
_Document insights for future projects_

---

**Last Updated**: 2025-01-08
**Completion Target**: 2025-03-08 (9 weeks)
**Project Lead**: Development Team
