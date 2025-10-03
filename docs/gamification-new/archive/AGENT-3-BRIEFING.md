# 📋 Agent 3 (UI Integration) - Mission Briefing

**Agent**: Agent 3 - Frontend Integration Specialist
**Phase**: Phase 3 (UI Integration)
**Status**: ⏸️ BLOCKED - Waiting for Agent 1 (Core)
**Duration**: 3-4 days
**Dependencies**: Agent 1 must complete core implementation first

---

## 🎯 Your Mission

Connect the gamification system to the user interface. Create a React hook and update 3 pages to display real gamification data instead of mock data.

**Critical**: The UI must work gracefully whether the feature flag is ON or OFF. No broken states, no errors.

---

## 📖 Required Reading (In Order)

### Step 1: Understand the UI Integration (45 minutes)
**Read**: `/docs/gamification-new/ARCHITECTURE-OVERVIEW.md`

**Focus on**:
- Section: "React Hook" (useGamification implementation)
- Section: "Data Flow Scenarios" (how UI gets data)
- Section: "Feature Flag Integration" (ON/OFF behavior)

**Key Takeaways**:
- Hook wraps Zustand store for convenience
- Feature flag OFF → return defaults (0, 1, [], false)
- Loading states required (async IndexedDB load)

---

### Step 2: Review Your Deliverables (15 minutes)
**Read**: `/docs/gamification-new/QA-MATRIX.md`

**Focus on**:
- Section: "Agent 3: UI Integration"
- All 5 deliverables (3.1 through 3.5)
- Acceptance criteria checkboxes

**Key Takeaways**:
- You must deliver: Hook + 3 page updates + tests
- Mock data imports must be removed
- Feature flag disabled must work

---

### Step 3: Get Implementation Details (60 minutes)
**Read**: `/docs/gamification-new/IMPLEMENTATION-ROADMAP.md`

**Focus on**:
- Section: "Phase 3: UI Integration (Agent 3)"
- Steps 3.1 through 3.5 (complete templates provided)

**Key Takeaways**:
- Exact hook interface
- Before/after examples for each page
- Loading and error handling patterns

---

### Step 4: Review Agent 1's Work (30 minutes)
**Read**: Agent 1's handoff document (when available)

**Focus on**:
- State interface from `src/state/userGamification.ts`
- Available actions (awardXP, incrementStreak, etc.)
- How to load from IndexedDB

**Key Takeaways**:
- State auto-saves to IndexedDB
- Call `loadFromIndexedDB()` once on mount
- Feature flag checked in state

---

### Step 5: Understand Collaboration (15 minutes)
**Read**: `/docs/gamification-new/AGENT-COORDINATION.md`

**Focus on**:
- Section: "Agent 3: UI Integration"
- Section: "Phase 2 → Phase 3 Handoff"
- Section: "Best Practices → For Agent 3 (UI)"

**Key Takeaways**:
- You consume Agent 1's state
- Agent 4 will test your UI
- Progressive enhancement required

---

## 📝 Your Deliverables

### Deliverable 3.1: Gamification Hook
**File**: `src/hooks/useGamification.ts`

**Requirements**:
```typescript
import { useEffect, useState } from 'react'
import { useGamificationStore } from '@/state/userGamification'

export interface GamificationData {
  totalXP: number
  currentLevel: number
  currentStreak: number
  bestStreak: number
  unlockedAchievements: string[]
  loading: boolean
  error: Error | null
  isEnabled: boolean
}

export function useGamification(): GamificationData {
  const store = useGamificationStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Check feature flag
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION === 'true'

  useEffect(() => {
    if (!isEnabled) {
      setLoading(false)
      return
    }

    // Load from IndexedDB on mount
    async function loadData() {
      try {
        await store.loadFromIndexedDB()
        setLoading(false)
      } catch (err) {
        console.error('[useGamification] Failed to load data:', err)
        setError(err as Error)
        setLoading(false)
      }
    }

    loadData()
  }, [isEnabled, store])

  // If feature flag is OFF, return safe defaults
  if (!isEnabled) {
    return {
      totalXP: 0,
      currentLevel: 1,
      currentStreak: 0,
      bestStreak: 0,
      unlockedAchievements: [],
      loading: false,
      error: null,
      isEnabled: false
    }
  }

  // Return real data from store
  return {
    totalXP: store.totalXP,
    currentLevel: store.currentLevel,
    currentStreak: store.currentStreak,
    bestStreak: store.bestStreak,
    unlockedAchievements: store.unlockedAchievements,
    loading,
    error,
    isEnabled: true
  }
}
```

