# Feature Usage Indicator - Integration Guide

## 📋 Overview

The **FeatureUsageIndicator** component displays user's daily/monthly usage limits with a responsive design:
- **Desktop**: Circular progress indicator in page header (top-right)
- **Mobile**: Horizontal gradient progress bar under page header

**Auto-updates in real-time** as users consume their limits.

⚠️ **IMPORTANT**: This component only **displays** usage. To **enforce** access control, you must ALSO use `useFeature().checkOnly()` or `checkAndTrack()` before allowing feature access.

---

## 🔐 Access Control vs Display

This component is **ONLY for display**. You need **two separate integrations**:

### 1️⃣ Display Usage (This Component)
Shows users their remaining limits:
```typescript
const usageData = useFeatureUsage('kanji_mood_board');
<DesktopCircularIndicator {...usageData} />
```

### 2️⃣ Enforce Access Control (`useFeature` hook)
Checks if user can access feature:
```typescript
const { checkOnly } = useFeature('kanji_mood_board');

const handleClick = async () => {
  const decision = await checkOnly({ failOpen: false });
  if (!decision.allow) {
    showToast('Limit reached!', 'warning');
    return;
  }
  // Allow access
};
```

**Both are required!** The indicator shows limits, but `useFeature` enforces them.

---

## 🎯 Quick Start

### Step 1: Import the Components

```typescript
import {
  useFeatureUsage,
  DesktopCircularIndicator,
  FeatureUsageIndicator
} from '@/components/entitlements/FeatureUsageIndicator';
```

### Step 2: Get Usage Data

```typescript
export default function YourPage() {
  const usageData = useFeatureUsage('your_feature_id'); // e.g., 'kanji_mood_board'

  // ... rest of component
}
```

### Step 3: Add Desktop Indicator to PageHeader

```typescript
<PageHeader
  title="Your Page Title"
  description="Your description"
  actions={
    usageData.hasData ? (
      <DesktopCircularIndicator
        remaining={usageData.remaining}
        limitCount={usageData.limitCount}
        usedCount={usageData.usedCount}
        color={usageData.color}
      />
    ) : null
  }
/>
```

### Step 4: Add Mobile Indicator Below Header

```typescript
<FeatureUsageIndicator featureId="your_feature_id" />
```

---

## 📦 Complete Example

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { useFeature } from '@/hooks/useFeature';
import { useToast } from '@/components/ui/Toast/ToastContext';
import PageHeader from '@/components/ui/PageHeader';
import {
  useFeatureUsage,
  DesktopCircularIndicator,
  FeatureUsageIndicator
} from '@/components/entitlements/FeatureUsageIndicator';

export default function NewsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { showToast } = useToast();

  // 1. For ACCESS CONTROL (enforcement)
  const { checkOnly } = useFeature('news_reading');

  // 2. For DISPLAY (usage indicator)
  const usageData = useFeatureUsage('news_reading');

  // Handle click with access control
  const handleArticleClick = async (articleId: string) => {
    // Check if user has access
    const decision = await checkOnly({ failOpen: false });

    if (!decision.allow) {
      showToast(t('entitlements.messages.limitReached'), 'warning');
      return;
    }

    // User has access, proceed
    router.push(`/news/${articleId}`);
  };

  return (
    <div className="min-h-screen">
      {/* Page Header with Desktop Circular Indicator */}
      <PageHeader
        title={t('news.title')}
        description={t('news.description')}
        actions={
          usageData.hasData ? (
            <DesktopCircularIndicator
              remaining={usageData.remaining}
              limitCount={usageData.limitCount}
              usedCount={usageData.usedCount}
              color={usageData.color}
            />
          ) : null
        }
      />

      {/* Mobile Progress Bar - Shows under header on mobile only */}
      <FeatureUsageIndicator featureId="news_reading" />

      {/* Your page content with access control */}
      <div className="container mx-auto px-4 py-8">
        <button onClick={() => handleArticleClick('article-123')}>
          Read Article
        </button>
      </div>
    </div>
  );
}
```

---

## 🔑 Feature IDs Reference

Feature IDs must match those defined in `config/features.v1.json`:

| Feature ID | Display Name | Default Limit (Free) |
|-----------|--------------|---------------------|
| `kanji_mood_board` | Kanji Mood Board | 5 daily |
| `news_reading` | News Reading | 2 daily |
| `grammar_explanations` | Grammar Explanations | 3 daily |
| `word_explanations` | Word Explanations | 5 daily |
| `custom_lists` | Custom Lists | 3 monthly |
| `flashcard_decks` | Flashcard Decks | 5 monthly |

**To add a new feature with limits:**
1. Add feature definition to `config/features.v1.json`
2. Define limits in the `limits` section
3. Use the same `featureId` in the component

---

## 🎨 Visual Behavior

### Desktop (≥ 640px)
```
┌─────────────────────────────────────┐
│  Page Title                ⭕ 5     │ ← Circular progress
│  Description                /5      │   in header actions
└─────────────────────────────────────┘
```

### Mobile (< 640px)
```
┌─────────────────────────────────────┐
│  Page Title                         │
│  Description                        │
└─────────────────────────────────────┘
    ┌───────────────────────────┐      ← Margins (px-4)
    │ 5 / 5                     │
    │ ████████████░░░░░░░       │      ← Gradient bar
    └───────────────────────────┘
