# Troubleshooting Guide - MyLists Reliability Features

**Feature**: Diagnostic and Resolution Guide for Multi-Tab, Sync, and Quota Issues
**Priority**: CRITICAL - Support & Debugging
**Status**: READY

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Multi-Tab Issues](#multi-tab-issues)
3. [Sync Issues](#sync-issues)
4. [Storage Quota Issues](#storage-quota-issues)
5. [Browser-Specific Issues](#browser-specific-issues)
6. [Developer Debugging](#developer-debugging)
7. [User-Reported Issues](#user-reported-issues)
8. [Production Incidents](#production-incidents)
9. [FAQ for Support Team](#faq-for-support-team)

---

## Quick Diagnostics

### Health Check Commands

Open browser console and run:

```javascript
// Check feature flags
console.log('Feature Flags:', getMyListsFeatureFlags())

// Check IndexedDB status
const db = await indexedDB.databases()
console.log('IndexedDB:', db)

// Check quota status
const quota = await navigator.storage.estimate()
console.log('Storage:', {
  used: (quota.usage / 1024 / 1024).toFixed(1) + 'MB',
  total: (quota.quota / 1024 / 1024).toFixed(1) + 'MB',
  percent: ((quota.usage / quota.quota) * 100).toFixed(1) + '%'
})

// Check TabCoordinator status
console.log('Tab ID:', listManager.tabCoordinator?.getTabId())
console.log('Is Leader:', listManager.tabCoordinator?.isLeader())

// Check sync status
console.log('Sync Status:', listManager.getSyncStatus())

// Check BroadcastChannel support
console.log('BroadcastChannel:', typeof BroadcastChannel !== 'undefined')
```

### Issue Severity Matrix

| Symptom | Severity | Impact | Resolution Time |
|---------|----------|--------|-----------------|
| Data loss | CRITICAL | User data lost | Immediate |
| App crash | CRITICAL | App unusable | <1 hour |
| Sync not working | HIGH | Premium feature broken | <4 hours |
| Multi-tab out of sync | MEDIUM | Inconvenience | <1 day |
| Quota warning | LOW | No data loss yet | <1 week |

---

## Multi-Tab Issues

### Issue 1: Lists Don't Appear in Second Tab

**Symptom**: User creates list in Tab A, doesn't see it in Tab B

**Root Causes**:
1. BroadcastChannel not supported (old browser)
2. Feature flag disabled
3. IndexedDB version mismatch
4. Tab B hasn't refreshed

**Diagnostics**:
```javascript
// Check if BroadcastChannel supported
if (typeof BroadcastChannel === 'undefined') {
  console.error('BroadcastChannel not supported')
  // Expected: Should use localStorage fallback
}

// Check if TabCoordinator initialized
if (!listManager.tabCoordinator) {
  console.error('TabCoordinator not initialized')
  // Check feature flag
}

// Check for cross-tab messages
listManager.tabCoordinator?.onMessage((msg) => {
  console.log('Received message:', msg.type, msg.payload)
})
```

**Solutions**:
1. **Refresh Tab B**: Lists should appear after refresh
2. **Update Browser**: If using Safari <15.4, update to latest
3. **Enable Feature Flag**: Check `enableMultiTabCoordination=true`
4. **Clear Cache**: Clear browser cache and reload both tabs

**Prevention**:
- Add "Refresh page to see changes" message if BroadcastChannel unavailable
- Auto-poll IndexedDB every 30s as fallback

---

### Issue 2: Both Tabs Think They're Leader

**Symptom**: Debug panel shows "Leader" in multiple tabs

**Root Cause**: Race condition in leader election

**Diagnostics**:
```javascript
// Check leader status in all tabs
// Tab 1 console:
console.log('Tab 1 Leader:', listManager.tabCoordinator?.isLeader())

// Tab 2 console:
console.log('Tab 2 Leader:', listManager.tabCoordinator?.isLeader())

// Check heartbeat messages
listManager.tabCoordinator?.onMessage((msg) => {
  if (msg.type === 'heartbeat') {
    console.log('Heartbeat from:', msg.tabId)
  }
})
```

**Solutions**:
1. **Wait for Election**: Give it 10s for re-election to complete
2. **Compare Tab IDs**: Older tab (lower timestamp) should win
3. **Force Re-election**: Close one tab, remaining becomes leader
4. **Clear BroadcastChannel**: Close all tabs, open fresh one

**Prevention**:
- Increase `ELECTION_DELAY` to 200ms (currently 100ms)
- Add timestamp-based tie-breaking in leader election

---

### Issue 3: Leader Tab Closes, No New Leader Elected

**Symptom**: After closing leader tab, sync queue stops processing

**Root Cause**: Follower tab not detecting leader timeout

**Diagnostics**:
```javascript
// Check if monitoring heartbeat
console.log('Last heartbeat:', listManager.tabCoordinator?.lastLeaderHeartbeat)

// Check timeout detection
const timeSince = Date.now() - listManager.tabCoordinator?.lastLeaderHeartbeat
console.log('Time since heartbeat:', timeSince, 'ms')
console.log('Timeout threshold:', 10000, 'ms')

// Should auto-elect after 10s
```

**Solutions**:
1. **Wait 10-15 Seconds**: Timeout detection + election takes time
2. **Manual Refresh**: Refresh remaining tab to force re-election
3. **Close All Tabs**: Open fresh tab (becomes leader immediately)

**Prevention**:
- Log leader transitions clearly in console
- Add visual indicator of leader transitions

---

## Sync Issues

### Issue 4: Lists Not Syncing to Cloud (Premium Users)

**Symptom**: User creates list on phone, doesn't appear on laptop

**Root Causes**:
1. Not actually premium (subscription expired)
2. Offline when created (stuck in queue)
3. Circuit breaker open (repeated failures)
4. Firebase permissions error

**Diagnostics**:
```javascript
// Check premium status
const isPremium = await checkPremiumStatus()
console.log('Is Premium:', isPremium)

// Check sync queue
const db = await indexedDB.open('user-lists', 1)
const queue = await db.transaction('syncQueue').objectStore('syncQueue').getAll()
console.log('Sync Queue:', queue)

// Check circuit breaker
console.log('Circuit Breaker:', listManager.circuitBreaker)

// Check last error
console.log('Last Sync Error:', listManager.getSyncStatus().lastError)

// Check Firebase connection
fetch('/api/lists')
  .then(r => console.log('API Status:', r.status))
  .catch(e => console.error('API Error:', e))
```

**Solutions**:

**Case 1: Subscription Expired**
```
User Action: Renew Premium subscription
Developer: No action needed (working as designed)
```

**Case 2: Offline Queue**
```javascript
// Force sync manually
await listManager.forceSyncAll()

// Or wait for online event
window.addEventListener('online', () => {
  console.log('Back online, syncing...')
})
```

**Case 3: Circuit Breaker Open**
```javascript
// Check state
if (listManager.circuitBreaker.state === 'open') {
  console.log('Circuit breaker open, wait 30s')

  // Wait for cooldown
  setTimeout(async () => {
    await listManager.processSyncQueue()
  }, 30000)
}
```

**Case 4: Firebase Permissions**
```javascript
// Check Firebase rules
const userId = auth.currentUser?.uid
console.log('User ID:', userId)

// Test permissions
await fetch('/api/lists', {
  headers: { 'Authorization': `Bearer ${await auth.currentUser.getIdToken()}` }
})
```

---

### Issue 5: Sync Queue Growing Indefinitely

**Symptom**: Hundreds of items in sync queue, never clearing

**Root Cause**: API failures, never reaching max retries

**Diagnostics**:
```javascript
// Check queue size
const db = await indexedDB.open('user-lists', 1)
const queue = await db.transaction('syncQueue').objectStore('syncQueue').getAll()
console.log('Queue Size:', queue.length)

// Check retry counts
queue.forEach(item => {
  console.log(`${item.id}: ${item.retryCount} retries, next at ${new Date(item.nextRetryAt)}`)
})

// Check for errors
queue.forEach(item => {
  if (item.lastError) {
    console.error(`${item.id}: ${item.lastError}`)
  }
})
```

**Solutions**:

**Manual Queue Clear**:
```javascript
// Clear all failed items (>3 retries)
const db = await indexedDB.open('user-lists', 1)
const tx = db.transaction('syncQueue', 'readwrite')
const store = tx.objectStore('syncQueue')

const queue = await store.getAll()
for (const item of queue) {
  if (item.retryCount >= 3) {
    await store.delete(item.id)
    console.log('Deleted failed item:', item.id)
  }
}
```

**Force Retry**:
```javascript
// Reset retry counts and force sync
const queue = await store.getAll()
for (const item of queue) {
  item.retryCount = 0
  item.nextRetryAt = Date.now()
  await store.put(item)
}

await listManager.processSyncQueue()
```

---

### Issue 6: Circuit Breaker Stuck Open

**Symptom**: Circuit breaker never closes, even after server recovers

**Root Cause**: Not transitioning to half-open after timeout

**Diagnostics**:
```javascript
console.log('Circuit Breaker:', {
  state: listManager.circuitBreaker.state,
  failureCount: listManager.circuitBreaker.failureCount,
  lastFailureTime: new Date(listManager.circuitBreaker.lastFailureTime),
  timeSinceFailure: Date.now() - listManager.circuitBreaker.lastFailureTime
})

// Should transition to half-open after 30s
```

**Solutions**:
```javascript
// Manual reset
listManager.circuitBreaker = {
  state: 'closed',
  failureCount: 0,
  lastFailureTime: null
}

// Trigger sync
await listManager.processSyncQueue()
```

---

## Storage Quota Issues

### Issue 7: App Crashes with QuotaExceededError

**Symptom**: White screen, console shows `QuotaExceededError`

**Root Cause**: QuotaGuard not enabled or failing to catch error

**Diagnostics**:
```javascript
// Check quota
const quota = await navigator.storage.estimate()
console.log('Quota:', {
  used: quota.usage,
  total: quota.quota,
  percent: (quota.usage / quota.quota * 100).toFixed(1) + '%'
})

// Check if QuotaGuard enabled
console.log('QuotaGuard enabled:', getMyListsFeatureFlags().enableQuotaGuard)

// Check last operation
console.log('Last error:', listManager.getSyncStatus().lastError)
```

**Solutions**:

**Immediate**:
```javascript
// Clear browser storage
indexedDB.deleteDatabase('user-lists')
localStorage.clear()
sessionStorage.clear()

// Reload app
location.reload()
```

**Export Data First** (if possible):
```javascript
// Export lists before clearing
const db = await indexedDB.open('user-lists', 1)
const lists = await db.transaction('lists').objectStore('lists').getAll()

const exported = JSON.stringify(lists)
const blob = new Blob([exported], { type: 'application/json' })
const url = URL.createObjectURL(blob)

const a = document.createElement('a')
a.href = url
a.download = 'mylists-backup.json'
a.click()
```

**Prevention**:
- Enable `enableQuotaGuard` feature flag
- Show warning at 90% quota usage
- Auto-cleanup old sync queue items

---

### Issue 8: Storage Warning Shows Incorrectly

**Symptom**: Warning shows "90% full" but quota check says 20%

**Root Cause**: Cached quota status stale

**Diagnostics**:
```javascript
// Force fresh quota check
const quota = await navigator.storage.estimate()
console.log('Real quota:', (quota.usage / quota.quota * 100).toFixed(1) + '%')

// Check cached status
console.log('Cached status:', QuotaGuard.cachedStatus)

// Check cache time
console.log('Cache age:', Date.now() - QuotaGuard.cacheTime, 'ms')
```

**Solutions**:
```javascript
// Clear cache
QuotaGuard.cachedStatus = null
QuotaGuard.cacheTime = 0

// Force refresh
const status = await QuotaGuard.checkQuota()
console.log('Fresh status:', status.percentage)
```

---

## Browser-Specific Issues

### Safari Issues

**Issue 9: BroadcastChannel Not Available**

**Affected**: Safari <15.4

**Solution**:
- Uses localStorage fallback automatically
- Update to Safari 15.4+ for full support
- Or use Chrome/Firefox

**Workaround**:
```javascript
// Manually poll IndexedDB every 5s
setInterval(async () => {
  const lists = await listManager.getAllLists()
  // Update UI
}, 5000)
```

---

**Issue 10: IndexedDB Quota Lower**

**Affected**: Safari (all versions)

**Symptom**: Hits quota at ~500MB instead of 2GB

**Solution**:
- More aggressive cleanup suggestions
- Encourage export/import workflow
- Recommend cloud sync (Premium)

---

### Firefox Issues

**Issue 11: Private Mode Quota Restrictions**

**Affected**: Firefox Private Browsing

**Symptom**: Quota very low (~10MB), hits limit quickly

**Solution**:
```
User: "Your browser is in Private Mode, which limits storage.
Please use normal mode for full functionality."
```

---

### Mobile Browser Issues

**Issue 12: Background Tab Suspended**

**Affected**: iOS Safari, Chrome Mobile

**Symptom**: Sync stops when tab backgrounded

**Solution**:
- Sync resumes when tab focused
- Use Service Worker for background sync (future enhancement)

---

## Developer Debugging

### Enable Debug Logging

```javascript
// Enable verbose logging
localStorage.setItem('debug:mylists', 'true')
localStorage.setItem('debug:tabcoordinator', 'true')
localStorage.setItem('debug:sync', 'true')
localStorage.setItem('debug:quota', 'true')

// Reload to apply
location.reload()

// Output will show in console:
// [TabCoordinator] Became leader
// [ListManager] Processing sync queue (3 items)
// [QuotaGuard] Quota check: 45.2% used
```

### Inspect IndexedDB

**Chrome DevTools**:
1. F12 → Application → Storage → IndexedDB
2. Expand `user-lists` database
3. Inspect `lists` and `syncQueue` stores

**Firefox DevTools**:
1. F12 → Storage → IndexedDB
2. Expand `user-lists`

**Safari DevTools**:
1. Develop → Show Web Inspector → Storage → IndexedDB

### Network Request Debugging

```javascript
// Log all API calls
const originalFetch = window.fetch
window.fetch = function(...args) {
  console.log('[Fetch]', args[0])
  return originalFetch.apply(this, args)
    .then(r => {
      console.log('[Fetch] Response:', r.status, args[0])
      return r
    })
    .catch(e => {
      console.error('[Fetch] Error:', e, args[0])
      throw e
    })
}
```

### Performance Profiling

```javascript
// Profile sync operation
console.time('Sync Queue')
await listManager.processSyncQueue()
console.timeEnd('Sync Queue')

// Profile list creation
console.time('Create List')
await listManager.createList({ name: 'Test', type: 'word' })
console.timeEnd('Create List')

// Profile quota check
console.time('Quota Check')
await QuotaGuard.checkQuota()
console.timeEnd('Quota Check')
```

---

## User-Reported Issues

### Issue 13: "My lists disappeared!"

**Investigation Checklist**:
```
[ ] 1. Check if user cleared browser data
[ ] 2. Check if user is logged into correct account
[ ] 3. Check if user switched devices
[ ] 4. Check if user is premium (cloud backup)
[ ] 5. Check if lists in IndexedDB
[ ] 6. Check if lists in Firebase (premium)
[ ] 7. Check browser console for errors
```

**Resolution**:
- If in IndexedDB: User likely viewing wrong tab/account
- If in Firebase: Restore from cloud (premium)
- If nowhere: Data loss, apologize and offer recovery tips

---

### Issue 14: "Sync indicator stuck on 'Syncing...'"

**Root Cause**: Sync queue processing but not completing

**Investigation**:
```javascript
// Check queue
const status = listManager.getSyncStatus()
console.log('Pending:', status.pendingCount)
console.log('State:', status.syncState)

// Check if leader
console.log('Is Leader:', listManager.tabCoordinator?.isLeader())

// Check for errors
console.log('Last Error:', status.lastError)
```

**Resolution**:
- If pendingCount = 0: UI bug, refresh page
- If pendingCount > 0: Check circuit breaker, retry
- If not leader: Correct behavior (only leader syncs)

---

### Issue 15: "I got a 'storage full' error but I only have 3 lists"

**Root Cause**: Other sites using shared quota

**Explanation**:
```
"Your browser shares storage across all websites.
Other sites may be using your storage quota.

To free up space:
1. Clear data for sites you don't use
2. Use browser's 'Clear browsing data' feature
3. Check Chrome Settings → Site Settings → Storage"
```

**Diagnostic**:
```javascript
// Show storage usage by origin
navigator.storage.estimate().then(quota => {
  console.log('Total quota:', quota.quota)
  console.log('Used by all sites:', quota.usage)
  console.log('Moshimoshi usage:', quota.usageDetails?.indexedDB || 'N/A')
})
```

---

## Production Incidents

### Incident Response Playbook

**Phase 1: Detection (0-5 minutes)**
```
1. Alert received (PagerDuty, Sentry, user report)
2. Acknowledge incident
3. Create incident channel (#incident-YYYYMMDD)
4. Assign incident commander
```

**Phase 2: Investigation (5-15 minutes)**
```
1. Check error rate dashboard
2. Check recent deployments
3. Check feature flag changes
4. Identify affected users (count, segment)
5. Determine severity (Critical/High/Medium/Low)
```

**Phase 3: Mitigation (15-30 minutes)**
```
1. If critical: Rollback feature flags to 0%
2. If high: Reduce rollout percentage (50% → 10%)
3. If medium: Monitor and prepare fix
4. Post status update to users
```

**Phase 4: Resolution (30-120 minutes)**
```
1. Identify root cause
2. Deploy fix to staging
3. Test fix thoroughly
4. Deploy fix to production
5. Gradually re-enable features
6. Monitor for 24 hours
```

**Phase 5: Post-Mortem (1-3 days)**
```
1. Write incident report
2. Identify action items
3. Update runbooks
4. Share learnings with team
```

---

## FAQ for Support Team

### Q: User asks "Are my lists backed up?"

**A**:
```
Free users: Lists are saved locally in your browser only.
If you clear browser data, they will be lost.

Premium users: Lists are synced to the cloud and available
across all your devices. Even if you clear browser data,
they'll sync back from the cloud.
```

### Q: User asks "Why can't I create more lists?"

**A**:
```
Free users: Limited to 3 lists per month.
Upgrade to Premium for unlimited lists.

Premium users: Check if browser storage is full.
Try clearing old lists or browser cache.
```

### Q: User asks "Lists aren't syncing across tabs"

**A**:
```
1. Refresh both tabs
2. Make sure you're using a modern browser (Chrome, Firefox, Safari 15.4+)
3. Check the sync status indicator (bottom right)
4. If still not working, try clearing browser cache
```

### Q: User asks "I see a storage warning, what should I do?"

**A**:
```
Your browser storage is getting full. To free up space:

1. Delete old lists you don't need
2. Clear browser cache (Settings → Clear browsing data)
3. Upgrade to Premium for cloud storage (no local space needed)

Note: Export your lists first before deleting!
```

### Q: User asks "Can I recover deleted lists?"

**A**:
```
Free users: No, deleted lists cannot be recovered.

Premium users: We keep backups for 30 days.
Contact support with list name and approximate deletion date.
```

---

## Diagnostic Commands Reference

### Quick Health Check
```javascript
// One-line health check
console.log('Health:', {
  db: !!listManager.db,
  coordinator: !!listManager.tabCoordinator,
  isLeader: listManager.tabCoordinator?.isLeader(),
  syncState: listManager.getSyncStatus().syncState,
  quota: ((await navigator.storage.estimate()).usage / (await navigator.storage.estimate()).quota * 100).toFixed(1) + '%'
})
```

### Export All Data
```javascript
// Export everything for debugging
const diagnostic = {
  lists: await listManager.getAllLists(),
  syncQueue: await (await indexedDB.open('user-lists')).transaction('syncQueue').objectStore('syncQueue').getAll(),
  syncStatus: listManager.getSyncStatus(),
  quota: await navigator.storage.estimate(),
  featureFlags: getMyListsFeatureFlags(),
  browser: navigator.userAgent,
  timestamp: new Date().toISOString()
}

console.log(JSON.stringify(diagnostic, null, 2))
```

### Force Sync
```javascript
// Manually trigger sync (Premium only)
await listManager.forceSyncAll()
```

### Clear Everything (Nuclear Option)
```javascript
// Clear all MyLists data (WARNING: Cannot be undone)
await indexedDB.deleteDatabase('user-lists')
localStorage.removeItem('mylists-cache')
location.reload()
```

---

## Emergency Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Data Loss (Production) | `#emergency-oncall` | <15 minutes |
| App Down | `#engineering-alerts` | <30 minutes |
| High Error Rate | `#mylists-team` | <1 hour |
| User Question | `support@moshimoshi.app` | <24 hours |

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Author**: Claude (Sonnet 4.5)
**Status**: READY FOR SUPPORT