**Requirements Checklist**:
- [ ] Returns totalXP, currentLevel, currentStreak, bestStreak
- [ ] Returns unlockedAchievements array
- [ ] Returns loading state (async IndexedDB)
- [ ] Returns error state
- [ ] Returns isEnabled (feature flag status)
- [ ] Defaults to zeros when flag OFF
- [ ] Loads from IndexedDB on mount
- [ ] No runtime errors when disabled
- [ ] TypeScript types exported

---

### Deliverable 3.2: Profile Page Update
**File**: `src/app/account/page.tsx`

**Changes Required**:

**BEFORE** (mock data):
```typescript
// Gamification removed - using static values
const currentStreak = 0
const bestStreak = 0
const completionPercentage = 0
```

**AFTER** (real data):
```typescript
import { useGamification } from '@/hooks/useGamification'

export default function AccountPage() {
  const { user } = useAuth()
  const {
    totalXP,
    currentLevel,
    currentStreak,
    bestStreak,
    loading,
    isEnabled
  } = useGamification()

  // ... existing code ...

  // Display gamification stats
  {isEnabled && (
    <div className="gamification-stats">
      {loading ? (
        <div>Loading stats...</div>
      ) : (
        <>
          <div>XP: {totalXP}</div>
          <div>Level: {currentLevel}</div>
          <div>Streak: {currentStreak} days</div>
          <div>Best Streak: {bestStreak} days</div>
        </>
      )}
    </div>
  )}
}
```

**Requirements Checklist**:
- [ ] Remove mock data imports/constants
- [ ] Add `useGamification()` hook
- [ ] Display totalXP
- [ ] Display currentLevel
- [ ] Display currentStreak
- [ ] Display bestStreak
- [ ] Handle loading state (show spinner or skeleton)
- [ ] Handle feature flag OFF (hide gamification section)
- [ ] No runtime errors when disabled

**UI/UX Requirements**:
- Show loading spinner while data loads
- If flag OFF, don't show gamification section at all
- Style consistently with existing design
- Mobile responsive

---

### Deliverable 3.3: Achievements Page Update
**File**: `src/app/achievements/page.tsx`

**Changes Required**:

**BEFORE** (mock data):
```typescript
import {
  MOCK_ACHIEVEMENTS,
  getMockAchievementStats,
  getMockAchievementsByCategory,
  getMockUnlockedAchievements
} from '@/mocks/achievements.mock'

const allAchievements = MOCK_ACHIEVEMENTS
const stats = getMockAchievementStats()
```

**AFTER** (real data):
```typescript
import { useGamification } from '@/hooks/useGamification'
import achievementsConfig from '@/config/gamification/achievements.json'

export default function AchievementsPage() {
  const { unlockedAchievements, loading, isEnabled } = useGamification()

  // Load achievements from config
  const allAchievements = achievementsConfig.achievements.map(achievement => ({
    ...achievement,
    unlocked: unlockedAchievements.includes(achievement.id)
  }))

  // Calculate stats
  const stats = {
    unlockedCount: unlockedAchievements.length,
    totalCount: allAchievements.length,
    totalPoints: allAchievements
      .filter(a => unlockedAchievements.includes(a.id))
      .reduce((sum, a) => sum + a.points, 0),
    completionPercentage: Math.round(
      (unlockedAchievements.length / allAchievements.length) * 100
    )
  }

  if (loading) {
    return <LoadingOverlay message="Loading achievements..." />
  }

  if (!isEnabled) {
    // Show mock data or message
    return (
      <div className="text-center p-8">
        <p>Gamification system is currently disabled.</p>
      </div>
    )
  }

  // Render achievements with locked/unlocked states
  return (
    <div>
      {/* Stats summary */}
      <div className="stats">
        <p>{stats.unlockedCount}/{stats.totalCount} unlocked</p>
        <p>{stats.totalPoints} points</p>
        <p>{stats.completionPercentage}% complete</p>
      </div>

      {/* Achievements grid */}
      <div className="grid">
        {allAchievements.map(achievement => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            unlocked={achievement.unlocked}
          />
        ))}
      </div>
    </div>
  )
}
```