┌─────────────────────────────────────┐
│  Page Content                       │
```

### Color Coding

The indicator automatically changes color based on usage:

| Usage | Color | Meaning |
|-------|-------|---------|
| 0-79% | 🟢 Green | Plenty remaining |
| 80-99% | 🟡 Yellow | Running low |
| 100% | 🔴 Red | Limit reached |

---

## 🔧 API Reference

### `useFeatureUsage(featureId: FeatureId)`

**Returns:**
```typescript
{
  lastDecision: Decision | null,  // Raw decision from entitlements
  remaining: number,              // Sessions remaining (e.g., 5)
  limitCount: number,             // Total limit (e.g., 5)
  usedCount: number,              // Sessions used (e.g., 0)
  isUnlimited: boolean,           // True if premium/unlimited
  color: 'green' | 'yellow' | 'red', // Color based on usage
  hasData: boolean                // True if should display
}
```

**Example:**
```typescript
const usageData = useFeatureUsage('kanji_mood_board');

if (usageData.hasData) {
  console.log(`${usageData.remaining} / ${usageData.limitCount} remaining`);
}
```

### `DesktopCircularIndicator`

**Props:**
```typescript
interface DesktopCircularIndicatorProps {
  remaining: number;      // Sessions remaining
  limitCount: number;     // Total limit
  usedCount: number;      // Sessions used
  color: 'green' | 'yellow' | 'red';
  className?: string;     // Optional custom classes
}
```

**Visual:** Circular progress ring with count in center (desktop only)

### `FeatureUsageIndicator`

**Props:**
```typescript
interface FeatureUsageIndicatorProps {
  featureId: FeatureId;   // Feature to track
  className?: string;     // Optional custom classes
}
```

**Visual:** Horizontal gradient progress bar (mobile only)

### `MobileBarIndicator`

**Props:**
```typescript
interface MobileBarIndicatorProps {
  remaining: number;      // Sessions remaining
  limitCount: number;     // Total limit
  className?: string;     // Optional custom classes
}
```

**Note:** Usually not used directly. Use `FeatureUsageIndicator` instead.

---

## 🧪 Testing Integration

### 1. Check Component Renders

```typescript
import { render, screen } from '@testing-library/react';
import { useFeatureUsage } from '@/components/entitlements/FeatureUsageIndicator';

// In your test
const usageData = useFeatureUsage('kanji_mood_board');
expect(usageData.hasData).toBe(true);
```

### 2. Test with Different Limits

```bash
# Reset your usage to 0
node scripts/reset-feature-usage.js <userId> kanji_mood_board

