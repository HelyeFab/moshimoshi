# Entertainment System

**Status:** ACTIVE
**Last Updated:** 2026-02-01

## Overview

The Entertainment System is a comprehensive gamification and engagement platform that transforms Japanese learning into an interactive, rewarding experience. It consists of four integrated subsystems working together to motivate learners and track their progress.

### Core Components

1. **Games System** - 8 interactive learning games across beginner, intermediate, and advanced levels
2. **Review Hub** - Centralized dashboard for SRS review tracking and analytics
3. **Achievements** - Progress-based reward system with 12+ achievements
4. **Leaderboard** - Competitive ranking system with privacy controls

### Key Features

- **Feature Flag Control** - All components can be enabled/disabled independently
- **Learning Village Integration** - Entertainment District with 4 gamification stalls
- **Command Palette** - Quick access via keyboard shortcuts
- **Offline Support** - IndexedDB caching with Firebase sync
- **Universal Review Engine Integration** - Event-driven progress tracking
- **XP & Leveling System** - Consistent reward calculation across all activities
- **Streak Management** - Daily activity tracking with 24-hour grace period

---

## Quick Start

### Prerequisites

```bash
# Required environment variables in .env.local
NEXT_PUBLIC_FEATURE_GAMES=true
NEXT_PUBLIC_FEATURE_REVIEW_HUB=true
NEXT_PUBLIC_FEATURE_ACHIEVEMENTS=true
NEXT_PUBLIC_FEATURE_LEADERBOARD=true
NEXT_PUBLIC_ENABLE_GAMIFICATION=true

# Required services
- Firebase Firestore (gamification data)
- Redis (leaderboard caching)
- IndexedDB (offline storage)
```

### Enable the Entertainment System

1. **Set Feature Flags**
   ```bash
   # Edit .env.local
   NEXT_PUBLIC_FEATURE_GAMES=true
   NEXT_PUBLIC_FEATURE_REVIEW_HUB=true
   NEXT_PUBLIC_FEATURE_ACHIEVEMENTS=true
   NEXT_PUBLIC_FEATURE_LEADERBOARD=true
   ```

2. **Restart Dev Server**
   ```bash
   npm run dev
   ```

3. **Verify in Learning Village**
   - Navigate to `/dashboard`
   - Look for "Entertainment District" (🎮)
   - Should contain 4 stalls: Games, Review Hub, Achievements, Leaderboard

### Access Entertainment Features

| Feature | Route | Shortcut | Location |
|---------|-------|----------|----------|
| Games | `/games` | `g g` | Entertainment District |
| Review Hub | `/review-dashboard` | `g r` | Entertainment District |
| Achievements | `/achievements` | `g a` | Entertainment District |
| Leaderboard | `/leaderboard` | `g l` | Entertainment District |

---

## Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Entertainment System                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Games   │  │  Review  │  │Achievements│  │Leaderboard│  │
│  │  System  │  │   Hub    │  │            │  │          │   │
│  └────┬─────┘  └────┬─────┘  └────┬──────┘  └────┬─────┘   │
│       │             │              │              │          │
│       └─────────────┴──────────────┴──────────────┘          │
│                         │                                    │
│              ┌──────────▼──────────┐                        │
│              │ Gamification Core   │                        │
│              ├─────────────────────┤                        │
│              │ • XP Calculator     │                        │
│              │ • Streak Manager    │                        │
│              │ • Achievement Engine│                        │
│              │ • Coordinator       │                        │
│              └──────────┬──────────┘                        │
│                         │                                    │
│       ┌─────────────────┼─────────────────┐                │
│       │                 │                 │                 │
│  ┌────▼────┐      ┌────▼────┐      ┌────▼────┐           │
│  │Firebase │      │  Redis  │      │IndexedDB│            │
│  │Firestore│      │  Cache  │      │ Offline │            │
│  └─────────┘      └─────────┘      └─────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action (Game/Review)
         │
         ▼
    Event Emitted
         │
         ▼
  Gamification Listener ──► XP Calculation
         │                  Streak Update
         ▼                  Achievement Check
    Coordinator
         │
         ├──► Firestore (Write)
         ├──► Redis (Cache Update)
         └──► IndexedDB (Offline Sync)
              │
              ▼
         Zustand Store
              │
              ▼
         UI Updates
