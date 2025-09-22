# Current Authentication State Analysis

## Two Authentication Implementations Found

### 1. `/src/hooks/useAuth.tsx`
- **Type**: Client-side Firebase auth with React Context
- **Location**: Main auth hook used by most components
- **Provider**: `AuthProvider` exported from same file
- **Operations**: signIn, signUp, signInWithGoogle, logout
- **Session**: Creates server session via `/api/auth/login` or `/api/auth/google`

### 2. `/src/lib/auth/AuthContext.tsx`
- **Type**: Different context implementation
- **Location**: Alternative auth context (appears to be newer)
- **Provider**: Different `AuthProvider` implementation
- **Note**: Currently NOT imported by any files

## Current Usage Pattern

### Files Using Old Pattern (`/src/hooks/useAuth`)
Total: **17 files directly importing**

#### Critical Infrastructure (Must Work)
| File | Risk | Current State | Notes |
|------|------|--------------|-------|
| `/app/layout.tsx` | 🔴 Critical | Using AuthProvider | Wraps entire app |
| `/app/page.tsx` | 🔴 Critical | COMMENTED OUT | Already migrated to API pattern |
| `/app/kanji-browser/page.tsx` | 🔴 Critical | Active | Major learning feature |

#### Core Learning Components
| File | Risk | Usage |
|------|------|-------|
| `/components/learn/KanaLearningComponent.tsx` | 🔴 Critical | Active |
| `/components/kanji/KanjiStudyMode.tsx` | 🟡 Medium | Active |
| `/components/learn/KanaStudyMode.tsx` | 🟡 Medium | Active |

#### Shared Hooks (Affect Multiple Pages)
| Hook | Risk | Dependent Files | Impact |
|------|------|----------------|--------|
| `/hooks/useKanjiBrowser.ts` | 🔴 Critical | 5 files | Breaks kanji features |
| `/hooks/useSubscription.ts` | 🔴 Critical | 8 files | Breaks payments |
| `/hooks/usePokemonCatch.ts` | 🟢 Low | 3 files | Gamification only |

#### User-Facing Pages
| Page | Risk | Purpose |
|------|------|---------|
| `/app/review/page.tsx` | 🟡 Medium | Review system |
| `/app/settings/page.tsx` | 🟡 Medium | User settings |
| `/app/pricing/page.tsx` | 🟡 Medium | Monetization |

#### Components
| Component | Risk | Purpose |
|-----------|------|---------|
| `/components/sync/SyncStatusIndicator.tsx` | 🟡 Medium | Data sync UI |
| `/components/pokedex/PokedexCard.tsx` | 🟢 Low | Gamification |
| `/components/pokedex/PokedexContent.tsx` | 🟢 Low | Gamification |

#### Admin Pages (Low Priority)
| Page | Risk | Purpose |
|------|------|---------|
| `/app/admin/entitlements/page.tsx` | 🟢 Low | Admin only |
| `/app/admin/decision-explorer/page.tsx` | 🟢 Low | Admin only |

### Files Using New Pattern (API-based)
Total: **12 files using `/api/auth/session`**

#### Successfully Migrated
- `/app/favourites/page.tsx` ✅
- `/app/learn/vocabulary/page.tsx` ✅
- `/app/my-items/page.tsx` ✅
- `/app/dashboard/page.tsx` ✅
- `/app/account/page.tsx` ✅
- `/app/contact/page.tsx` ✅
- `/app/terms/page.tsx` ✅
- `/app/privacy/page.tsx` ✅
- `/app/auth-test/page.tsx` ✅

#### Partially Migrated
- `/app/page.tsx` (useAuth import commented out, using API)

## Dependency Chain Analysis

### High-Impact Hooks
These hooks are imported by many components, creating cascading dependencies:

#### `useKanjiBrowser` Chain (5 dependent files)
```
useKanjiBrowser.ts
  └─> uses useAuth
      └─> requires AuthProvider
          └─> breaks if not wrapped
```
Dependent files:
- `/app/kanji-browser/page.tsx`
- `/app/dashboard/page.tsx`
- `/app/learn/vocabulary/page.tsx`
- `/components/kanji/KanjiStudyMode.tsx`
- `/components/learn/KanaStudyMode.tsx`

#### `useSubscription` Chain (8 dependent files)
```
useSubscription.ts
  └─> uses useAuth
      └─> requires AuthProvider
          └─> breaks if not wrapped
```
Dependent files:
- `/app/pricing/page.tsx`
- `/app/account/page.tsx`
- `/app/settings/page.tsx`
- `/app/dashboard/page.tsx`
- `/components/layout/Navbar.tsx`
- `/components/subscription/SubscriptionStatus.tsx`
- `/hooks/useFeature.ts`
- `/components/sync/SyncStatusIndicator.tsx`

#### `usePokemonCatch` Chain (3 dependent files)
```
usePokemonCatch.ts
  └─> uses useAuth
      └─> requires AuthProvider
          └─> breaks if not wrapped
```
Dependent files:
- `/components/pokedex/PokedexCard.tsx`
- `/components/pokedex/PokedexContent.tsx`
- `/components/pokedex/TestPokemonCatch.tsx`

## Modified Hooks (Already Fixed)
These hooks were modified to accept `user` as a parameter:
- `useStudyLists({ user })` ✅
- `useStudyItems({ user })` ✅
- `useStudyList({ user, listId })` ✅

## Key Findings

### 1. Dual AuthProvider Confusion
- Two different AuthProvider implementations exist
- `/src/hooks/useAuth.tsx` - Currently used in layout.tsx
- `/src/lib/auth/AuthContext.tsx` - Not used anywhere

### 2. Mixed Migration State
- 12 files successfully using new API pattern
- 17 files still using old context pattern
- 1 file (homepage) partially migrated

### 3. AuthProvider IS Working
- `layout.tsx` wraps app with AuthProvider
- Old pattern technically works but creates confusion
- Issue is inconsistency, not functionality

### 4. Dependency Web
- Total affected files: **37** (17 direct + 20 indirect)
- Critical hooks create cascading failures
- Migration of one hook affects multiple pages

## Risk Assessment Summary

| Risk Level | Direct Files | Indirect Files | Total |
|------------|-------------|----------------|-------|
| 🔴 Critical | 5 | 10+ | 15+ |
| 🟡 Medium | 6 | 8+ | 14+ |
| 🟢 Low | 6 | 2+ | 8+ |
| **Total** | **17** | **20** | **37** |

## Recommended Migration Order

1. **Create unified hook first** (no breaking changes)
2. **Test with low-risk files** (admin pages, gamification)
3. **Update shared hooks** (fixes multiple pages at once)
4. **Migrate medium-risk pages** (settings, pricing, review)
5. **Migrate critical pages** (homepage, kanji-browser)
6. **Update layout.tsx last** (highest risk)

## Notes for Migration

### Guest Mode Considerations
- Several pages check `sessionStorage.getItem('isGuestUser')`
- Must ensure unified auth handles guest mode
- Test guest → authenticated user transition

### Special Cases
- Homepage has useAuth commented out but still imported
- Some components use both patterns (fetch + useAuth)
- Admin pages may have special permission requirements

### Testing Requirements
- Login/logout flow
- Google OAuth
- Session persistence
- Guest mode
- Protected routes
- Subscription features
- Study list access
- Favorites functionality