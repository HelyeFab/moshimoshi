# Leaderboard Implementation Guide

## Overview

The leaderboard system provides competitive rankings for users based on their achievements, XP, and streaks. It uses an **opt-out model** where users appear on the leaderboard by default but can choose to hide themselves through privacy settings.

## Architecture

### Data Sources (Single Source of Truth)

1. **Streak Data**: `users/{uid}/achievements/activities`
   - currentStreak
   - bestStreak
   - lastActivity

2. **XP Data**: `users/{uid}/stats/xp`
   - totalXP
   - currentLevel
   - weeklyXP
   - monthlyXP

3. **Achievements**: `users/{uid}/achievements/data`
   - unlocked achievements
   - totalPoints
   - rarity counts

4. **User Profile**: `users/{uid}`
   - displayName
   - photoURL
   - subscription plan

5. **Privacy Settings**: `users/{uid}/preferences/settings`
   - hideFromLeaderboard (false by default)
   - useAnonymousName

## Components

### 1. LeaderboardService (`/src/lib/leaderboard/LeaderboardService.ts`)
- Aggregates user data from multiple Firebase collections
- Calculates rankings based on composite scoring
- Handles caching with Redis and Firestore

### 2. Cloud Function (`/functions/src/scheduled/leaderboard.ts`)
- Runs hourly to pre-compute leaderboard snapshots
- Stores snapshots in `leaderboard_snapshots` collection
- Maintains historical data for trend analysis

### 3. API Routes
- `GET /api/leaderboard` - Returns leaderboard entries
- `GET /api/leaderboard/user/[userId]` - Returns specific user's rank

### 4. UI Components
- `/app/leaderboard/page.tsx` - Main leaderboard page
- `/components/leaderboard/AchievementLeaderboard.tsx` - Leaderboard display component

### 5. Redis Caching (`/src/lib/redis/caches/leaderboard-cache.ts`)
- 5-minute TTL for leaderboard snapshots
- Automatic fallback to Firestore if Redis unavailable
- Multi-layer caching for optimal performance

## Scoring Algorithm

### All-Time Ranking
```
Score = totalPoints + totalXP + (bestStreak × 3)
```

### Monthly Ranking
```
Score = totalPoints + monthlyXP + (currentStreak × 2)
```

### Weekly Ranking
```
Score = totalPoints + weeklyXP + (currentStreak × 5)
```

### Daily Ranking
```
Score = totalPoints + dailyXP + (currentStreak × 10)
```

## Privacy Model (Opt-Out)

Users are **included by default** on the leaderboard. They can opt out by:

1. Go to Settings → Privacy
2. Enable "Hide from Leaderboard"

This sets `hideFromLeaderboard: true` in their preferences.

## Setup Instructions

### 1. Deploy Cloud Functions

```bash
cd functions
npm install
npm run deploy
```

This deploys:
- `updateLeaderboardSnapshots` - Scheduled hourly
- `updateLeaderboardManually` - HTTP trigger for testing

### 2. Apply Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

This creates indexes for:
- `leaderboard_snapshots` collection
- `leaderboard_history` collection
- User subscription queries

### 3. Initialize User Preferences

Run the script to set default preferences for existing users:

```bash
# Dry run first to see what will be changed
node scripts/update-leaderboard-preferences.js --dry-run

# Apply changes
node scripts/update-leaderboard-preferences.js
```

### 4. Trigger Manual Update (Optional)

To immediately populate the leaderboard:

```bash
# You'll need to set up an admin token first
curl -X POST https://your-project.cloudfunctions.net/updateLeaderboardManually \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Performance Optimizations

### Caching Layers
1. **Redis Cache** (5 min TTL) - Fastest response
2. **Firestore Snapshots** - Hourly updates
3. **Real-time Build** - Fallback only

### Query Optimization
- Firestore composite indexes for efficient queries
- Batch processing for user data aggregation
- Parallel fetching of user stats

### Scalability
- Hourly snapshots reduce real-time computation
- Top 100 users cached per timeframe
- Historical data expires after set period

## Testing

### Local Testing with Mock Data

Add `?mock=true` to use mock data:
```
http://localhost:3000/leaderboard?mock=true
```

### API Testing

```bash
# Get leaderboard
curl http://localhost:3000/api/leaderboard?timeframe=allTime&limit=10

# Get user rank
curl http://localhost:3000/api/leaderboard/user/USER_ID?timeframe=weekly
```

## Monitoring

### Logs to Watch
- `[LeaderboardService]` - Service operations
- `[LeaderboardCache]` - Redis cache operations
- `[Leaderboard]` - Cloud Function execution

### Key Metrics
- Cache hit ratio
- Snapshot generation time
- Total active players
- Opt-out percentage

## Troubleshooting

### No Users on Leaderboard
1. Check if users have opted out
2. Verify Cloud Function is running
3. Check Firestore permissions

### Stale Data
1. Check Redis cache TTL
2. Verify Cloud Function schedule
3. Manually trigger update if needed

### Performance Issues
1. Check Firestore indexes are deployed
2. Verify Redis is running
3. Check batch size in aggregation

## Future Enhancements

1. **Friends Leaderboard** - Compare with friends only
2. **Country/Region Filters** - Regional rankings
3. **Leagues/Tiers** - Bronze, Silver, Gold divisions
4. **Seasonal Resets** - Quarterly competitions
5. **Rewards System** - Badges for top performers
6. **Real-time Updates** - WebSocket for live changes

## Data Privacy Compliance

- Users can opt out at any time
- Anonymous display option available
- No sensitive data exposed
- GDPR compliant with user control

---

Last Updated: 2025-01-25
Author: Claude & Beano