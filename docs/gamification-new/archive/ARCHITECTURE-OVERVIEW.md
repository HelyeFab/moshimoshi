# 🏗️ Gamification System Architecture Overview

**Project**: Moshimoshi Gamification Re-Implementation
**Version**: 2.0 (Post-Degamification)
**Architecture Pattern**: Event-Driven, Config-First, Feature-Flagged
**Last Updated**: 2025-10-02

---

## 🎯 Design Principles

### 1. **Event-Driven Decoupling**
- Universal Review Engine (URE) emits events
- Gamification system **listens** to events
- **Zero modifications** to URE codebase
- Clean separation of concerns

### 2. **Config-Driven Rules**
- All XP/streak/achievement logic in JSON configs
- No hardcoded values in code
- Easy to modify without code changes
- Version-controlled configuration

### 3. **Feature Flag Gated**
- Single flag: `ENABLE_GAMIFICATION`
- System-wide on/off switch
- No runtime errors when disabled
- Graceful degradation to mock data

### 4. **Offline-First with Optional Sync**
- IndexedDB for all users (free tier)
- Firebase sync for premium users only
- No network dependency for core functionality
- Resilient to connectivity issues

### 5. **Mock-First UI**
- UI renders mock data by default
- Real data integration optional
- No API dependency for display
- Leaderboard always uses mocks (no server-side ranking)

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Universal Review Engine                      │
│                         (UNCHANGED)                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Events: SESSION_COMPLETED,
                      │         ITEM_ANSWERED,
                      │         PROGRESS_UPDATED
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Gamification Listener                           │
│              (src/lib/gamification/                              │
│               gamificationListener.ts)                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ 1. Check ENABLE_GAMIFICATION flag                     │      │
│  │ 2. Load configs (xp.json, streak.json, etc.)         │      │
│  │ 3. Calculate XP from session statistics              │      │
│  │ 4. Apply bonuses (accuracy, speed, streak)           │      │
│  │ 5. Check streak eligibility (≥10 XP/day)             │      │
│  │ 6. Evaluate achievement conditions                    │      │
│  │ 7. Emit gamification events                           │      │
│  └──────────────────────────────────────────────────────┘      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Events: XP_AWARDED,
                 │         STREAK_UPDATED,
                 │         ACHIEVEMENT_UNLOCKED
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gamification State                            │
│                (src/state/userGamification.ts)                   │
│                      [Zustand Store]                             │
│                                                                  │
│  State:                                                          │
│  ├─ totalXP: number                                             │
│  ├─ currentLevel: number (calculated)                           │
│  ├─ currentStreak: number                                       │
│  ├─ bestStreak: number                                          │
│  ├─ lastActivityDate: Date                                      │
│  └─ unlockedAchievements: string[]                              │
│                                                                  │
│  Actions:                                                        │
│  ├─ awardXP(amount)                                             │
│  ├─ incrementStreak()                                           │
│  ├─ resetStreak()                                               │
│  ├─ unlockAchievement(id)                                       │
│  ├─ syncToFirebase() [Premium only]                            │
│  └─ loadFromIndexedDB()                                         │
└───────────┬────────────────────────┬────────────────────────────┘
            │                        │
            │                        │
  ┌─────────▼────────┐    ┌─────────▼────────────────────┐
  │   IndexedDB      │    │    Firebase Firestore        │
  │   (All Users)    │    │    (Premium Users Only)      │
  │                  │    │                              │
  │ DB: "moshimoshi_ │    │ Collection:                  │
  │     gamification"│    │ users/{uid}/gamification     │
  │                  │    │                              │
  │ Store:           │    │ Document:                    │
  │ "userGamification"│   │ {                            │
  │                  │    │   totalXP,                   │
  │ Key: userId      │    │   currentStreak,             │
  │ Value: {state}   │    │   bestStreak,                │
  │                  │    │   achievements,              │
  │                  │    │   lastSync                   │
  │                  │    │ }                            │
  └──────────────────┘    └──────────────────────────────┘
            │                        │
            │                        │
            └────────────┬───────────┘
                         │
                         │ Read via
                         ▼
         ┌──────────────────────────────────┐
         │      useGamification() Hook      │
         │  (src/hooks/useGamification.ts)  │
         │                                  │
         │  Returns:                        │
         │  ├─ totalXP                      │
         │  ├─ currentLevel                 │
         │  ├─ currentStreak                │
         │  ├─ bestStreak                   │
         │  ├─ unlockedAchievements         │
         │  ├─ loading                      │
         │  └─ error                        │
         └──────────────┬───────────────────┘
                        │
                        │ Consumed by
                        ▼
         ┌──────────────────────────────────┐
         │        UI Components             │
         │                                  │
         │  ├─ Profile Page (Account)       │
         │  ├─ Achievements Page            │
         │  ├─ Dashboard                    │
         │  └─ Leaderboard (mock only)      │
         └──────────────────────────────────┘