```

---

## Documentation

### Core Documentation

| Document | Description |
|----------|-------------|
| [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) | Complete implementation guide with code examples |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and debugging solutions |

### Related Documentation

| Document | Description |
|----------|-------------|
| [/docs/REVIEW_ENGINE_DEEP_DIVE.md](/docs/REVIEW_ENGINE_DEEP_DIVE.md) | Universal Review Engine integration |
| [/02-PRODUCTION_DOCS/entitlements/FEATURE_GUIDE.md](../entitlements/FEATURE_GUIDE.md) | Entitlements and gating patterns |

---

## Key Files

### Games System

| File | Line | Description |
|------|------|-------------|
| `src/app/[locale]/games/page.tsx` | 18 | Main games directory with feature flag check |
| `src/app/[locale]/games/kanji-simon/` | - | Kanji Simon memory game |
| `src/app/[locale]/games/kana-drop/` | - | Falling kana arcade game |
| `src/components/games/kanji-quest/KanjiQuest.tsx` | 1 | Pokemon battle system |
| `src/components/games/MatchingGame/` | - | Memory card matching |

### Gamification Core

| File | Line | Description |
|------|------|-------------|
| `src/lib/gamification/services/gamification-coordinator.ts` | 1 | Server-side single entry point |
| `src/lib/gamification/services/streakService.ts` | 1 | Streak management logic |
| `src/lib/gamification/listeners/gamificationListener.ts` | 1 | URE event integration |
| `src/state/userGamification.ts` | 1 | Zustand store for client state |

### Achievements

| File | Line | Description |
|------|------|-------------|
| `src/app/[locale]/achievements/page.tsx` | 1 | Achievements dashboard |
| `src/config/gamification/achievements.json` | 1 | Achievement definitions |
| `src/hooks/useGamification.ts` | 1 | React hook for gamification state |

### Leaderboard

| File | Line | Description |
|------|------|-------------|
| `src/app/[locale]/leaderboard/page.tsx` | 1 | Leaderboard UI |
| `src/app/api/leaderboard/route.ts` | 1 | Paginated leaderboard API |
| `src/lib/leaderboard/types.ts` | 1 | Type definitions |
| `src/lib/redis/caches/leaderboard-cache.ts` | 1 | Redis caching layer |

### Review Hub

| File | Line | Description |
|------|------|-------------|
| `src/app/[locale]/review-dashboard/page.tsx` | 1 | Review Hub main page |
| `src/components/review/dashboard/StatsOverview.tsx` | 1 | Stats summary component |
| `src/components/review/charts/ProgressHeatmap.tsx` | 1 | 365-day activity visualization |
| `src/hooks/useReviewData.ts` | 1 | Review data fetching hook |

### Configuration

| File | Line | Description |
|------|------|-------------|
| `src/lib/features/featureFlags.ts` | 35 | Feature flag system |
| `src/config/gamification/xp.json` | 1 | XP reward configuration |
| `src/config/gamification/levels.json` | 1 | Level thresholds |
| `src/config/gamification/streakConfig.ts` | 1 | Streak behavior config |

---

## Integration Points

### Learning Village

**Configuration:** `src/components/dashboard/LearningVillage.tsx`

```typescript
// Line 1455 - Entertainment District
play: ['games', 'review-hub', 'achievements', 'leaderboard'] as StallId[]
```

**Feature Flag Filtering:** Line 1351
```typescript
if (stallId in featureFlags && !featureFlags[stallId]) {
  return false // Hide stall if feature disabled
}
```

### Command Palette

**Configuration:** `src/components/ui/CommandPalette.tsx`

```typescript
// Line 577 - Feature flag checks
const isGamesEnabled = process.env.NEXT_PUBLIC_FEATURE_GAMES === 'true'
const isAchievementsEnabled = process.env.NEXT_PUBLIC_FEATURE_ACHIEVEMENTS === 'true'