**Requirements Checklist**:
- [ ] Remove mock achievement imports
- [ ] Load achievements from `achievements.json`
- [ ] Use real `unlockedAchievements` from hook
- [ ] Show locked/unlocked states correctly
- [ ] Display achievement progress (if multi-step)
- [ ] Handle loading state
- [ ] Handle feature flag OFF (show message or mock data)
- [ ] No network calls (config is static)

**UI/UX Requirements**:
- Locked achievements: grayscale, semi-transparent
- Unlocked achievements: full color, checkmark icon
- Show progress bars for multi-step achievements (future)
- Filter by category (existing functionality)
- Responsive grid layout

---

### Deliverable 3.4: Leaderboard Page Update
**File**: `src/app/leaderboard/page.tsx`

**Changes Required**:

**CURRENT STATE**: Already uses mock data (correct approach)

**WHAT TO DO**: Verify and add info banner

```typescript
import { useGamification } from '@/hooks/useGamification'
import {
  MOCK_LEADERBOARD,
  MOCK_CURRENT_USER_STATS
} from '@/mocks/leaderboard.mock'

export default function LeaderboardPage() {
  const { totalXP, currentLevel, currentStreak } = useGamification()

  // KEEP USING MOCK DATA (no server-side leaderboard yet)
  const leaderboardData = MOCK_LEADERBOARD

  // Optional: Update current user stats with real data
  const userStats = {
    rank: 15, // Mock rank
    score: totalXP, // Real XP (if flag ON)
    streak: currentStreak, // Real streak
    level: currentLevel // Real level
  }

  return (
    <div>
      {/* Info Banner */}
      <div className="info-banner bg-blue-50 p-4 rounded mb-4">
        <p className="text-sm text-gray-700">
          ℹ️ This leaderboard displays mock data for demonstration purposes.
          Real competitive leaderboards coming soon!
        </p>
      </div>

      {/* Keep existing leaderboard rendering */}
      {/* ... */}
    </div>
  )
}
```

**Requirements Checklist**:
- [ ] Keep mock leaderboard data (no real rankings)
- [ ] Add prominent "Mock data only" banner
- [ ] Optionally show user's real XP/streak in "Your Stats" card
- [ ] No network calls for leaderboard data
- [ ] Page works with flag ON or OFF

**UI/UX Requirements**:
- Clear indication this is mock data
- No confusion about real vs fake rankings
- User's own stats can be real (if flag ON)
- Leaderboard stays static (no real competition)

---

### Deliverable 3.5: Component Tests
**File**: `src/hooks/__tests__/useGamification.test.tsx`

**Test Cases**:
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useGamification } from '../useGamification'
import { useGamificationStore } from '@/state/userGamification'

describe('useGamification', () => {
  beforeEach(() => {
    // Reset store
    useGamificationStore.getState().reset()
  })

  describe('Feature Flag ON', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    })

    it('should return initial loading state', () => {
      const { result } = renderHook(() => useGamification())
      expect(result.current.loading).toBe(true)
      expect(result.current.isEnabled).toBe(true)
    })

    it('should load data from IndexedDB', async () => {
      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('should return real gamification data', async () => {
      // Set up store with test data
      const store = useGamificationStore.getState()
      store.awardXP(500)
      store.incrementStreak()

      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.totalXP).toBe(500)
        expect(result.current.currentLevel).toBe(1) // floor(500/1000)
        expect(result.current.currentStreak).toBe(1)
      })
    })
  })

  describe('Feature Flag OFF', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'
    })

    it('should return defaults when flag is OFF', () => {
      const { result } = renderHook(() => useGamification())

      expect(result.current.totalXP).toBe(0)
      expect(result.current.currentLevel).toBe(1)
      expect(result.current.currentStreak).toBe(0)
      expect(result.current.bestStreak).toBe(0)
      expect(result.current.unlockedAchievements).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.isEnabled).toBe(false)
    })

    it('should not load from IndexedDB', () => {
      const { result } = renderHook(() => useGamification())

      expect(result.current.loading).toBe(false)
      // Should immediately return defaults
    })
  })

  describe('Error Handling', () => {
    it('should handle IndexedDB load errors', async () => {
      // Mock IndexedDB error
      const store = useGamificationStore.getState()
      jest.spyOn(store, 'loadFromIndexedDB').mockRejectedValue(
        new Error('IndexedDB unavailable')
      )

      const { result } = renderHook(() => useGamification())

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
        expect(result.current.loading).toBe(false)
      })
    })
  })
})
```

**Additional Test Files**:

**Profile Page Tests**:
```typescript
// src/app/account/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react'
import AccountPage from '../page'