```

---

## 🔧 Component Breakdown

### 1. **Gamification Listener** (`src/lib/gamification/gamificationListener.ts`)

**Responsibilities**:
- Subscribe to URE events
- Calculate XP based on session performance
- Apply config-driven bonuses
- Check streak eligibility
- Evaluate achievement unlock conditions
- Emit gamification-specific events

**Key Methods**:
```typescript
class GamificationListener {
  // Initialize listener with feature flag check
  initialize(userId: string, reviewEngineEmitter: EventEmitter): void

  // Handle session completion event
  private handleSessionCompleted(payload: SessionCompletedPayload): void

  // Handle item answered event
  private handleItemAnswered(payload: ItemAnsweredPayload): void

  // Calculate XP with bonuses
  private calculateXP(statistics: SessionStatistics): XPResult

  // Check if streak should increment
  private checkStreakEligibility(xpEarned: number, date: Date): boolean

  // Evaluate achievement conditions
  private checkAchievements(statistics: SessionStatistics): string[]

  // Cleanup
  destroy(): void
}
```

**Event Flow**:
```
URE: SESSION_COMPLETED
  ↓
Listener: handleSessionCompleted()
  ↓
Listener: calculateXP()
  ↓
Listener: checkStreakEligibility()
  ↓
Listener: checkAchievements()
  ↓
Emit: XP_AWARDED, STREAK_UPDATED, ACHIEVEMENT_UNLOCKED
```

---

### 2. **Gamification State** (`src/state/userGamification.ts`)

**Responsibilities**:
- Centralized state management (Zustand)
- Auto-save to IndexedDB on state changes
- Optional Firebase sync (premium users)
- Feature flag enforcement

**State Schema**:
```typescript
interface GamificationState {
  // Core Stats
  totalXP: number
  currentLevel: number // Calculated: floor(totalXP / 1000)
  currentStreak: number
  bestStreak: number
  lastActivityDate: Date | null

  // Achievements
  unlockedAchievements: string[] // Achievement IDs
  achievementProgress: Record<string, number> // For multi-step achievements

  // Metadata
  lastSyncedAt: Date | null
  isDirty: boolean // Has unsaved changes

  // Actions
  awardXP: (amount: number) => void
  incrementStreak: () => void
  resetStreak: () => void
  unlockAchievement: (id: string) => void
  syncToFirebase: () => Promise<void>
  loadFromIndexedDB: () => Promise<void>
  reset: () => void
}
```

**Middleware**:
1. **Feature Flag Middleware**: Blocks all actions if `ENABLE_GAMIFICATION` is false
2. **Auto-Save Middleware**: Saves to IndexedDB on every state change
3. **Sync Middleware**: Queues Firebase sync for premium users (debounced 5s)

---

### 3. **IndexedDB Store** (`src/lib/gamification/indexedDBStore.ts`)

**Responsibilities**:
- Local persistence for all users
- Fast read/write operations
- Quota management
- Migration support

**Schema**:
```
Database: "moshimoshi_gamification" (version 1)
  Object Store: "userGamification"
    Key: userId (string)
    Value: {
      totalXP: number,
      currentStreak: number,
      bestStreak: number,
      lastActivityDate: string (ISO 8601),
      unlockedAchievements: string[],
      achievementProgress: object,
      lastSyncedAt: string | null,
      version: number
    }