// Line 585 - Filter commands
enabledCommands.filter(command => {
  if (command.id === 'games' && !isGamesEnabled) return false
  if (command.id === 'achievements' && !isAchievementsEnabled) return false
  return true
})
```

### Universal Review Engine

**Event Listener:** `src/lib/gamification/listeners/gamificationListener.ts`

```typescript
// Listens for URE events
eventBus.on('SESSION_COMPLETED', async (event) => {
  const result = await coordinator.processReviewCompletion(event.data)
  // XP awarded, streaks updated, achievements checked
})
```

---

## Database Schema

### Firestore Collections

**users/{userId}/gamification**
```typescript
{
  xp: {
    total: number,          // Total XP earned
    level: number           // Current level (1-50)
  },
  streak: {
    current: number,        // Days of current streak
    best: number,           // Best streak ever
    lastActivityDate: string // ISO date string
  },
  achievements: {
    unlocked: string[],     // Achievement IDs
    progress: {             // Progress toward achievements
      [achievementId]: number
    }
  },
  sessions: {
    count: number,          // Total review sessions
    lastSessionAt: Timestamp
  },
  version: number           // For conflict resolution
}
```

**leaderboard_snapshots/allTime-latest**
```typescript
{
  timeframe: 'allTime',
  timestamp: number,
  entries: [
    {
      rank: number,
      userId: string,
      displayName: string,
      totalXP: number,
      currentLevel: number,
      currentStreak: number,
      bestStreak: number,
      achievementCount: number,
      subscription: 'free' | 'premium_monthly' | 'premium_yearly'
    }
  ],
  totalPlayers: number,
  lastUpdated: number
}
```

**users/{userId}/completion_ledger/{activityKey}**
```typescript
{
  activityType: 'review' | 'drill' | 'flashcard',
  activityId: string,
  completedAt: Timestamp,
  xpAwarded: number
}
```

### IndexedDB Stores

**Store:** `gamification-{userId}`
- Purpose: Offline cache of gamification state
- Syncs with Firestore on connection
- Hydrated on app load

---

## Performance Considerations

### Caching Strategy

- **Redis Cache:** 5-minute TTL for leaderboard data
- **IndexedDB:** Offline cache for gamification state
- **Response Headers:** `s-maxage=300, stale-while-revalidate=600`

### Optimization Techniques

1. **Code Splitting** - Dynamic imports for game components
2. **Optimistic Updates** - Instant UI feedback with background sync
3. **Event Batching** - Multiple XP awards in single transaction
4. **Lazy Loading** - Games load only when accessed
5. **Memoization** - Heavy calculations cached with `useMemo`

---

## Security Considerations

### API Route Protection

All gamification APIs use server-side authentication:

```typescript
import { getSession } from '@/lib/auth/session'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }
  // Process request
}
```

### Data Validation

- XP amounts capped per session
- Streak validation on client display
- Firestore security rules enforce user data isolation
- Completion ledger prevents duplicate XP awards

---

## Testing

### Test Coverage

- Gamification Core: 85%+
- Review Engine Integration: 90%+
- Individual Games: 70%+

### Test Files

```
src/lib/gamification/__tests__/
├── gamificationListener.test.ts
└── services/
    ├── gamification-coordinator.test.ts
    └── streakService.test.ts
```

### Running Tests

```bash
# Run all gamification tests
npm test -- --testPathPattern=gamification

# Run specific test suite
npm test -- gamificationListener.test.ts
```

---

## Common Tasks

### Add a New Game

1. Create game folder in `src/app/[locale]/games/`
2. Implement game component with state management
3. Add game card to `src/app/[locale]/games/page.tsx`
4. Add i18n strings to `src/i18n/locales/*/strings.ts`
5. Test with feature flag enabled

### Add a New Achievement

1. Edit `src/config/gamification/achievements.json`
2. Define achievement with condition
3. Achievement engine auto-checks on relevant events
4. Add i18n strings for name/description

### Customize XP Rewards

1. Edit `src/config/gamification/xp.json`
2. Modify reward amounts for activities
3. Restart dev server for changes to take effect

---

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed debugging guides.

**Quick Checks:**

1. **Entertainment District not showing?**
   - Verify feature flags in `.env.local`
   - Restart dev server
   - Clear localStorage: `localStorage.removeItem('moshimoshi_learning_village_config')`

2. **XP not awarded?**
   - Check browser console for errors
   - Verify Firebase connection
   - Check completion ledger for duplicates

3. **Leaderboard empty?**
   - Run: `POST /api/admin/leaderboard/trigger`
   - Check Redis connection
   - Verify Firestore snapshots exist

---

## Future Enhancements

### Planned Features

- [ ] Weekly/Monthly leaderboard timeframes
- [ ] Achievement notification system
- [ ] Custom game difficulty settings
- [ ] Social sharing of achievements
- [ ] Team/group leaderboards
- [ ] Achievement badges in profile
- [ ] XP boosters and power-ups

### Under Consideration

- [ ] PvP game modes
- [ ] Seasonal events with special rewards
- [ ] Achievement trading system
- [ ] Custom achievement creation (premium)

---

## Support

### Getting Help

- **Documentation Issues:** Create issue in GitHub
- **Bug Reports:** Use `/contact` form or Discord
- **Feature Requests:** Community feedback forum

### Maintainers

- Primary: Development Team
- Code Review: Senior Engineers
- QA: Testing Team

---

## Changelog

### 2026-02-01
- Initial Entertainment System documentation created
- Moved Achievements and Leaderboard to Entertainment District
- Moved Task Manager to Study Center
- Games feature enabled

### 2026-01-28
- Low Power Mode integration for Learning Village
- Performance optimizations

### 2026-01-15
- Achievement system beta launch
- Leaderboard privacy controls added

---

*For detailed implementation guidance, see [FEATURE_GUIDE.md](./FEATURE_GUIDE.md)*