describe('AccountPage', () => {
  it('should display gamification stats when enabled', () => {
    process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'true'
    render(<AccountPage />)

    expect(screen.getByText(/XP:/)).toBeInTheDocument()
    expect(screen.getByText(/Level:/)).toBeInTheDocument()
    expect(screen.getByText(/Streak:/)).toBeInTheDocument()
  })

  it('should hide gamification stats when disabled', () => {
    process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION = 'false'
    render(<AccountPage />)

    expect(screen.queryByText(/XP:/)).not.toBeInTheDocument()
  })
})
```

**Achievements Page Tests**:
```typescript
// src/app/achievements/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react'
import AchievementsPage from '../page'

describe('AchievementsPage', () => {
  it('should load achievements from config', () => {
    render(<AchievementsPage />)

    // Should show all 10 achievements
    expect(screen.getAllByRole('article')).toHaveLength(10)
  })

  it('should show locked/unlocked states', () => {
    render(<AchievementsPage />)

    // Check for locked achievement indicators
    expect(screen.getByText(/0\/10 unlocked/)).toBeInTheDocument()
  })
})
```

**Requirements Checklist**:
- [ ] Hook tests cover flag ON/OFF
- [ ] Hook tests cover loading/error states
- [ ] Profile page tests verify stats display
- [ ] Achievements page tests verify config loading
- [ ] All tests pass
- [ ] No runtime errors with flag OFF

---

## 🚀 Step-by-Step Execution

### Day 1: Create Hook (2-3 hours)
1. Create `src/hooks/useGamification.ts`
2. Copy template from Deliverable 3.1
3. Import and use Agent 1's state store
4. Test with flag ON
5. Test with flag OFF
6. Handle loading states
7. Handle errors

---

### Day 2: Update Profile & Achievements (4-5 hours)

**Profile Page (2 hours)**:
1. Open `src/app/account/page.tsx`
2. Import `useGamification` hook
3. Remove mock data constants
4. Add gamification stats display
5. Add loading state
6. Add feature flag check
7. Test in browser (flag ON and OFF)

**Achievements Page (2-3 hours)**:
1. Open `src/app/achievements/page.tsx`
2. Import `useGamification` hook
3. Remove mock achievement imports
4. Load achievements from config
5. Map unlocked status from hook
6. Update stats calculation
7. Test locked/unlocked states
8. Test in browser

---

### Day 3: Leaderboard & Testing (3-4 hours)

**Leaderboard (1 hour)**:
1. Open `src/app/leaderboard/page.tsx`
2. Add info banner about mock data
3. Optionally integrate user's real stats
4. Verify it still works
5. Test in browser

**Component Tests (2-3 hours)**:
1. Create `src/hooks/__tests__/useGamification.test.tsx`
2. Write tests for flag ON/OFF
3. Write tests for loading/error
4. Create profile page tests
5. Create achievements page tests
6. Run tests: `npm test`
7. Fix any failures
8. Ensure 100% pass rate

---

### Day 4: Polish & Handoff (2-3 hours)

1. **Visual Polish**:
   - Style gamification sections consistently
   - Add icons (🔥 for streak, ⭐ for XP, etc.)
   - Ensure mobile responsiveness
   - Test dark mode compatibility

2. **Error Handling**:
   - Graceful degradation on errors
   - User-friendly error messages
   - No console errors in production

3. **Documentation**:
   - Add comments to hook
   - Document any UI design decisions
   - Note any limitations

4. **Self-Review**:
   - Check all requirements checkboxes
   - Test all pages thoroughly
   - Verify flag toggle works
   - Run full test suite

5. **Create Handoff Document** for Agent 4

---

## ❓ Common Questions

**Q: What if Agent 1's state interface changes?**
**A**: Update your hook to match. Ask Agent 1 to notify you of changes.

**Q: Should I create new UI components?**
**A**: Only if necessary. Prefer updating existing components.

**Q: What if IndexedDB load is slow?**
**A**: Show loading spinner. User experience > speed (for now).

**Q: Can I add animations for XP gains?**
**A**: Nice to have, but not required. Focus on functionality first.

**Q: What about i18n for gamification text?**
**A**: Use existing i18n system. Add keys for "XP", "Level", "Streak", etc.

**Q: Should achievements have progress bars?**
**A**: Not required for Phase 3. Can be added in future iteration.

---

## 🎯 Success Criteria

You're done when:
- [ ] `useGamification()` hook created and working
- [ ] Profile page shows real XP/level/streak
- [ ] Achievements page shows real unlock status
- [ ] Leaderboard has clear "mock data" banner
- [ ] All component tests pass
- [ ] Feature flag OFF shows defaults (no errors)
- [ ] Loading states handled gracefully
- [ ] Mobile responsive
- [ ] Dark mode compatible
- [ ] Handoff document created for Agent 4

---

## 📤 Handoff to Agent 4 (QA)

### When You're Done
1. All components working in browser
2. All tests passing
3. Update QA-MATRIX.md with your sign-off
4. Create handoff document

### Handoff Document Template
**File**: `/docs/gamification-new/AGENT-4-BRIEFING.md` (you'll write this)

```markdown
# Agent 4 Handoff: UI Complete

