# Moshimoshi Documentation Index

## Current Documentation Structure

### 📚 Core System Documentation

#### User Statistics & Data Management
- **[User Stats Migration Documentation](/docs/user-stats-migration/README.md)** ⭐ **NEW**
  - Complete guide for the unified `user_stats` collection
  - Single source of truth for all user data
  - Migration guides and API references
  - Architecture and design decisions

#### Feature Implementation Guides
- **[Leaderboard Implementation](/docs/LEADERBOARD_IMPLEMENTATION.md)** *(Updated 2025-01-26)*
  - Now uses unified `user_stats` collection
  - Scoring algorithms and privacy model
  - Cloud functions and caching strategy

- **[XP Integration Guide](/docs/XP_INTEGRATION_GUIDE.md)** *(Updated 2025-01-26)*
  - Now uses `/api/stats/unified` endpoint
  - Updated to use `useUserStats` hook
  - XP calculation guidelines remain unchanged

#### Review Engine System
- **[Review Engine Deep Dive](/docs/REVIEW_ENGINE_DEEP_DIVE.md)**
  - Complete technical architecture
  - SRS algorithm implementation
  - Offline support and sync

- **[Review Engine Practical Guide](/docs/REVIEW_ENGINE_PRACTICAL_GUIDE.md)**
  - Implementation examples
  - Testing strategies
  - Performance optimization

#### Other Documentation
- **[Redux Persist Issue Resolution](/docs/REDUX_PERSIST_ISSUE_RESOLUTION.md)**
- **[Theme System](/docs/root/THEME_SYSTEM.md)**
- **[PWA Manifest Documentation](/docs/PWA_MANIFEST_DOCUMENTATION.md)**
- **[Achievement Unlock Animation](/docs/ACHIEVEMENT_UNLOCK_ANIMATION.md)**
- **[Achievement System Integration](/docs/achievement-system-integration.md)**

---

## Important Updates (2025-01-26)

### 🔄 Unified Stats Migration
All user statistics have been migrated to a single `user_stats` collection. This affects:

1. **Leaderboard System** - Now reads from `user_stats` instead of multiple collections
2. **XP System** - Uses `/api/stats/unified` instead of `/api/xp/track`
3. **Achievement System** - Integrated into unified stats
4. **Streak Tracking** - Fixed corruption issues, now in `user_stats.streak`

### Deprecated Collections
The following collections are no longer used:
- ❌ `leaderboard_stats`
- ❌ `users/{uid}/achievements/data`
- ❌ `users/{uid}/achievements/activities`
- ❌ `users/{uid}/statistics/overall`
- ❌ `users/{uid}/xp_history`

### New API Endpoints
- ✅ `/api/stats/unified` - Single endpoint for all stats operations
- Old endpoints redirect here for backward compatibility

### Updated Hooks
- ✅ `useUserStats()` - Replaces multiple separate hooks
- Provides: `stats`, `streak`, `xp`, `addXP`, `updateStreak`, etc.

---

## Quick Reference

### For New Features
1. Start with [User Stats Migration Docs](/docs/user-stats-migration/API_REFERENCE.md) for API usage
2. Follow [XP Integration Guide](/docs/XP_INTEGRATION_GUIDE.md) for XP calculations
3. Check [Achievement System](/docs/achievement-system-integration.md) for gamification

### For Maintenance
1. Run validation: `node scripts/validate-unified-stats.js [userId]`
2. Check data health in `user_stats.metadata.dataHealth`
3. Use migration scripts in `/scripts/` folder

### For Architecture Decisions
1. See [Architecture Doc](/docs/user-stats-migration/ARCHITECTURE.md) for design rationale
2. Check [Migration Guide](/docs/user-stats-migration/MIGRATION_GUIDE.md) for transition details

---

Last Updated: 2025-01-26
Maintained by: Development Team