# Conflict Resolution Policies - moshimoshi PWA
## Agent 3 - Data & Sync Documentation

### Overview

This document defines the conflict resolution strategies used when synchronizing data between local IndexedDB storage and Firebase Cloud Storage. These policies ensure data consistency and prevent data loss in offline-first scenarios.

## Conflict Detection

Conflicts occur when:
1. **Offline Edits**: User modifies data offline, then syncs when online
2. **Multi-Device**: Same user edits data on different devices
3. **Concurrent Updates**: Multiple updates to the same entity
4. **Network Interruptions**: Partial sync completion

## Resolution Strategies

### 1. Last-Write-Wins (LWW)
**Used for**: `streaks`, `settings`

The version with the most recent `updatedAt` timestamp wins. Simple and deterministic.

```typescript
if (local.updatedAt > remote.updatedAt) {
  // Keep local version
  push(local);
} else {
  // Accept remote version
  save(remote);
}
```

**Rationale**:
- Settings are user preferences that should reflect latest choice
- Streaks are singular values that don't benefit from merging

### 2. Merge Strategy
**Used for**: `lists`, `items`

Combines non-conflicting changes from both versions.

```typescript
const merged = {
  ...remote,        // Start with remote
  ...local,         // Override with local
  updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  syncStatus: 'synced'
};
```

**Field-Level Merging**:
- **Title/Name**: Use most recent
- **Tags**: Union of both sets
- **Metadata**: Preserve both, prefer local
- **Deleted flags**: Deletion always wins

**Rationale**:
- Lists and items are additive collections
- Users expect both devices' additions to be preserved

### 3. Append Strategy
**Used for**: `reviewQueue.history`, `activity logs`

Arrays are combined chronologically, with deduplication.

```typescript
const combined = [...local.history, ...remote.history]
  .sort((a, b) => a.timestamp - b.timestamp)
  .filter((item, index, self) =>
    index === self.findIndex(t => t.timestamp === item.timestamp)
  );
```

**Rationale**:
- Review history is immutable log of events
- All activities from all devices should be preserved
- Chronological order maintains learning progression

## Special Cases

### Login Merge
When user logs in with existing cloud data:

1. **First Login on Device**: Cloud data takes precedence
2. **Re-login After Offline Use**: Local unsync'd changes are preserved
3. **Account Switch**: Complete data replacement

```typescript
if (mergeOnLogin && hasLocalUnsyncedData) {
  // Preserve local changes
  mergeWithPreferLocal(local, remote);
} else {
  // Fresh sync from cloud
  replaceLocal(remote);
}
```

### Deletion Conflicts
Deletion always wins to prevent zombie data:

```typescript
if (local.deleted || remote.deleted) {
  markAsDeleted();
  propagateDelete();
}
```

### Network Interruption Recovery
Partial syncs are detected and resumed:

```typescript
// Each sync operation has unique ID
if (syncOperation.incomplete) {
  resumeFromLastCheckpoint();
}
```

## Implementation Details

### Timestamp Management
- Use server timestamps when available
- Fallback to client time with offset correction
- Millisecond precision required

### Idempotency
All sync operations are idempotent:
```typescript
opId: `op_${timestamp}_${randomId}`
// Server ignores duplicate opIds
```

### Conflict Storage
Unresolvable conflicts are stored for manual resolution:

```typescript
interface ConflictItem {
  type: string;
  localVersion: any;
  remoteVersion: any;
  detectedAt: number;
  resolution?: 'local' | 'remote' | 'merge';
}
```

## User Experience

### Automatic Resolution
Most conflicts resolve automatically without user intervention:
- ✅ Settings changes
- ✅ Streak updates
- ✅ List additions
- ✅ Review history

### Manual Resolution Required
Rare cases requiring user input:
- ❓ Conflicting content edits
- ❓ Incompatible schema changes
- ❓ Corrupted data

### Notifications
Users are informed of:
- ⚡ Successful sync completion
- ⚠️ Conflicts requiring attention
- ❌ Permanent sync failures

## Testing

### Test Scenarios
1. **Offline → Online**: Queue operations, sync on reconnect
2. **Concurrent Edits**: Same item edited on 2 devices
3. **Clock Skew**: Devices with incorrect time
4. **Partial Sync**: Network interruption mid-sync
5. **Data Corruption**: Invalid data handling

### Test Commands
```bash
# Run sync tests
npm test -- sync.test.ts

# Test specific scenario
npm test -- sync.test.ts -t "conflict resolution"
```

## Monitoring

### Metrics Tracked
- Sync success rate
- Conflict frequency by type
- Resolution strategy effectiveness
- Average sync duration

### Debug Mode
Enable detailed logging:
```typescript
localStorage.setItem('debug:sync', 'true');
```

## Configuration

### Customizing Policies
```typescript
const syncConfig = {
  conflictPolicy: {
    lists: 'merge',        // or 'lww'
    items: 'merge',        // or 'lww'
    reviewQueue: 'append', // or 'lww'
    streaks: 'lww',       // recommended
    settings: 'lww'       // recommended
  }
};
```

### Sync Intervals
```typescript
const config = {
  enableAutoSync: true,
  syncInterval: 5 * 60 * 1000,  // 5 minutes
  retryDelay: 1000,             // 1 second base
  maxRetries: 5,
  circuitBreakerThreshold: 5
};
```

## Error Handling

### Retry Strategy
Exponential backoff with jitter:
```
Attempt 1: 1s
Attempt 2: 2s
Attempt 3: 4s
Attempt 4: 8s
Attempt 5: 16s (max: 30s)
```

### Circuit Breaker
After 5 consecutive failures:
1. Stop attempting sync
2. Wait 30 seconds
3. Reset and retry

### Dead Letter Queue
Permanently failed items are:
1. Removed from sync queue
2. Stored locally for inspection
3. User notified via toast

## Security Considerations

### Data Validation
- Schema validation before sync
- Sanitization of user input
- Size limits enforcement

### Authentication
- JWT tokens required for all sync operations
- Automatic token refresh
- Graceful handling of auth expiry

### Privacy
- No sensitive data in conflict logs
- User data encrypted in transit
- Local data cleared on account deletion

## Future Enhancements

### Planned Improvements
1. **CRDT Implementation**: For collaborative features
2. **Selective Sync**: Choose what to sync
3. **Compression**: Reduce bandwidth usage
4. **Differential Sync**: Only sync changes
5. **Conflict Preview**: Show before resolving

### Experimental Features
- Peer-to-peer sync via WebRTC
- Blockchain-based conflict resolution
- AI-powered merge strategies

## Support

### Troubleshooting
1. **Sync not working**: Check network, auth status
2. **Data missing**: Verify sync completed
3. **Conflicts frequent**: Check clock sync
4. **Performance slow**: Reduce sync frequency

### Contact
For sync issues, please provide:
- Device info
- Network conditions
- Error messages
- Debug logs (`localStorage.getItem('debug:sync')`)

---

*Last Updated: 2024*
*Version: 1.0*
*Agent: 3 - Data & Sync*