## Status
Agent 3 (UI) has completed all deliverables.

## What I Delivered
1. useGamification hook (`src/hooks/useGamification.ts`)
2. Updated Profile page (`src/app/account/page.tsx`)
3. Updated Achievements page (`src/app/achievements/page.tsx`)
4. Updated Leaderboard page (`src/app/leaderboard/page.tsx`)
5. Component tests (all passing)

## How to Test

### Manual Testing
1. Enable feature flag: `NEXT_PUBLIC_ENABLE_GAMIFICATION=true`
2. Visit `/account` → Should show XP, level, streak
3. Visit `/achievements` → Should show 10 achievements
4. Visit `/leaderboard` → Should show mock data banner

### Feature Flag OFF
1. Set `NEXT_PUBLIC_ENABLE_GAMIFICATION=false`
2. Visit pages → Should work without errors
3. Profile: No gamification section
4. Achievements: Show message or mock data

## Known Limitations
- Leaderboard is mock data only (by design)
- No animations for XP gains (future feature)
- Achievement progress bars not implemented (future)

## Questions?
Ask me or Supervisor.

Signed: Agent 3
Date: [Today's date]
```

---

## 🎨 UI/UX Best Practices

### Loading States
```typescript
if (loading) {
  return (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin">Loading...</div>
    </div>
  )
}
```

### Error States
```typescript
if (error) {
  return (
    <div className="bg-red-50 p-4 rounded">
      <p className="text-red-700">
        Failed to load gamification data. Please refresh.
      </p>
    </div>
  )
}
```

### Feature Flag OFF
```typescript
if (!isEnabled) {
  return null // Don't render gamification section
}
```

### Mobile Responsive
```css
/* Use Tailwind responsive classes */
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
```

---

## 🎓 Best Practices for Agent 3

1. **Progressive Enhancement**
   - App works without gamification
   - No broken UI when flag OFF
   - Graceful loading states

2. **User Experience**
   - Show loading indicators
   - Display errors gracefully
   - No jarring layout shifts

3. **Accessibility**
   - ARIA labels for gamification elements
   - Keyboard navigation
   - Screen reader friendly

4. **Performance**
   - Lazy load if possible
   - Memoize expensive calculations
   - Avoid unnecessary re-renders

5. **Testing**
   - Test both flag states
   - Test loading/error scenarios
   - Test on mobile devices

---

## 📞 Need Help?

**Supervisor (Agent 5)**: UI/UX questions, design decisions
**Agent 1 (Core)**: State interface questions, data availability
**Agent 4 (QA)**: Can start asking integration questions

---

## 🎉 Your Impact

The UI is where users **experience** the gamification system. Your work makes achievements, XP, and streaks **visible** and **engaging**.

**Estimated Time**: 3-4 days
**Your Focus**: User experience, graceful degradation, testing

Good luck! 🚀

**Signed**: Agent 5 (Supervisor)
**Date**: 2025-10-02