# Check current usage
node scripts/check-entitlements.js <userId>
```

### 3. Verify Responsive Behavior

- **Desktop**: Resize browser to >640px → Should see circular indicator
- **Mobile**: Resize to <640px → Should see gradient bar under header

---

## 🐛 Troubleshooting

### Issue: Indicator Not Showing

**Possible causes:**

1. **Feature ID incorrect**
   - Check `config/features.v1.json` for valid IDs
   - IDs are case-sensitive

2. **User is unlimited (Premium)**
   - Indicator hides for unlimited users
   - Check with free account

3. **Decision not loaded yet**
   - `useFeatureUsage` calls `checkOnly()` on mount
   - May take 1-2 seconds to load
   - Check console for errors

4. **Missing import**
   ```typescript
   // ❌ Wrong
   import { FeatureUsageIndicator } from '@/components/ui/ProgressBar';

   // ✅ Correct
   import { FeatureUsageIndicator } from '@/components/entitlements/FeatureUsageIndicator';
   ```

### Issue: Wrong Count Displayed

**Debug steps:**

1. Check browser console for:
   ```
   [FeatureUsageIndicator] Debug: { remaining: X, limitCount: Y }
   ```

2. Verify usage in database:
   ```bash
   node scripts/check-entitlements.js <userId>
   ```

3. Check feature config:
   ```bash
   cat config/features.v1.json | grep -A 10 "your_feature_id"
   ```

### Issue: Not Updating After Use

**Possible causes:**

1. **Feature not being tracked**
   - Check if `checkAndTrack()` is called when feature is used
   - See `src/hooks/useFeature.ts`

2. **Decision cache stale**
   - Cache TTL is 60 seconds by default
   - Component will update within 60 seconds
   - Force refresh by calling `checkOnly({ skipCache: true })`

3. **Offline usage**
   - Offline deltas sync when network reconnects
   - May take a few seconds

---

## 📊 Where It's Currently Used

| Page | Feature ID | Location |
|------|-----------|----------|
| Kanji Moods | `kanji_mood_board` | `src/app/[locale]/kanji-moods/page.tsx:172-187` |
| Kanji Moods (Alt) | `kanji_mood_board` | `src/app/[locale]/kanji-moods/KanjiMoodsPage.tsx:155-170` |

---

## 🎯 Best Practices

### ✅ DO

- **ALWAYS use `useFeature().checkOnly()` for access control** - The indicator is display-only!
- **Use the same featureId** for both desktop and mobile indicators
- **Place desktop indicator** in PageHeader `actions` slot
- **Place mobile indicator** directly after PageHeader
- **Check `hasData`** before rendering desktop indicator
- **Test with free account** to see limits
- **Show error toast** when `checkOnly()` denies access

### ❌ DON'T

- ❌ **DON'T rely on indicator alone** - Always check with `useFeature()` before granting access
- Don't create custom indicators - use the provided components
- Don't hardcode limit values - they come from `config/features.v1.json`
- Don't show indicators for unlimited features (auto-hidden)
- Don't forget to import all three exports
- Don't place mobile indicator inside PageHeader
- Don't forget to handle `decision.allow === false` case

---

## 🔄 How It Updates

The indicator updates automatically through:

1. **Initial Load**
   - `useFeatureUsage()` calls `checkOnly()` on mount
   - Fetches current usage from server

2. **After Feature Use**
   - `checkAndTrack()` updates usage
   - Triggers re-render via `lastDecision` state

3. **Offline Sync**
   - Local deltas tracked in localStorage
   - Synced to server on reconnect
   - Component updates after sync

4. **SWR Cache**
   - Subscription data refreshes every 30 seconds
   - Keeps limits in sync with server

**Cache TTL:** 60 seconds (configurable in `useFeature.ts:43`)

---

## 🚀 Advanced Usage

### Custom Styling

```typescript
<FeatureUsageIndicator
  featureId="kanji_mood_board"
  className="mt-6" // Add custom margin
/>

<DesktopCircularIndicator
  {...usageData}
  className="ring-2 ring-primary-500" // Custom ring
/>
```

### Conditional Display

```typescript
// Only show on specific pages
{pathname.includes('/practice') && (
  <FeatureUsageIndicator featureId="kanji_mood_board" />
)}

// Show different message when limit reached
{usageData.remaining === 0 && (
  <div className="text-red-500">
    Daily limit reached! Try again tomorrow.
  </div>
)}
```

### Access Raw Data

```typescript
const usageData = useFeatureUsage('kanji_mood_board');

console.log({
  remaining: usageData.remaining,      // 3
  total: usageData.limitCount,         // 5
  used: usageData.usedCount,           // 2
  percentage: (usageData.usedCount / usageData.limitCount) * 100  // 40%
});
```

---

## 📝 Related Documentation

- **Entitlements System**: `/01_PRODUCTION_DOCS/2-Payment-Monetization/OFFLINE_ENTITLEMENTS_COMPLIANT_DESIGN.md`
- **Feature Configuration**: `/config/features.v1.json`
- **Usage Hooks**: `/src/hooks/useFeature.ts`
- **Progress Bar Components**: `/src/components/ui/ProgressBar.tsx`

---

## 🆘 Support

If you encounter issues:

1. Check console for errors
2. Verify feature ID in `config/features.v1.json`
3. Test with scripts:
   - `node scripts/check-entitlements.js <userId>`
   - `node scripts/reset-feature-usage.js <userId> <featureId>`
4. Check this guide's troubleshooting section
5. Review working example: `src/app/[locale]/kanji-moods/page.tsx`

---

**Last Updated:** 2026-01-13
**Version:** 1.0
**Author:** Development Team
