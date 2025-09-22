# Authentication Migration Plan

## Overview
The Moshimoshi app currently has two incompatible authentication patterns that are causing confusion and maintenance issues. This document outlines the migration plan to a unified authentication system.

## Problem Statement

### Current Dual Pattern Issue
The app has TWO authentication patterns that were incompatible:

1. **Old Pattern (React Context-based):**
   ```typescript
   import { useAuth } from '@/hooks/useAuth'
   const { user } = useAuth();
   ```
   - Requires components to be wrapped in `<AuthProvider>`
   - Currently wrapping the app in `layout.tsx`
   - Causes "useAuth must be used within an AuthProvider" errors when not properly wrapped

2. **New Pattern (API-based):**
   ```typescript
   const [user, setUser] = useState(null);
   const response = await fetch('/api/auth/session');
   const data = await response.json();
   if (data.authenticated) setUser(data.user);
   ```
   - Direct API calls, no provider needed
   - Works everywhere but requires boilerplate

### Dependency Chain Problem
Even if a page uses the new pattern, if it imports a hook that internally uses the old pattern, it fails:
- `FavouritesPage` (new) → `useStudyLists` (old) → `useAuth` (old) → 💥 Error!

## Solution: Unified Authentication Hook

### Implementation Strategy
Create a single `useUnifiedAuth` hook that:
1. Intelligently handles both patterns
2. Works with or without AuthProvider
3. Provides consistent interface across the app
4. Enables gradual migration

### Affected Files

#### Direct Imports (17 files)
**Critical Risk (6 files):**
- `/app/layout.tsx`
- `/app/page.tsx`
- `/app/kanji-browser/page.tsx`
- `/components/learn/KanaLearningComponent.tsx`
- `/hooks/useKanjiBrowser.ts`
- `/hooks/useSubscription.ts`

**Medium Risk (6 files):**
- `/app/review/page.tsx`
- `/app/settings/page.tsx`
- `/app/pricing/page.tsx`
- `/components/sync/SyncStatusIndicator.tsx`
- `/components/kanji/KanjiStudyMode.tsx`
- `/components/learn/KanaStudyMode.tsx`

**Low Risk (5 files):**
- `/hooks/usePokemonCatch.ts`
- `/components/pokedex/PokedexCard.tsx`
- `/components/pokedex/PokedexContent.tsx`
- `/app/admin/entitlements/page.tsx`
- `/app/admin/decision-explorer/page.tsx`

#### Indirect Dependencies (20 files)
Files that import hooks which depend on `useAuth`:
- `/app/favourites/page.tsx`
- `/app/learn/vocabulary/page.tsx`
- `/app/my-items/page.tsx`
- `/app/dashboard/page.tsx`
- `/app/account/page.tsx`
- `/components/layout/Navbar.tsx`
- `/components/layout/StreakCounter.tsx`
- And 13 others...

## Migration Phases

### Phase 1: Documentation & Analysis ✅
- Document current state
- Map all dependencies
- Create migration plan

### Phase 2: Build Unified Hook
- Create `/src/hooks/useUnifiedAuth.ts`
- Implement dual-pattern support
- Add comprehensive error handling

### Phase 3: Testing Infrastructure
- Write unit tests
- Create integration tests
- Test edge cases

### Phase 4: Migration - Direct Imports
- Update all 17 files with direct imports
- Start with low-risk files
- Progress to critical files

### Phase 5: Migration - Dependent Hooks
- Update `useKanjiBrowser`
- Update `useSubscription`
- Update `usePokemonCatch`

### Phase 6: Critical Testing
- Test all user flows
- Verify guest mode
- Check session persistence

### Phase 7: Documentation & Cleanup
- Update developer docs
- Mark old files as deprecated
- Create migration guide

### Phase 8: Final Validation
- Complete regression testing
- Monitor for issues
- Ready for production

## Success Criteria

✅ All 37 files using unified auth hook
✅ No breaking changes in existing functionality
✅ Both auth patterns work seamlessly
✅ Guest mode remains functional
✅ Clean documentation for future developers
✅ All tests passing
✅ No console errors or warnings

## Risk Mitigation

### Rollback Plan
- Keep old hooks intact initially
- Can revert imports if issues arise
- Maintain backwards compatibility

### Testing Strategy
- Start with non-critical pages
- Extensive logging during migration
- Monitor user sessions

### Gradual Rollout
- Test in development first
- Deploy to staging environment
- Monitor metrics before production

## Timeline
- **Phase 1-3**: Foundation (Day 1)
- **Phase 4-5**: Migration (Day 1-2)
- **Phase 6-7**: Testing & Documentation (Day 2)
- **Phase 8**: Final Validation (Day 2-3)

Total estimated time: 2-3 days

## Notes
- The old pattern IS currently working because AuthProvider wraps the app
- The main issue is inconsistency and confusion from dual patterns
- Migration will simplify maintenance and onboarding