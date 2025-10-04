# Achievement System Documentation

## Overview
The Moshimoshi achievement system is a gamification feature that tracks user progress, unlocks rewards, and calculates streaks. It's built using event-driven architecture with localStorage persistence.

## Architecture

### Core Components

#### 1. Achievement System (`/src/lib/review-engine/progress/achievement-system.ts`)
- **Location**: Lines 1-890
- **Purpose**: Core logic for achievement definitions, unlock conditions, and progress tracking
- **Key Classes**:
  - `AchievementSystem`: Main class managing all achievement logic
  - `Achievement`: Interface defining achievement structure
  - `UserAchievements`: Interface for user's achievement state

#### 2. Achievement Store (`/src/stores/achievement-store.ts`)
- **Purpose**: Zustand store for global state management
- **Key Methods**:
  - `initialize(userId, isPremium)`: Sets up achievement system for a user with premium status
  - `getTotalPoints()`: Returns sum of all unlocked achievement points
  - `getCompletionPercentage()`: Returns % of achievements unlocked
  - `getRecentAchievements()`: Returns last 5 unlocked achievements
  - `currentStreak`: Tracks consecutive days of activity

**Important**: The `initialize` method requires `isPremium` parameter to determine whether to sync with Firebase

#### 3. Progress Tracker (`/src/lib/review-engine/progress/progress-tracker.ts`)
- **Purpose**: Tracks learning progress and calculates streaks
- **Streak Calculation**: Lines 422-473
- **Key Features**:
  - Calculates streak from `localStorage` activities
  - Records daily activities for both study and review sessions
  - Merges review data with study session data

### Data Flow

```
User Activity
    ↓
Review Engine / Learning Session
    ↓
Progress Tracker (records activity)
    ↓
Achievement System (checks conditions)
    ↓
Achievement Store (updates state)
    ↓
UI Components (display achievements)
```

## Current Storage Architecture

### Dual Storage Strategy (localStorage + Firebase)

#### For Free Users:
- All data stored in localStorage only
- No cloud sync

#### For Premium Users:
- Data stored in both localStorage (for immediate access) and Firebase (for persistence)
- Firebase sync happens via server-side API endpoints
- localStorage acts as cache for offline/immediate access

### localStorage Keys
- `achievements_${userId}`: Stores unlocked achievements
- `activities_${userId}`: Stores daily activity for streak calculation
- `progress_${userId}`: Stores learning progress data
- `bestStreak_${userId}`: Stores user's best streak record

### Firebase Structure (Premium only)
```
users/
  ${userId}/
    achievements/
      data/          # Achievement unlocks and points
      activities/    # Streak and daily activity data
```

### API Endpoints (Server-side only)
- `GET/POST /api/achievements/data`: Load/save achievement data
- `GET/POST /api/achievements/activities`: Load/save streak data

### Data Structure

```typescript
// Achievement Data
{
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'progress' | 'streak' | 'accuracy' | 'speed' | 'special';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
  unlockedAt?: number; // timestamp
  progress?: number;   // for progressive achievements
  maxProgress?: number;
}

// User Achievements
{
  userId: string;
  unlocked: Set<string>; // achievement IDs
  totalPoints: number;
  recentUnlocks: Achievement[];
  statistics: {
    percentageComplete: number;
    byCategory: Map<string, number>;
  }
}

// Daily Activities (for streak)
{
  "2025-01-15": true,
  "2025-01-14": true,
  // ... dates when user was active
}
```

## Achievement Categories

### 1. Progress Achievements
- Triggered by learning milestones
- Examples: "Learn 10 hiragana", "Complete first lesson"
- Defined in: `achievement-system.ts:156-250`

### 2. Streak Achievements
- Triggered by consecutive days of activity
- Examples: "3-day streak", "Week warrior (7 days)"
- Defined in: `achievement-system.ts:251-350`

### 3. Accuracy Achievements
- Triggered by high accuracy in sessions
- Examples: "Perfect session", "90% accuracy"
- Defined in: `achievement-system.ts:351-450`

### 4. Speed Achievements
- Triggered by fast response times
- Examples: "Lightning fast", "Speed demon"
- Defined in: `achievement-system.ts:451-550`

### 5. Special Achievements
- Unique conditions and seasonal events
- Examples: "Night owl", "Early bird"
- Defined in: `achievement-system.ts:551-650`

## Where Data is Accessed

### Dashboard Page (`/src/app/dashboard/page.tsx`)
- Lines 36-43: Imports achievement store methods
- Lines 96-100: Displays learning stats (streak, XP, progress %)
- Lines 233-246: Shows recent achievement details

### AchievementDisplay Component (`/src/components/dashboard/AchievementDisplay.tsx`)
- Lines 194-205: Gets achievement data from store
- Lines 280: Shows total points and completion percentage
- Lines 329-343: Renders achievement grid

### Navbar (`/src/components/layout/Navbar.tsx`)
- Displays streak counter with flame emoji
- Gets streak from achievement store

## Adding New Achievements

### Step 1: Define Achievement
Add to `achievement-system.ts` in the appropriate category:

```typescript
{
  id: 'unique-id',
  name: 'Achievement Name',
  description: 'What the user did',
  icon: '🏆',
  category: 'progress', // or streak, accuracy, etc.
  rarity: 'uncommon',
  points: 50,
  condition: (stats) => stats.someMetric >= threshold
}
```

### Step 2: Add Trigger Condition
In `checkAchievements()` method:

```typescript
// Check your new achievement condition
if (!unlocked.has('unique-id') && condition(userStats)) {
  this.unlockAchievement('unique-id');
}
```

### Step 3: Add Progress Tracking (if needed)
For progressive achievements, update progress in relevant events:

```typescript
this.updateAchievementProgress('unique-id', currentValue, maxValue);
```

