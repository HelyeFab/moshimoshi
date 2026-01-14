# Entitlements Management Scripts Guide

This guide covers the utility scripts for managing user entitlements, usage tracking, and feature limits.

## Prerequisites

All scripts require the Firebase service account credentials file:
- **Path**: `moshimoshi-service-account.json` (in project root)
- **Required for**: Firestore access via Firebase Admin SDK

---

## Available Scripts

### 1. Check User Entitlements

**Script**: `check-entitlements.js`

**Purpose**: View a user's current entitlements, usage, and quota status.

**Usage**:
```bash
node scripts/check-entitlements.js <userId>
```

**Example**:
```bash
node scripts/check-entitlements.js 5NNDhMn8wBXDQQ0aOFpR6M557ju1
```

**Output**:
- User's subscription tier (free/premium)
- All feature usage by date (daily/monthly buckets)
- Current usage counts for each feature
- Detected schema issues (if any)

**Use Cases**:
- Debug why a user can't access a feature
- Verify quota consumption
- Check subscription status
- Audit usage patterns

---

### 2. Reset Feature Usage

**Script**: `reset-feature-usage.js`

**Purpose**: Reset usage counter for a specific feature to allow testing or fix quota issues.

**Usage**:
```bash
node scripts/reset-feature-usage.js <userId> <featureId> [date]
```

**Parameters**:
- `userId` - The user's Firebase UID
- `featureId` - Feature identifier (see list below)
- `date` (optional) - Specific date in YYYY-MM-DD format (defaults to today)

**Examples**:
```bash
# Reset today's usage
node scripts/reset-feature-usage.js 5NNDhMn8wBXDQQ0aOFpR6M557ju1 news

# Reset specific date
node scripts/reset-feature-usage.js 5NNDhMn8wBXDQQ0aOFpR6M557ju1 kanji_mood_board 2026-01-10
```

**Feature IDs** (from `config/features.v1.json`):

**Daily Limits:**
- `news` - News Reading (2 daily)
- `story` - AI Stories (2 daily)
- `drill` - Drill Practice (5 daily)
- `hiragana_practice` - Hiragana Practice (10 daily)
- `katakana_practice` - Katakana Practice (10 daily)
- `kanji_browser` - Kanji Browser (10 daily)
- `kanji_mastery` - Kanji Mastery (5 daily)
- `conjugation_drill` - Conjugation Drill (5 daily)
- `youtube_shadowing` - YouTube Shadowing (3 daily)
- `kanji_mood_board` - Kanji Mood Board (5 daily)

**Monthly Limits:**
- `custom_lists` - Custom Lists (3 monthly)
- `todos` - Todos (100 monthly)

**Use Cases**:
- Testing feature limits
- Fixing stuck quota issues
- Allowing users to retry after errors
- Development testing

---

### 3. Migrate Usage Schema

**Script**: `migrate-usage-schema.js`

**Purpose**: Migrate legacy usage data to the current schema format (from `counts` object to top-level fields).

**Usage**:
```bash
node scripts/migrate-usage-schema.js
```

**What it does**:
1. Scans all user usage documents in Firestore
2. Detects documents using old schema (with nested `counts` object)
3. Migrates to new schema (top-level feature counts)
4. Preserves all data during migration
5. Provides detailed migration report

**Output**:
- Total users processed
- Documents migrated
- Documents already correct
- Documents skipped
- Any errors encountered

**Use Cases**:
- One-time migration after schema changes
- Fixing inconsistent usage data
- Upgrading from older versions

**⚠️ Warning**: This is a data migration script. Test on a backup first if running in production.

---

## Common Workflows

### Testing Feature Limits

1. **Check current usage**:
   ```bash
   node scripts/check-entitlements.js <userId>
   ```

2. **Use feature until quota reached**

3. **Reset usage to test again**:
   ```bash
   node scripts/reset-feature-usage.js <userId> <featureId>
   ```

4. **Verify reset**:
   ```bash
   node scripts/check-entitlements.js <userId>
   ```

### Debugging "Limit Reached" Issues

1. **Check user's current usage**:
   ```bash
   node scripts/check-entitlements.js <userId>
   ```

2. **Verify subscription tier** (output will show free/premium)

3. **Check feature limits** in `config/features.v1.json`

4. **If quota is stuck, reset it**:
   ```bash
   node scripts/reset-feature-usage.js <userId> <featureId>
   ```

### Reset All Features for a User

Currently requires running reset for each feature:

```bash
#!/bin/bash
USER_ID="5NNDhMn8wBXDQQ0aOFpR6M557ju1"

# Daily features
node scripts/reset-feature-usage.js $USER_ID news
node scripts/reset-feature-usage.js $USER_ID story
node scripts/reset-feature-usage.js $USER_ID drill
node scripts/reset-feature-usage.js $USER_ID hiragana_practice
node scripts/reset-feature-usage.js $USER_ID katakana_practice
node scripts/reset-feature-usage.js $USER_ID kanji_browser
node scripts/reset-feature-usage.js $USER_ID kanji_mastery
node scripts/reset-feature-usage.js $USER_ID conjugation_drill
node scripts/reset-feature-usage.js $USER_ID youtube_shadowing
node scripts/reset-feature-usage.js $USER_ID kanji_mood_board

# Monthly features
node scripts/reset-feature-usage.js $USER_ID custom_lists
node scripts/reset-feature-usage.js $USER_ID todos
```

---

## Understanding Usage Buckets

### Daily Buckets
- **Format**: `{featureId}_YYYY-MM-DD`
- **Example**: `news_2026-01-13`
- **Resets**: Automatically at midnight UTC
- **Firestore Path**: `/usage/{userId}/daily/{bucketId}`

### Monthly Buckets
- **Format**: `{featureId}_YYYY-MM`
- **Example**: `custom_lists_2026-01`
- **Resets**: Automatically on 1st of each month
- **Firestore Path**: `/usage/{userId}/monthly/{bucketId}`

### Special Cases

**Kanji Mood Board** has two buckets:
1. `kanji_mood_board_YYYY-MM-DD` - Daily board access limit
2. `kanji_mood_board_boards_YYYY-MM-DD` - Tracks which boards were accessed

---

## Schema Reference

### Current Schema (Top-level counts)
```typescript
{
  userId: string
  date: string  // YYYY-MM-DD or YYYY-MM
  [featureId]: number  // e.g., news: 2, story: 1
  updatedAt: string
}
```

### Legacy Schema (Nested counts) - ❌ Deprecated
```typescript
{
  userId: string
  date: string
  counts: {
    [featureId]: number
  }
  updatedAt: string
}
```

---

## Troubleshooting

### Script Can't Find Service Account File

**Error**: `Error: ENOENT: no such file or directory, open 'moshimoshi-service-account.json'`

**Solution**: Ensure `moshimoshi-service-account.json` is in the project root directory.

### Permission Denied Errors

**Error**: `Permission denied` or `Insufficient permissions`

**Solution**: Verify the service account has:
- Firestore read/write permissions
- Cloud Datastore User role (minimum)

### Feature ID Not Found

**Error**: No usage documents found for feature

**Solution**:
- Verify the feature ID is correct (check `config/features.v1.json`)
- User may not have used the feature yet (no bucket created)
- Check spelling and case sensitivity

### Migration Script Fails

**Error**: Various errors during migration

**Solution**:
1. Check Firestore permissions
2. Verify no concurrent writes during migration
3. Review error output for specific document IDs
4. Run `check-entitlements.js` to verify final state

---

## Best Practices

1. **Always check before resetting**: Use `check-entitlements.js` first to understand current state

2. **Be specific with dates**: When resetting, specify exact dates to avoid affecting wrong data

3. **Test on staging first**: Never run migration scripts directly on production without testing

4. **Keep service account secure**: Never commit `moshimoshi-service-account.json` to version control

5. **Monitor quota limits**: Regularly audit feature usage to ensure limits are working as expected

6. **Document manual interventions**: Log when and why you reset user quotas

---

## Future Enhancements

Potential improvements to these scripts:

- [ ] Bulk reset all features for a user
- [ ] Reset feature usage for multiple users
- [ ] Export usage data to CSV
- [ ] Set custom quota limits per user
- [ ] Scheduled quota cleanup/archiving
- [ ] Usage analytics and reporting

---

## Related Documentation

- **Entitlements System**: `/01_PRODUCTION_DOCS/2-Payment-Monetization/OFFLINE_ENTITLEMENTS_COMPLIANT_DESIGN.md`
- **Feature Configuration**: `/config/features.v1.json`
- **Feature Usage Indicator**: `/01_PRODUCTION_DOCS/3-Features/FEATURE_USAGE_INDICATOR_INTEGRATION_GUIDE.md`
- **Usage Hooks**: `/src/hooks/useFeature.ts`

---

**Last Updated**: 2026-01-13
**Version**: 1.0
**Maintainer**: Development Team
