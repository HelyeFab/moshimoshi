# User Stats Migration Documentation

## Overview
Complete documentation for the user statistics migration from scattered Firebase collections to a unified single source of truth in the `user_stats` collection. This migration fixes data corruption issues and establishes a reliable system for tracking user progress, streaks, XP, and achievements.

## Documentation Contents

### 📁 Core Documentation
- [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md) - Summary of the migration completed
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API documentation
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Step-by-step migration instructions
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design decisions

### Key Benefits
1. **Single Source of Truth** - All user stats in one `user_stats` collection
2. **Data Integrity** - Fixed corruption issues with nested dates
3. **Better Performance** - Single document read instead of multiple collections
4. **Easier Administration** - One place to check all user statistics
5. **Backward Compatibility** - Old endpoints redirect to unified API

### Quick Start

#### For Developers
```typescript
// Use the unified stats hook
import { useUserStats } from '@/hooks/useUserStats'

const { stats, streak, xp, updateStreak, addXP } = useUserStats()
```

#### For Administrators
```bash
# Check user stats
node scripts/validate-unified-stats.js [userId]

# Migrate users
node scripts/migrate-to-unified-stats.js

# Clean up old data
node scripts/cleanup-old-collections.js [userId] --execute
```

### System Status
- ✅ Core system implemented
- ✅ API endpoints migrated with redirects
- ✅ Components updated to use unified system
- ✅ Test user fully migrated
- ⏳ Pending: Full user migration

### Migration Scripts Location
All migration scripts are in `/scripts/`:
- `migrate-to-unified-stats.js` - Main migration script
- `cleanup-old-collections.js` - Remove old collections
- `validate-unified-stats.js` - Validation tool
- `repair-corrupted-dates.js` - Fix date corruption issues

### Support
For issues or questions about the unified stats system, check the detailed documentation in this folder or contact the development team.