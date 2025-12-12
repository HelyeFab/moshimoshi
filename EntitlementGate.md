# Entitlement System Guide

This document details how the Moshimoshi entitlement system works, including configuration files, enforcement patterns, and best practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Configuration Files](#configuration-files)
3. [Enforcement Patterns](#enforcement-patterns)
4. [When to Use Each Pattern](#when-to-use-each-pattern)
5. [Implementation Examples](#implementation-examples)
6. [Current Usage in Codebase](#current-usage-in-codebase)

---

## Architecture Overview

The entitlement system controls feature access based on user subscription plans:

| Plan | Description | Stripe Integration |
|------|-------------|-------------------|
| `guest` | Unauthenticated users | None |
| `free` | Registered users (default) | None |
| `premium_monthly` | Monthly subscribers | `price_monthly_xxx` |
| `premium_yearly` | Annual subscribers | `price_yearly_yyy` |

### Limit Values

- `-1` = Unlimited access
- `0` = Completely blocked (premium-only)
- `1+` = Daily/monthly quota

---

## Configuration Files

The entitlement system uses **three files** that must stay in sync:

### 1. Source of Truth: `config/features.v1.json`

The master configuration file containing all feature definitions and limits.

```
config/features.v1.json
```

**Contains:**
- Feature definitions (id, name, category, lifecycle, etc.)
- Plan definitions (guest, free, premium_monthly, premium_yearly)
- Limits per plan (daily and monthly quotas)
- Stripe price ID mappings

**Example structure:**
```json
{
  "features": [
    {
      "id": "comics",
      "name": "Moshi Comics",
      "category": "learning",
      "lifecycle": "active",
      "permission": "do_practice",
      "limitType": "daily"
    }
  ],
  "limits": {
    "free": {
      "daily": {
        "comics": 0
      }
    },
    "premium_monthly": {
      "daily": {
        "comics": -1
      }
    }
  }
}
```

### 2. TypeScript Types: `src/types/FeatureId.ts`

**Generated from:** `config/features.v1.json`

```typescript
export type FeatureId = 'hiragana_practice' | 'comics' | /* ... */;

export const FEATURE_IDS = [
  'hiragana_practice',
  'comics',
  // ...
] as const;
```

**Purpose:** Type-safe feature ID references throughout the codebase.

### 3. Policy & Limits: `src/lib/entitlements/policy.ts`

**Generated from:** `config/features.v1.json`

```typescript
export const PLAN_LIMITS = {
  guest: { daily: { comics: 0 }, monthly: {} },
  free: { daily: { comics: 0 }, monthly: {} },
  premium_monthly: { daily: { comics: -1 }, monthly: {} },
  premium_yearly: { daily: { comics: -1 }, monthly: {} },
};
```

**Purpose:** Runtime access to limits, used by the evaluator.

### 4. Feature Registry: `src/lib/features/registry.ts`

**Generated from:** `config/features.v1.json`

```typescript
export const FEATURE_REGISTRY: Record<FeatureId, FeatureDefinition> = {
  comics: {
    id: 'comics',
    name: 'Moshi Comics',
    category: 'learning',
    lifecycle: 'active',
    permission: Permission.DO_PRACTICE,
    limitType: 'daily',
    notifications: false,
    description: 'Read Japanese manga-style comics...',
  },
};
```

**Purpose:** Feature metadata for UI display and logic.

### Keeping Files in Sync

When adding a new feature:

1. Add to `config/features.v1.json`
2. Run the generator: `npm run gen-entitlements`
3. Verify all three generated files are updated

> **Warning:** If files go out of sync, entitlement checks may fail silently or throw runtime errors.

---

## Enforcement Patterns

### Pattern 1: `EntitlementGate` Component (Page-Level)

Wraps entire page content. Blocks access before any content renders.

```tsx
import { EntitlementGate } from '@/components/review-engine/EntitlementGate';

export default function ComicsPage() {
  return (
    <EntitlementGate featureId="comics">
      {/* Page content only renders if access granted */}
      <ComicsContent />
    </EntitlementGate>
  );
}
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `featureId` | `FeatureId` | required | Feature to check |
| `children` | `ReactNode` | required | Content to render if allowed |
| `onAccessDenied` | `() => void` | - | Callback when blocked |
| `onAccessGranted` | `(decision) => void` | - | Callback when allowed |
| `showLimitDisplay` | `boolean` | `true` | Show remaining usage |
| `showUpgradePrompt` | `boolean` | `true` | Show upgrade CTA |

**Behavior:**
1. Shows loading spinner while checking
2. If denied: Shows "Feature Unavailable" + upgrade prompt
3. If allowed: Renders children

### Pattern 2: `useFeature` Hook (Action-Level)

Checks entitlement when user performs an action (button click, form submit).

```tsx
import { useFeature } from '@/hooks/useFeature';

export default function DrillPage() {
  const { checkAndTrack, remaining, isLoading } = useFeature('conjugation_drill');

  const handleStartDrill = async () => {
    const allowed = await checkAndTrack();
    if (allowed) {
      startDrill();
    }
    // If denied, toast notification shown automatically
  };

  return (
    <button onClick={handleStartDrill} disabled={isLoading}>
      Start Drill {remaining !== null && `(${remaining} left)`}
    </button>
  );
}
```

**Hook Returns:**
| Property | Type | Description |
|----------|------|-------------|
| `checkAndTrack` | `(options?) => Promise<boolean>` | Check + increment usage |
| `checkOnly` | `() => Promise<Decision>` | Check without incrementing |
| `remaining` | `number \| null` | Remaining uses (-1 = unlimited) |
| `isLoading` | `boolean` | Request in progress |
| `lastDecision` | `Decision \| null` | Last API response |
| `refresh` | `() => Promise<void>` | Clear cache and re-check |

---

## When to Use Each Pattern

### Use `EntitlementGate` When:

- Feature limit is `0` (premium-only, all-or-nothing)
- You want to block the entire page
- Simple implementation preferred
- No "preview" or "browse" mode for free users

**Examples:**
- Comics page (limit: 0 for free)
- Textbook Vocabulary page (limit: 0 for free)
- Premium-only tools

### Use `useFeature` Hook When:

- Feature has a daily/monthly quota (limit > 0)
- Users can browse but actions are limited
- Multiple actions on one page need individual checks
- You need granular control over UX

**Examples:**
- Conjugation Drill (5/day for free)
- Word Lookup (5/day for free)
- Media Upload (2/day for free)
- Grammar Explanations (3/day for free)

### Decision Matrix

| Scenario | Pattern | Reason |
|----------|---------|--------|
| `limit = 0` | `EntitlementGate` | All-or-nothing, simpler |
| `limit > 0` | `useFeature` | Need to track per-action |
| Browse + action | `useFeature` | Let users see content first |
| Entire page blocked | `EntitlementGate` | Single point of control |

---

## Implementation Examples

### Example 1: Premium-Only Page (Comics)

```tsx
// src/app/[locale]/comics/page.tsx
'use client';

import { EntitlementGate } from '@/components/review-engine/EntitlementGate';

export default function ComicsPage() {
  return (
    <EntitlementGate featureId="comics">
      <div className="min-h-screen">
        {/* All page content here */}
      </div>
    </EntitlementGate>
  );
}
```

### Example 2: Limited Actions (Drill)

```tsx
// src/app/[locale]/drill/page.tsx
'use client';

import { useFeature } from '@/hooks/useFeature';

export default function DrillPage() {
  const { checkAndTrack, remaining } = useFeature('conjugation_drill');

  const handleStart = async () => {
    const allowed = await checkAndTrack({ showUI: true });
    if (allowed) {
      // Start the drill
    }
  };

  return (
    <div>
      <h1>Conjugation Drill</h1>
      <p>Sessions remaining today: {remaining ?? '...'}</p>
      <button onClick={handleStart}>Start Practice</button>
    </div>
  );
}
```

### Example 3: Check Without Incrementing

```tsx
// Just check, don't count as usage
const { checkOnly } = useFeature('grammar_explanations');

useEffect(() => {
  const check = async () => {
    const decision = await checkOnly();
    if (!decision?.allow) {
      setShowUpgradePrompt(true);
    }
  };
  check();
}, []);
```

---

## Current Usage in Codebase

### `EntitlementGate` Component Usage

| File | Feature | Notes |
|------|---------|-------|
| `test-entitlements/page.tsx` | `hiragana_practice` | Test page only |
| `comics/page.tsx` | `comics` | Premium-only |
| `textbook-vocabulary/page.tsx` | `textbook_vocabulary` | Premium-only |

### `useFeature` Hook Usage

| File | Feature | Method |
|------|---------|--------|
| `drill/page.tsx` | `conjugation_drill` | `checkAndTrack` |
| `my-videos/MyVideos.tsx` | `media_upload` | `checkAndTrack` |
| `vocabulary/WordDetailsModal.tsx` | `word_lookup` | `checkAndTrack` |
| `kana-drop/KanaDropModal.tsx` | `kana_drop` | `checkAndTrack` |
| `GrammarExplanationTrigger.tsx` | `grammar_explanations` | `checkOnly` |

---

## Maintenance Considerations

### Pattern 1 (`EntitlementGate`) - Lower Risk

- Single wrapper per page
- Impossible to forget if page loads
- Built-in loading/denied states
- **Risk:** If gate has bug, entire page broken

### Pattern 2 (`useFeature`) - Higher Risk

- Must add check to every action
- Easy to forget checks on new features
- More places for bugs to hide
- **Risk:** Inconsistent UX, forgotten checks

### Recommendation

For **premium-only features** (`limit = 0`), always use `EntitlementGate`:
- One line change
- No risk of forgetting to gate an action
- Clear UX: "This is premium, upgrade to access"

For **quota-based features** (`limit > 0`), use `useFeature`:
- Users can browse content
- Check happens when they consume
- Shows remaining count

---

## API Endpoints

The entitlement system uses these API routes:

- `GET /api/usage/[featureId]/check` - Check access without incrementing
- `POST /api/usage/[featureId]/increment` - Check and increment usage

Both endpoints:
1. Fetch fresh user data from Firestore (never trust session)
2. Call the evaluator with current usage
3. Return a `Decision` object

```typescript
interface Decision {
  allow: boolean;
  remaining: number | -1;
  reason: 'ok' | 'no_permission' | 'limit_reached' | 'lifecycle_blocked';
  policyVersion: number;
  resetAtUtc?: string;
  limit?: number;
  usageBefore?: number;
}
```

---

## Troubleshooting

### "Feature not found" Error

Check that all three files are in sync:
1. Feature exists in `config/features.v1.json`
2. Feature exists in `src/types/FeatureId.ts`
3. Feature exists in `src/lib/entitlements/policy.ts`

Run `npm run gen-entitlements` to regenerate.

### Limits Not Enforced

Verify the page/component actually uses `EntitlementGate` or `useFeature`. Having limits in the config does nothing without enforcement code.

### Cached Decision Stale

The `useFeature` hook caches decisions for 60 seconds. Call `refresh()` to clear cache, or it auto-clears when subscription changes.