```

**Key Methods**:
```typescript
class IndexedDBStore {
  // Initialize DB connection
  async open(): Promise<IDBDatabase>

  // Save gamification data
  async save(userId: string, data: GamificationData): Promise<void>

  // Load gamification data
  async load(userId: string): Promise<GamificationData | null>

  // Clear user data
  async clear(userId: string): Promise<void>

  // Clear all data (for logout)
  async clearAll(): Promise<void>

  // Handle quota exceeded errors
  private handleQuotaExceeded(): void
}
```

---

### 4. **Configuration System** (`/config/gamification/`)

**Files**:

#### `xp.json` - XP Calculation Rules
```json
{
  "version": "1.0.0",
  "baseXP": 10,
  "bonuses": {
    "accuracy": [
      { "threshold": 100, "multiplier": 1.5 },
      { "threshold": 90, "multiplier": 1.3 },
      { "threshold": 80, "multiplier": 1.2 }
    ],
    "speed": {
      "thresholdMs": 3000,
      "bonus": 5
    },
    "streak": {
      "minStreak": 10,
      "bonusPerItem": 2
    }
  },
  "dailyXPCap": 500,
  "antiCheat": {
    "enabled": true,
    "maxPerSession": 200,
    "suspiciousThreshold": 1000
  }
}
```

#### `streak.json` - Streak Rules
```json
{
  "version": "1.0.0",
  "minXPForStreak": 10,
  "gracePeriodHours": 24,
  "resetTime": "00:00",
  "timezone": "UTC",
  "streakFreeze": {
    "enabled": true,
    "requiresPremium": true,
    "maxFreezes": 3
  }
}
```

#### `achievements.json` - Achievement Definitions
```json
{
  "version": "1.0.0",
  "achievements": [
    {
      "id": "first_session",
      "name": "First Session",
      "description": "Complete your first review session",
      "icon": "🎯",
      "category": "progress",
      "points": 10,
      "condition": {
        "type": "session_count",
        "operator": ">=",
        "value": 1
      }
    },
    {
      "id": "week_warrior",
      "name": "Week Warrior",
      "description": "Practice 7 days in a row",
      "icon": "🔥",
      "category": "streak",
      "points": 50,
      "condition": {
        "type": "streak",
        "operator": ">=",
        "value": 7
      }
    }
    // ... 8 more achievements
  ]
}
```

#### `levels.json` - Level System
```json
{
  "version": "1.0.0",
  "formula": "floor(totalXP / xpPerLevel)",
  "xpPerLevel": 1000,
  "maxLevel": 100,
  "levelRewards": [
    { "level": 5, "reward": "badge_novice" },
    { "level": 10, "reward": "badge_intermediate" },
    { "level": 25, "reward": "badge_advanced" },
    { "level": 50, "reward": "badge_master" },
    { "level": 100, "reward": "badge_legend" }
  ]
}
```

---

### 5. **React Hook** (`src/hooks/useGamification.ts`)

**Responsibilities**:
- Provide gamification data to components
- Handle loading/error states
- Feature flag enforcement at UI layer

**Implementation**:
```typescript
export function useGamification() {
  const featureFlag = useFeatureFlag('ENABLE_GAMIFICATION')
  const store = useGamificationStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!featureFlag) {
      setLoading(false)
      return
    }

    // Load from IndexedDB on mount
    store.loadFromIndexedDB()
      .then(() => setLoading(false))
      .catch((err) => setError(err))
  }, [featureFlag])

  if (!featureFlag) {
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

---

## 🔄 Data Flow Scenarios

### Scenario 1: User Completes Review Session

```
1. User completes review session
   ↓
2. URE emits SESSION_COMPLETED event
   {
     sessionId: "abc123",
     statistics: {
       totalItems: 20,
       correctItems: 18,
       accuracy: 90,
       averageResponseTime: 2800,
       bestStreak: 12
     },
     duration: 320000
   }
   ↓
3. Gamification Listener receives event
   ↓
4. Check ENABLE_GAMIFICATION flag
   ├─ If FALSE → Exit (no processing)
   └─ If TRUE → Continue
   ↓
5. Load xp.json config
   ↓
6. Calculate XP:
   Base XP: 18 correct × 10 = 180 XP
   Accuracy bonus (90%): 180 × 1.3 = 234 XP
   Speed bonus (<3s): +5 XP = 239 XP
   Streak bonus (12 items): 12 × 2 = 24 XP
   Total: 263 XP
   ↓
7. Update State:
   totalXP: 1500 → 1763
   currentLevel: 1 → 1 (floor(1763/1000) = 1)
   ↓
8. Check streak eligibility:
   263 XP ≥ 10 XP threshold → Increment streak
   currentStreak: 5 → 6
   ↓
9. Check achievements:
   Load achievements.json
   Evaluate conditions:
   ├─ "first_session" (session_count ≥ 1): Already unlocked
   ├─ "week_warrior" (streak ≥ 7): Not yet (6/7)
   └─ "centurion" (total_reviews ≥ 100): Check progress
   ↓
10. Save to IndexedDB (auto-save middleware)
    ↓
11. Queue Firebase sync (if premium, debounced 5s)
    ↓
12. Emit XP_AWARDED event for UI notification
    ↓
13. UI updates via useGamification() hook
```

---

### Scenario 2: Missed Day (Streak Reset)

```
1. New day starts (00:00 UTC)
   ↓
2. Background check: Last activity date < today
   ↓
3. Calculate days missed: today - lastActivityDate = 2 days
   ↓
4. Streak reset condition met (missed 1+ day)
   ↓
5. Update State:
   currentStreak: 15 → 0
   ↓
6. Save to IndexedDB
   ↓
7. Emit STREAK_RESET event
   ↓
8. UI shows streak reset notification (optional)
```

---

### Scenario 3: Achievement Unlock

```
1. User earns 1000th XP
   ↓
2. State updates: totalXP: 999 → 1000
   ↓
3. Achievement check triggered
   ↓
4. Load achievements.json
   ↓
5. Evaluate "level_10" achievement:
   Condition: currentLevel ≥ 10
   Actual: floor(1000/1000) = 1
   Result: NOT MET
   ↓
6. User continues practicing...
   ↓
7. Later: totalXP reaches 10,000
   ↓
8. currentLevel: floor(10000/1000) = 10
   ↓
9. "level_10" achievement condition MET
   ↓
10. Update State:
    unlockedAchievements: [...prev, "level_10"]
    ↓
11. Save to IndexedDB
    ↓
12. Emit ACHIEVEMENT_UNLOCKED event
    {
      achievementId: "level_10",
      name: "Level 10",
      description: "Reach level 10",
      icon: "⭐",
      points: 100
    }
    ↓
13. UI shows celebration modal/toast
```

---

## 🚩 Feature Flag Integration

### Flag Name: `ENABLE_GAMIFICATION`

**Location**:
- Environment: `process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION`
- Config: `config/features.v1.json`
- Runtime: `useFeatureFlag('ENABLE_GAMIFICATION')`

**Behavior**:

| Flag State | Gamification Behavior | UI Behavior |
|-----------|----------------------|-------------|
| `true` | Full system active | Shows real XP/streaks/achievements |
| `false` | All listeners disabled | Shows mock data or zeros |
| `undefined` | Defaults to `false` | Safe fallback to mock data |

**Implementation**:
```typescript
// In listener
if (!process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION) {
  return // Exit early, no processing
}

// In state
if (!featureFlag) {
  return // Block all state mutations
}

// In UI
const { isEnabled } = useGamification()
if (!isEnabled) {
  return <div>XP: 0, Level: 1</div> // Show defaults
}
```

---

## 💾 Data Persistence Strategy

### IndexedDB (All Users)
- **Purpose**: Primary storage for all users
- **Performance**: ~1ms read/write
- **Capacity**: 50MB+ typical quota
- **Reliability**: 100% offline capability
- **Sync**: One-way (write-only)

### Firebase Firestore (Premium Users Only)
- **Purpose**: Cross-device sync
- **Performance**: 200-500ms read/write
- **Capacity**: Unlimited (billed)
- **Reliability**: Requires network
- **Sync**: Bi-directional (read + write)

### Sync Strategy
```typescript
// On state change
1. Save to IndexedDB immediately (all users)
2. If premium: Queue Firebase sync (debounced 5s)
3. If offline: Queue sync for later (exponential backoff)

// On app launch
1. Load from IndexedDB first (instant)
2. If premium + online: Load from Firebase (compare timestamps)
3. If Firebase newer: Merge data (last-write-wins)
4. If IndexedDB newer: Push to Firebase
```

---

## 🧪 Testing Strategy

### Unit Tests
- XP calculation accuracy
- Streak increment/reset logic
- Achievement condition evaluation
- Level calculation
- Config parsing

### Integration Tests
- URE → Listener → State flow
- State → IndexedDB persistence
- State → Firebase sync (premium)
- Feature flag toggle behavior

### E2E Tests
- Complete session → XP awarded
- 7-day streak → Achievement unlock
- Missed day → Streak reset
- Toggle flag → UI updates

---

## 📈 Performance Targets

| Operation | Target | Measured |
|-----------|--------|----------|
| XP Calculation | <10ms | TBD |
| State Update | <5ms | TBD |
| IndexedDB Save | <2ms | TBD |
| IndexedDB Load | <2ms | TBD |
| Firebase Sync | <500ms | TBD |
| Achievement Check | <20ms | TBD |
| UI Render (useGamification) | <16ms | TBD |

---

## 🔒 Security Considerations

### XP Manipulation Prevention
1. **Client-side validation**: Basic checks (max XP per session)
2. **Anti-cheat config**: Suspicious thresholds logged
3. **Server-side validation**: Optional (future enhancement)

### Data Integrity
1. **IndexedDB**: User-controlled (acceptable risk)
2. **Firebase**: Server-side rules enforce schema
3. **Version control**: Config versioning for migrations

### Privacy
1. **No PII in gamification data**: Only userId + stats
2. **Leaderboard**: Mock data only (no real rankings)
3. **Opt-out**: Feature flag allows complete disable

---

## 🔮 Future Enhancements (Out of Scope)

1. **Server-side leaderboard**: Real rankings with Firestore queries
2. **Social features**: Friend comparisons, challenges
3. **Seasonal events**: Temporary achievement sets
4. **XP decay**: Reduce XP for inactive users
5. **Badges/Titles**: Visual progression markers
6. **Achievement categories**: Organize by theme
7. **Streak recovery**: Pay to restore lost streaks
8. **Referral rewards**: Bonus XP for invites

---

## 📚 Related Documentation

- **Agent Specifications**:
  - `Agent1-Gamification-Core.md`
  - `Agent2-Config-Rules.md`
  - `Agent3-UI-Integration.md`
  - `Agent4-QA-Observability.md`
  - `Agent5-Supervisor.md`

- **Implementation**:
  - `IMPLEMENTATION-ROADMAP.md`
  - `LAUNCH-CHECKLIST.md`
  - `AGENT-COORDINATION.md`

- **Existing System**:
  - `DEGAMIFICATION_INVENTORY.md` (what was removed)
  - `MOCK_TO_REAL_DATA_INTEGRATION_GUIDE.md` (migration guide)
  - `/docs/root/REVIEW_ENGINE_DEEP_DIVE.md` (URE architecture)

---

**Document Status**: ✅ COMPLETE
**Last Updated**: 2025-10-02
**Maintained By**: Agent 5 (Supervisor)
