# Database Migrations

## Backfill Announcement Views

### Problem
View tracking was added after dismissal tracking. Old announcements show:
- ❌ Views: 0
- ✅ Dismissals: 61

This is impossible - users can't dismiss without viewing.

### Solution
Creates view records for all existing dismissals.

Logic: `If dismissed → must have viewed`

---

## Running the Migration

### Prerequisites

1. **Service Account Key Required**

   Download from Firebase Console:
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save as `serviceAccountKey.json` in project root

   **OR** set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
   ```

### Run Migration

```bash
# From project root
node scripts/migrations/backfill-announcement-views.mjs
```

### Expected Output

```
╔════════════════════════════════════════════════╗
║   Announcement Views Backfill Migration       ║
╚════════════════════════════════════════════════╝

🔄 Starting announcement views backfill...

✅ Firebase Admin initialized
📊 Fetching dismissal records...
✅ Found 61 dismissal records

✅ Created view: user123_abc456 (61/61)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BACKFILL COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Created:  61 view records
⏭️  Skipped:  0 (already existed)
❌ Errors:   0
📋 Total:    61 dismissals processed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Success! Historical announcement views have been backfilled.
   Analytics should now show correct view counts.
```

---

## Verify Results

```bash
node scripts/migrations/backfill-announcement-views.mjs --verify
```

### Verification Output

```
╔════════════════════════════════════════════════╗
║   Announcement Views Backfill Migration       ║
╚════════════════════════════════════════════════╝

🔍 Verifying backfill results...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 VERIFICATION RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👁️  Total views:      61
✅ Total dismissals: 61
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Verification passed! Views ≥ Dismissals
   Every dismissal has a corresponding view.

🔍 Checking individual announcements...

✅ All announcements have correct view counts!
```

---

## What It Does

### For Each Dismissal Record:

1. **Reads dismissal**: `{userId}_{announcementId}` from `announcement_dismissals`

2. **Creates matching view**: `{userId}_{announcementId}` in `announcement_views`

3. **Sets timestamps**:
   - `viewedAt` = 1 second before `dismissedAt` (logical order)
   - Adds metadata: `_backfilled: true`, `_backfilledAt: timestamp`

4. **Skips if exists**: Idempotent - safe to run multiple times

### Result:

**Before**:
```
announcement_dismissals: 61 records
announcement_views: 0 records
Analytics: 0 views, 61 dismissals ❌
```

**After**:
```
announcement_dismissals: 61 records
announcement_views: 61 records
Analytics: 61 views, 61 dismissals ✅
```

---

## Safety Features

### Idempotent
- ✅ Safe to run multiple times
- Skips existing view records
- Won't create duplicates

### Non-Destructive
- ✅ Only creates new records
- Never deletes anything
- Never modifies existing data

### Auditable
- ✅ Adds metadata to backfilled records:
  - `_backfilled: true`
  - `_backfilledAt: timestamp`
- Can identify which views were backfilled vs tracked naturally

---

## Troubleshooting

### Error: serviceAccountKey.json not found

**Solution**: Download service account key from Firebase Console

### Error: Permission denied

**Solution**: Ensure service account has Firestore read/write permissions

### Error: Module not found

**Solution**: Run from project root, not scripts directory

### Some records skipped

**Normal**: Records already existed (from new announcements with view tracking)

### Verification shows mismatches

**Solution**: Run migration again - some records may have failed

---

## After Running

1. ✅ Go to `/en/admin/announcements`
2. ✅ Refresh the page
3. ✅ Check announcement analytics
4. ✅ Should now show: `Views: 61, Dismissals: 61`

---

## Technical Details

### Document Structure

**Created in `announcement_views`**:
```typescript
{
  visitorId: "user123_abc456",
  visitorType: "user",
  visitorValue: "user123",
  announcementId: "abc456",
  viewedAt: Timestamp,
  _backfilled: true,        // Metadata
  _backfilledAt: Timestamp  // Metadata
}
```

### Timestamp Logic

```typescript
// View should happen before dismissal
viewedAt = dismissedAt - 1000ms  // 1 second before
```

### Query Pattern

```typescript
// Get all dismissals
const dismissals = await db
  .collection('announcement_dismissals')
  .get()

// For each dismissal, create matching view
for (const dismissal of dismissals.docs) {
  const viewId = `${visitorValue}_${announcementId}`
  await db.collection('announcement_views')
    .doc(viewId)
    .set({ ... })
}
```

---

## Future Migrations

To add new migrations:

1. Create `scripts/migrations/your-migration.mjs`
2. Follow same structure (initialize, migrate, verify)
3. Make executable: `chmod +x`
4. Document in this README

---

## Help

```bash
node scripts/migrations/backfill-announcement-views.mjs --help
```

### Commands:
- `(no args)` - Run migration
- `--verify` or `-v` - Verify results
- `--help` or `-h` - Show help
