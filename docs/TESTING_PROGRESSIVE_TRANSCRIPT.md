# Testing Guide: Progressive Transcript System

## Overview

This guide covers automated and manual testing for the Progressive Transcript Loading system.

## Quick Start

### Run All Tests
```bash
./scripts/test-progressive-transcript.sh
```

### Run Individual Test Suites
```bash
# Unit tests (hook)
npm test -- src/hooks/__tests__/useProgressiveTranscript.test.tsx

# Component tests
npm test -- src/components/youtube-shadowing/__tests__/CaptionDisplay.test.tsx

# E2E tests
npx playwright test e2e/progressive-transcript.spec.ts

# Type checking
npm run type-check
```

---

## Automated Tests

### 1. Unit Tests (`useProgressiveTranscript` Hook)

**Location**: `src/hooks/__tests__/useProgressiveTranscript.test.tsx`

**Coverage**:
- ✅ Phase 1: Raw transcript loading (1-3s)
- ✅ Phase 2: AI enhancement in background
- ✅ Progress tracking (0-100%)
- ✅ Error handling (invalid URLs, missing Japanese, network errors)
- ✅ Video ID extraction (all YouTube URL formats)
- ✅ Options passing (maxSegmentLength, addFurigana, etc.)
- ✅ Cleanup on unmount

**Run**:
```bash
npm test -- useProgressiveTranscript.test
```

**Key Tests**:
- `should fetch raw transcript immediately` - Verifies 1-3s loading
- `should trigger AI enhancement after raw transcript loads` - Tests background processing
- `should handle AI enhancement failure gracefully` - Ensures user can continue with raw
- `should extract video ID from [various formats]` - Tests URL parsing

### 2. Component Tests (`CaptionDisplay`)

**Location**: `src/components/youtube-shadowing/__tests__/CaptionDisplay.test.tsx`

**Coverage**:
- ✅ Rendering (full transcript, current-only, empty state)
- ✅ Click-to-jump functionality
- ✅ Visual hierarchy (Active/Past/Future)
- ✅ Translations display
- ✅ Time formatting
- ✅ Current/Full toggle

**Run**:
```bash
npm test -- CaptionDisplay.test
```

**Key Tests**:
- `should call onSeekToTime when segment clicked` - Tests click-to-jump
- `should highlight active segment` - Tests visual feedback
- `should dim past segments` - Tests hierarchy
- `should show translations when available` - Tests AI features

### 3. E2E Tests (Playwright)

**Location**: `e2e/progressive-transcript.spec.ts`

**Coverage**:
- ✅ Complete user flow (URL paste → transcript load)
- ✅ Performance (1-3s raw load time)
- ✅ AI progress indicator visibility
- ✅ Immediate shadowing ability
- ✅ Smooth AI transition
- ✅ Click-to-jump in real browser
- ✅ Current/Full toggle
- ✅ Error handling
- ✅ Mobile experience

**Run**:
```bash
# Start dev server first
npm run dev

# In another terminal
npx playwright test progressive-transcript
```

**Key Tests**:
- `should load raw transcript in 1-3 seconds` - Performance verification
- `should allow user to start shadowing immediately` - UX verification
- `should smoothly transition to AI-enhanced transcript` - Transition testing
- Mobile tests - Touch targets, responsive design

---

## Manual Testing Checklist

### Basic Flow
- [ ] Paste YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- [ ] Raw transcript loads in 1-3 seconds
- [ ] Video player appears immediately
- [ ] Can click any segment to jump
- [ ] AI progress bar shows up
- [ ] Progress increases smoothly (0% → 100%)
- [ ] Transcript updates after ~25 seconds
- [ ] All AI features present (translations, difficulty, etc.)

### Performance Verification
- [ ] Start timer when pasting URL
- [ ] Stop when transcript appears
- [ ] Should be < 3 seconds
- [ ] AI completes in < 30 seconds total

### Click-to-Jump
- [ ] Click first segment → Video seeks to 0:00
- [ ] Click middle segment → Video seeks correctly
- [ ] Click last segment → Video seeks correctly
- [ ] Active segment highlights immediately (<50ms)
- [ ] Auto-scroll follows active segment

### Current/Full Toggle
- [ ] Start in Full Transcript mode
- [ ] Click "Current Only" button
- [ ] See active segment + LIVE indicator
- [ ] See "Coming up" preview (next 3 segments)
- [ ] Click segment in preview → Jumps correctly
- [ ] Click "Full Transcript" button
- [ ] See all segments again
- [ ] Auto-scroll still works

### AI Enhancement
- [ ] Purple progress bar appears after raw load
- [ ] Status messages change:
  - "Analyzing speech patterns..."
  - "Optimizing line breaks..."
  - "Adding educational features..."
- [ ] Progress percentage increases
- [ ] Success toast appears when complete
- [ ] Transcript smoothly fades to enhanced version
- [ ] Source indicator changes: "Raw" → "AI-Enhanced"

