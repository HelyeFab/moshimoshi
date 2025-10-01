# Universal Sync System - Quick Reference

## 🎯 Quick Facts

- **9 Services Synced**: Lists, Kana Progress, Achievements, Streak, Preferences, Pokemon, Video History, Practice History, Review Data
- **Premium Only**: Manual sync requires premium subscription
- **Location**: User menu → Sync status (click to expand)
- **Speed**: ~5-7 seconds for full sync
- **Status**: ✅ Production Ready

---

## 📍 File Locations

### Main Component
```
/src/components/sync/SyncStatusMenuItem.tsx
```

### Service Managers (with forceSyncToFirebase methods)
```
/src/services/videoHistory.ts                        ← NEW (2025-10-01)
/src/services/practiceHistory/PracticeHistoryService.ts  ← NEW (2025-10-01)
/src/utils/pokemonManager.ts
/src/utils/kanaProgressManager.ts
/src/utils/achievementManager.ts
/src/utils/preferencesManager.ts
/src/lib/lists/ListManager.ts
/src/lib/sync/streakSync.ts
```

---

## 🔧 Quick Commands

### Test Sync Locally
1. Start dev server: `npm run dev`
2. Sign in as premium user
3. Open navbar user menu
4. Click sync button (refresh icon)
5. Watch progress in expanded view

### Check Firebase Data
```javascript
// Open browser console after sync
// Navigate to Firebase Console → Firestore

// Check collections:
users/{uid}/studyLists
users/{uid}/progress/{hiragana|katakana}
users/{uid}/achievements
users/{uid}/activities
userPreferences/{uid}
pokemon/{uid}
userVideoHistory/{uid}
userPracticeHistory/{uid}_{videoId}
review_sessions/{sessionId}
```

---

## 🎨 UI States

| State | Icon | Description |
|-------|------|-------------|
| Synced | ✅ Green check | All services synced successfully |
| Syncing | 🟡 Spinner | Currently syncing services |
| Offline | ⚠️ WiFi off | No internet connection |
| Error | ❌ Red triangle | One or more services failed |

---

## 🚀 Adding a New Service

### Step 1: Add Force Sync Method
```typescript
// In your service/manager file
async forceSyncToFirebase(): Promise<void> {
  if (!this.userId || !this.isPremium || !db) {
    console.log('[YourService] Skipping force sync')
    return
  }

  try {
    console.log('[YourService] Force syncing...')
    const localData = await this.getLocalData()

    await setDoc(doc(db, 'yourCollection', this.userId), {
      data: localData,
      lastUpdated: new Date().toISOString()
    })

    console.log(`[YourService] Synced ${localData.length} items`)
  } catch (error) {
    console.error('[YourService] Force sync failed:', error)
    throw error
  }
}
```

### Step 2: Add to Sync List
```typescript
// In SyncStatusMenuItem.tsx

// Add to services array:
const services: SyncProgress[] = [
  // ... existing services
  { service: 'Your Service', status: 'pending' },
]

// Add sync logic in handleManualSync():
try {
  updateProgress('Your Service', 'syncing')
  const { yourManager } = await import('@/path/to/manager')
  await yourManager.forceSyncToFirebase()
  updateProgress('Your Service', 'completed', itemCount)
} catch (error: any) {
  logger.error('Failed to sync your service', error)
  updateProgress('Your Service', 'error', undefined, error.message)
}
```

### Step 3: Test
1. Add some data locally
2. Click sync button
3. Verify in Firebase Console
4. Check sync progress UI

---

## 🐛 Common Issues

### Issue: "Manual sync requires premium subscription"
**Cause**: User is not premium
**Fix**: Upgrade to premium or test with premium account

### Issue: Service shows error (❌)
**Cause**: Firebase permission denied or network error
**Fix**:
1. Check browser console for details
2. Verify Firestore rules allow write
3. Check network connectivity

### Issue: Sync stuck on one service
**Cause**: Service taking too long or hanging
**Fix**:
1. Check browser console for errors
2. Refresh page
3. Try individual service sync

### Issue: "No data to sync" but I have data
**Cause**: Data not in expected local storage
**Fix**:
1. Check IndexedDB/localStorage in DevTools
2. Verify service initialization
3. Add some new data and try again

---

## 📊 Monitoring Sync

### Browser Console Logs
```javascript
// Success logs:
[Lists] Synced 12 lists to Firebase
[Pokemon] Successfully synced 45 Pokemon to Firebase
[Sync] All 9 services synced successfully!

// Error logs:
[VideoHistory] Force sync failed: FirebaseError: permission-denied
[Sync] Failed to sync Pokemon: Network error
```

### Firebase Console
- Navigate to Firestore Database
- Check each collection for recent updates
- Verify `lastUpdated` or `updatedAt` timestamps
- Check document counts match local data

### Network Tab (DevTools)
- Filter by `firestore.googleapis.com`
- Check for 200 OK responses
- Look for 403 (permission denied) or 500 errors

---

## 🔑 Key Concepts

### Sequential vs Parallel Sync
- **Current**: Sequential (one after another)
- **Future**: Parallel (`Promise.all()`)
- **Trade-off**: Sequential is slower but easier to track

### Error Isolation
- Each service wrapped in try/catch
- Failed service doesn't block others
- User sees partial success: "Synced 7/9 services"

### Progress Tracking
- Real-time updates via `updateProgress()`
- Shows current service: "Pokemon... (6/9)"
- Visual indicators for each service state

---

## 📝 Code Snippets

### Get Sync Status Programmatically
```typescript
// In any component
import { useState } from 'react'

const [syncStatus, setSyncStatus] = useState({
  isOnline: navigator.onLine,
  syncState: 'synced',
  lastSyncTime: new Date()
})
```

### Trigger Sync from Code
```typescript
// Not recommended - use UI button instead
// But if needed:
const handleManualSync = async () => {
  // Copy logic from SyncStatusMenuItem
}
```

### Check Last Sync Time
```typescript
// From SyncStatusMenuItem state
const lastSync = syncStatus.lastSyncTime
const timeAgo = formatDistanceToNow(lastSync, { addSuffix: true })
// "2 minutes ago"
```

---

## 🎯 Best Practices

1. **Always test with premium account** during development
2. **Check Firebase Console** after sync to verify data
3. **Use browser console** to debug errors
4. **Don't sync too frequently** - respect Firebase quotas
5. **Handle errors gracefully** - show user-friendly messages
6. **Log everything** - helps with debugging production issues

---

## 📞 Need Help?

- **Documentation**: `/docs/sync/UNIVERSAL_SYNC_SYSTEM.md`
- **Firestore Rules**: `/firestore.rules`
- **Console Errors**: Check browser console for detailed logs
- **Firebase Console**: https://console.firebase.google.com

---

**Last Updated:** 2025-10-01
