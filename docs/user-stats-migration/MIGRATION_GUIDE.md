# User Stats Migration Guide

## Overview
This guide walks through migrating from the scattered statistics system to the unified `user_stats` collection.

## Pre-Migration State

### Old Collections Structure
Previously, user statistics were scattered across multiple collections:

1. **`leaderboard_stats`** - XP, streaks, levels
2. **`users/{uid}/achievements/data`** - Achievement unlocks
3. **`users/{uid}/achievements/activities`** - Daily activity dates (CORRUPTED)
4. **`users/{uid}/statistics/overall`** - Session statistics

### Problems with Old System
- ❌ Data inconsistency between collections
- ❌ Corrupted date storage (e.g., "dates.2025-01-26" at root level)
- ❌ Multiple reads required for single user's stats
- ❌ Difficult to maintain data integrity
- ❌ Hard to administer and debug

## Migration Process

### Phase 1: Prepare Environment

1. **Backup existing data** (optional but recommended)
```bash
# Export Firestore data using gcloud
gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
```

2. **Deploy new code**
- Ensure all updated files are deployed
- Verify redirect endpoints are working

### Phase 2: Run Migration Script

1. **Test with single user first**
```bash
# Dry run for specific user
node scripts/migrate-to-unified-stats.js r7r6at83BUPIjD69XatI4EGIECr1

# Validate the migration
node scripts/validate-unified-stats.js r7r6at83BUPIjD69XatI4EGIECr1
```

2. **Migrate all users**
```bash
# Run migration for all users
node scripts/migrate-to-unified-stats.js

# This will:
# - Read from all old collections
# - Fix corrupted date formats
# - Create user_stats documents
# - Preserve all existing data
```

### Phase 3: Validate Migration

1. **Run validation script**
```bash
# Validate specific user
node scripts/validate-unified-stats.js [userId]

# Expected output:
# ✅ user_stats document found
# ✅ Streak data consistent
# ✅ Schema version: 2 (latest)
# ✅ Data health: healthy
```

2. **Check for issues**
- Look for any warnings or errors
- Verify streak calculations are correct
- Ensure XP and achievements transferred

### Phase 4: Clean Up Old Data

⚠️ **WARNING**: Only run cleanup after confirming migration success!

1. **Test cleanup with single user**
```bash
# Dry run (no changes)
node scripts/cleanup-old-collections.js [userId]

# Execute cleanup
node scripts/cleanup-old-collections.js [userId] --execute
```

2. **Clean up all users**
```bash
# Dry run for all users
node scripts/cleanup-old-collections.js --all

# Execute cleanup for all users
node scripts/cleanup-old-collections.js --all --execute
```

## Data Transformation Details

### Streak Data Fix
The migration automatically fixes corrupted streak data:

**Before (Corrupted):**
```json
{
  "dates.2025-01-23": true,
  "dates.2025-01-24": true,
  "dates": {}
}
```

**After (Fixed):**
```json
{
  "dates": {
    "2025-01-23": true,
    "2025-01-24": true
  }
}
```

### Schema Updates
- Added `schemaVersion: 2` for tracking
- Added `dataHealth` status field
- Added `migrationHistory` array
- Consolidated `weeklyXP` and `monthlyXP` into XP object

## Rollback Procedure

If issues arise, you can rollback:

1. **Restore from backup** (if created)
```bash
gcloud firestore import gs://your-bucket/backup-YYYYMMDD
```

2. **Revert code deployment**
- Deploy previous version without unified stats
- Old endpoints will work with old collections

## Post-Migration Checklist

- [ ] All users have `user_stats` documents
- [ ] No errors in validation script
- [ ] Application functions correctly
- [ ] Streak tracking works
- [ ] XP accumulation works
- [ ] Achievements unlock properly
- [ ] Leaderboard displays correctly
- [ ] Old collections removed (after verification)

## Monitoring

### Check Migration Status
```bash
# Count migrated users
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
admin.firestore().collection('user_stats').get()
  .then(snapshot => console.log('Migrated users:', snapshot.size));
"
```

### Monitor Data Health
```bash
# Check for unhealthy documents
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
admin.firestore().collection('user_stats')
  .where('metadata.dataHealth', '!=', 'healthy').get()
  .then(snapshot => console.log('Unhealthy docs:', snapshot.size));
"
```

## Troubleshooting

### Issue: Migration script fails for specific user
**Solution:** Run repair script first
```bash
node scripts/repair-corrupted-dates.js [userId]
```

### Issue: Validation shows warnings about old collections
**Solution:** Run cleanup script
```bash
node scripts/cleanup-old-collections.js [userId] --execute
```

### Issue: Stats not updating in app
**Solution:** Clear Redis cache
```bash
# The app will rebuild cache on next request
redis-cli FLUSHDB
```

## Support Scripts

All scripts are in `/scripts/`:
- `migrate-to-unified-stats.js` - Main migration
- `validate-unified-stats.js` - Validation tool
- `cleanup-old-collections.js` - Remove old data
- `repair-corrupted-dates.js` - Fix corruption

## Contact
For migration support, check logs in Firebase Console or contact the development team.