### Error Handling
- [ ] Try invalid URL: `not-a-valid-url`
  - Should show "Invalid YouTube URL" error
- [ ] Try video without Japanese captions
  - Should show "No Japanese transcript" error
- [ ] AI enhancement fails (mock by disabling network)
  - Should continue with raw transcript
  - Should show warning toast

### Mobile Experience
- [ ] Test on mobile viewport (375x667)
- [ ] Touch targets large enough (≥44x44px)
- [ ] Current/Full toggle tappable
- [ ] Segments tappable
- [ ] Progress bar visible
- [ ] Auto-scroll smooth on mobile

---

## Test Data

### Valid YouTube URLs
```
Standard: https://www.youtube.com/watch?v=dQw4w9WgXcQ
Short:    https://youtu.be/dQw4w9WgXcQ
Embed:    https://www.youtube.com/embed/dQw4w9WgXcQ
Shorts:   https://www.youtube.com/shorts/dQw4w9WgXcQ
```

### Invalid URLs
```
Not a URL:        not-a-valid-url
Wrong domain:     https://vimeo.com/123456
Missing video ID: https://www.youtube.com/watch
```

### Special Cases
```
No Japanese:      https://www.youtube.com/watch?v=jNQXAC9IVRw
Private video:    https://www.youtube.com/watch?v=privatevideo123
Deleted video:    https://www.youtube.com/watch?v=deletedvideo123
```

---

## Performance Benchmarks

### Expected Times
| Metric | Target | Acceptable | Unacceptable |
|--------|--------|------------|--------------|
| Raw Transcript Load | 1-2s | <3s | >3s |
| AI Enhancement | 15-25s | <30s | >30s |
| Click-to-Jump | <50ms | <100ms | >100ms |
| Auto-Scroll | <16ms (60fps) | <33ms (30fps) | >33ms |
| Transition Animation | 300-400ms | <500ms | >500ms |

### Measuring Performance

```typescript
// In browser console
const startTime = performance.now();

// ... paste URL, wait for transcript ...

const loadTime = performance.now() - startTime;
console.log(`Load time: ${loadTime}ms`); // Should be < 3000ms
```

---

## Debugging Failed Tests

### Unit Test Failures

**Issue**: "Hook tests timing out"
```bash
# Increase Jest timeout
npm test -- --testTimeout=10000
```

**Issue**: "Mock fetch not working"
```javascript
// Check mock is set up before test
beforeEach(() => {
  global.fetch = jest.fn();
});
```

### Component Test Failures

**Issue**: "Can't find segment by text"
```javascript
// Use more flexible matchers
await waitFor(() => {
  expect(screen.getByText(/こんにちは/i)).toBeInTheDocument();
});
```

### E2E Test Failures

**Issue**: "Transcript not loading in E2E"
```bash
# Ensure dev server is running
npm run dev

# Check network tab in Playwright trace
npx playwright test --trace on
```

**Issue**: "Timeout waiting for AI enhancement"
```typescript
// Increase timeout for slow AI
await expect(page.locator('text=/AI-Enhanced/i')).toBeVisible({
  timeout: 60000 // 60 seconds
});
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Test Progressive Transcript

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- useProgressiveTranscript.test CaptionDisplay.test

      - name: Run type checking
        run: npm run type-check

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: |
          npm run dev &
          sleep 10
          npx playwright test progressive-transcript

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Coverage Goals

### Minimum Coverage
- **Hooks**: 90%
- **Components**: 85%
- **E2E**: Critical paths covered

### Current Coverage
```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

---

## Common Issues & Solutions

### Issue: "AI enhancement never starts"

**Cause**: `enableAI: false` or fetch error

**Solution**:
```typescript
// Check option
const { aiEnhancing } = useProgressiveTranscript(url, {
  enableAI: true // Make sure this is true
});

// Check network tab for /api/youtube/extract POST
```

### Issue: "Progress stays at 0%"

**Cause**: Progress interval not started

**Solution**: Check console for errors, verify progressInterval is running

### Issue: "Auto-scroll too aggressive"

**Cause**: Buffer zones too small

**Solution**: Already fixed with 100px buffers in CaptionDisplay.tsx:83-86

### Issue: "Tests pass locally but fail in CI"

**Cause**: Timing differences in CI environment

**Solution**: Increase timeouts in CI:
```javascript
const timeout = process.env.CI ? 10000 : 5000;
await waitFor(() => {}, { timeout });
```

---

## Next Steps

After all tests pass:

1. **Review coverage report** - Aim for >85%
2. **Manual smoke test** - Test real YouTube videos
3. **Performance audit** - Use Chrome DevTools
4. **Accessibility audit** - Use Lighthouse
5. **Deploy to staging** - Test in production-like environment
6. **User acceptance testing** - Get feedback from real users

---

**Last Updated**: 2025-11-03
**Test Suite Version**: 1.0.0