## Subscription Detection and Usage

### CRITICAL: How to Initialize Achievement Store

The achievement store **MUST** be initialized with the correct premium status to ensure proper data synchronization:

```typescript
// CORRECT - Pass premium status from subscription hook
import { useSubscription } from '@/hooks/useSubscription';
import { useAchievementStore } from '@/stores/achievement-store';

const { subscription, isPremium } = useSubscription();
const { initialize } = useAchievementStore();

useEffect(() => {
  if (user?.uid && subscription !== null) {
    // Pass isPremium as second parameter
    initialize(user.uid, isPremium);
  }
}, [user?.uid, isPremium, subscription]);
```

```typescript
// INCORRECT - Missing premium status
initialize(user.uid); // ❌ Will default to free tier
```

### Why This Matters
- **Free users**: Data only stored in localStorage
- **Premium users**: Data synced to Firebase for persistence across devices
- **Without correct status**: Premium users lose their streaks/achievements on page refresh

### Subscription Hook (`useSubscription`)
The subscription status comes from `/api/user/subscription` endpoint which:
1. Checks session authentication
2. Queries Firebase Admin SDK for subscription data
3. Returns subscription facts including premium status

## Events System

### Achievement Events
- `achievement.unlocked`: Fired when achievement is unlocked
- `milestone.reached`: Fired when user reaches a milestone
- `progress.updated`: Fired when progress changes
- `notification.show`: Fired to show achievement toast

### Listening to Events
```typescript
achievementSystem.on('achievement.unlocked', (data) => {
  // data.achievement contains the unlocked achievement
  showToast(data.achievement);
});
```

## Testing Achievements

### Manual Testing
```javascript
// In browser console
localStorage.setItem('debug:achievements', 'true'); // Enable debug logging

// Force unlock achievement (for testing)
const store = useAchievementStore.getState();
store.unlockAchievement('achievement-id');

// Clear all achievements (reset)
localStorage.removeItem(`achievements_${userId}`);
```

### Unit Tests
Located in `/src/lib/review-engine/progress/__tests__/`
- Test achievement conditions
- Test unlock logic
- Test progress calculations

## Performance Considerations

### Current Limitations
1. **No cloud sync**: Data lost on device change/clear
2. **localStorage size**: Limited to ~5-10MB
3. **Calculation overhead**: Streak calculation on every check

### Optimization Tips
- Achievement checks are throttled to prevent excessive calculations
- Use memoization for expensive calculations
- Batch updates when possible

## Future Improvements

### Planned Features
1. **Firebase Sync** (for Premium users)
   - Store achievements in Firestore
   - Sync across devices
   - Backup/restore functionality

2. **Achievement Badges**
   - Visual badges for profile
   - Shareable achievement cards

3. **Leaderboards**
   - Global/friend rankings
   - Weekly/monthly competitions

4. **Custom Achievements**
   - User-created challenges
   - Community achievements

### Migration Path
When implementing Firebase sync:
1. Keep localStorage as primary (fast access)
2. Add Firestore as backup (premium only)
3. Implement conflict resolution (last-write-wins)
4. Add sync status indicators

## Common Issues & Solutions

### Issue: Achievements not unlocking
**Solution**: Check browser console for errors, verify localStorage is enabled

### Issue: Streak reset unexpectedly
**Solution**: Check timezone handling, ensure daily activity is recorded

### Issue: Points not updating
**Solution**: Clear achievement store cache, re-initialize

### Issue: Lost achievements after update
**Solution**: Implement migration logic for schema changes

### Issue: Review sessions not updating achievements/streaks
**Solution**: Ensure review completion handlers call `achievementStore.updateProgress()`
**Lesson Learned**: When refactoring major systems (like moving streaks from user profile to achievements), always trace the data flow end-to-end. The review engine completion handlers (`handleReviewComplete`, study mode completion) must be updated to call the achievement store's `updateProgress()` method.

## Integration Points

### Review Engine Integration
The review engine must be connected to the achievement system to track progress:

```typescript
// In your review completion handler:
import { useAchievementStore } from '@/stores/achievement-store'

const handleReviewComplete = async (stats: SessionStatistics) => {
  const achievementStore = useAchievementStore.getState()
  await achievementStore.updateProgress({
    sessionType: 'kana', // or 'kanji', 'vocabulary', etc.
    itemsReviewed: stats.totalItems,
    accuracy: stats.accuracy,
    duration: stats.duration,
    completedAt: new Date()
  })
}
```

### Study Mode Integration
Study sessions should also update achievements:

```typescript
// When study session completes:
await achievementStore.updateProgress({
  sessionType: 'kana_study',
  itemsReviewed: itemCount,
  accuracy: 100, // Study mode is practice
  duration: sessionDuration,
  completedAt: new Date()
})
```

## API Reference

### AchievementSystem Methods
```typescript
getAllAchievements(): Achievement[]
getUserAchievements(): UserAchievements
unlockAchievement(id: string): void
checkAchievements(): void
getNextAchievable(limit: number): Achievement[]
updateAchievementProgress(id: string, current: number, max: number): void
```

### AchievementStore Methods
```typescript
initialize(userId: string): Promise<void>
getTotalPoints(): number
getCompletionPercentage(): number
getRecentAchievements(limit?: number): Achievement[]
getAchievementsByCategory(category: string): Achievement[]
updateStreak(streak: number): void
```

## Security Considerations

### Current State
- All validation client-side (can be manipulated)
- No server verification of achievements
- localStorage can be edited by user

### Recommended Improvements
1. Server-side validation for critical achievements
2. Encrypted achievement data
3. Anti-cheat mechanisms
4. Rate limiting for achievement unlocks

---

Last Updated: January 2025
Maintainer: Moshimoshi Development Team