# Database Optimization Strategies for Review Engine

## Current Performance Issues

From performance baseline analysis:
- **Average query time: 85ms** (target: <50ms)
- **Queue generation: 420ms P95** (hitting DB directly)
- **Missing indexes** causing full collection scans
- **N+1 query problems** in session loading
- **No query batching** for related data

## Optimization Strategy Overview

### Priority 1: Add Composite Indexes (Immediate Impact)

#### Firestore Indexes Needed

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "review_items",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "srsData.nextReviewAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "review_items",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "isPinned", "order": "DESCENDING" },
        { "fieldPath": "priority", "order": "DESCENDING" },
        { "fieldPath": "pinnedAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "review_sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "review_items",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "contentType", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**Expected Impact**: 
- Reduce query time from 85ms to ~20ms
- Queue generation from 420ms to ~150ms

### Priority 2: Implement Query Batching

#### Current Problem: N+1 Queries
```typescript
// BAD: Current implementation
for (const itemId of session.itemIds) {
  const item = await firestore.collection('review_items').doc(itemId).get();
  items.push(item.data());
}
// Result: 20 items = 20 queries = 1700ms total
```

#### Solution: Batch Queries
```typescript
// GOOD: Optimized implementation
export class BatchedFirestoreClient {
  private batchSize = 10; // Firestore limit
  
  async batchGet(collection: string, ids: string[]): Promise<any[]> {
    const results: any[] = [];
    
    // Split into batches of 10
    for (let i = 0; i < ids.length; i += this.batchSize) {
      const batch = ids.slice(i, i + this.batchSize);
      
      const snapshot = await firestore
        .collection(collection)
        .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
        .get();
      
      snapshot.forEach(doc => results.push(doc.data()));
    }
    
    return results;
  }
  
  async batchWrite(operations: Array<{
    type: 'set' | 'update' | 'delete';
    path: string;
    data?: any;
  }>): Promise<void> {
    const batch = firestore.batch();
    
    for (const op of operations) {
      const ref = firestore.doc(op.path);
      
      switch (op.type) {
        case 'set':
          batch.set(ref, op.data);
          break;
        case 'update':
          batch.update(ref, op.data);
          break;
        case 'delete':
          batch.delete(ref);
          break;
      }
    }
    
    await batch.commit();
  }
}
```

**Expected Impact**:
- Session loading from 1700ms to 200ms
- Bulk operations 10x faster

### Priority 3: Implement Denormalization Strategy

#### Current: Normalized Data (Multiple Queries)
```typescript
// Need 3 queries to get full user data
const user = await firestore.collection('users').doc(userId).get();
const stats = await firestore.collection('statistics').doc(userId).get();
const progress = await firestore.collection('progress').doc(userId).get();
```

#### Optimized: Denormalized for Read Performance
```typescript
// Single document with all frequently accessed data
interface UserDocument {
  // Core user data
  id: string;
  email: string;
  username: string;
  
  // Denormalized statistics (updated async)
  stats: {
    totalReviews: number;
    currentStreak: number;
    lastReviewDate: Date;
    accuracy7d: number;
  };
  
  // Denormalized progress
  progress: {
    kana: { new: number; learning: number; mastered: number };
    kanji: { new: number; learning: number; mastered: number };
    vocabulary: { new: number; learning: number; mastered: number };
  };
  
  // Cache expiry
  statsUpdatedAt: Date;
  progressUpdatedAt: Date;
}
```

**Update Strategy**:
```typescript
export class DenormalizedDataManager {
  async updateUserStats(userId: string, newStats: any) {
    // Update main collection
    await firestore.collection('statistics').doc(userId).set(newStats);
    
    // Update denormalized data asynchronously
    await firestore.collection('users').doc(userId).update({
      'stats': newStats,
      'statsUpdatedAt': firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  
  async getUserWithStats(userId: string): Promise<UserDocument> {
    const user = await firestore.collection('users').doc(userId).get();
    const data = user.data() as UserDocument;
    
    // Check if denormalized data is stale (> 1 hour old)
    const statsAge = Date.now() - data.statsUpdatedAt.toMillis();
    if (statsAge > 3600000) {
      // Refresh in background
      this.refreshUserStats(userId);
    }
    
    return data;
  }
}
```

**Expected Impact**:
- User dashboard load from 3 queries to 1
- 66% reduction in database reads

### Priority 4: Implement Pagination & Cursor-Based Queries

#### Problem: Loading All Items at Once
```typescript
// BAD: Loading 1000+ items
const allItems = await firestore
  .collection('review_items')
  .where('userId', '==', userId)
  .get();
```

#### Solution: Cursor-Based Pagination
```typescript
export class PaginatedQuery {
  private pageSize = 20;
  
  async getReviewQueue(
    userId: string,
    cursor?: string
  ): Promise<{
    items: any[];
    nextCursor: string | null;
  }> {
    let query = firestore
      .collection('review_items')
      .where('userId', '==', userId)
      .where('status', 'in', ['new', 'learning'])
      .orderBy('srsData.nextReviewAt')
      .limit(this.pageSize);
    
    if (cursor) {
      const lastDoc = await firestore
        .collection('review_items')
        .doc(cursor)
        .get();
      query = query.startAfter(lastDoc);
    }
    
    const snapshot = await query.get();
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const nextCursor = snapshot.docs.length === this.pageSize
      ? snapshot.docs[snapshot.docs.length - 1].id
      : null;
    
    return { items, nextCursor };
  }
}
```

**Expected Impact**:
- Initial load from 2000ms to 200ms
- Memory usage reduced by 90%

### Priority 5: Implement Redis Cache Layer

#### Cache Strategy
```typescript
export class CachedDatabaseClient {
  private cache: Redis;
  private db: Firestore;
  
  async getReviewQueue(userId: string): Promise<any[]> {
    const cacheKey = `queue:${userId}`;
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      performanceMonitor.trackCacheHit();
      return JSON.parse(cached);
    }
    
    // Cache miss - query database
    performanceMonitor.trackCacheMiss();
    const items = await this.queryReviewQueue(userId);
    
    // Store in cache with TTL
    await this.cache.setex(
      cacheKey,
      300, // 5 minute TTL
      JSON.stringify(items)
    );
    
    return items;
  }
  
  async invalidateUserCache(userId: string) {
    const patterns = [
      `queue:${userId}`,
      `stats:${userId}`,
      `progress:${userId}`,
      `session:${userId}:*`
    ];
    
    for (const pattern of patterns) {
      const keys = await this.cache.keys(pattern);
      if (keys.length > 0) {
        await this.cache.del(...keys);
      }
    }
  }
}
```

**Cache Warming Strategy**:
```typescript
export class CacheWarmer {
  async warmActiveUsers() {
    // Get users active in last hour
    const activeUsers = await this.getActiveUsers(3600);
    
    // Warm caches in parallel (limited concurrency)
    const chunks = this.chunk(activeUsers, 10);
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(userId => this.warmUserCache(userId))
      );
    }
  }
  
  async warmUserCache(userId: string) {
    // Pre-fetch and cache common queries
    await Promise.all([
      this.cacheClient.getReviewQueue(userId),
      this.cacheClient.getUserStats(userId),
      this.cacheClient.getUserProgress(userId)
    ]);
  }
}
```

**Expected Impact**:
- Cache hit rate from 62% to 90%+
- Average response time from 85ms to 10ms for cached data

### Priority 6: Query Optimization Patterns

#### 1. Use Projections for Large Documents
```typescript
// Only fetch needed fields
const items = await firestore
  .collection('review_items')
  .where('userId', '==', userId)
  .select('id', 'contentType', 'status', 'srsData.nextReviewAt')
  .get();
```

#### 2. Aggregate in Database When Possible
```typescript
// Use Firestore aggregation queries (new feature)
const aggregation = await firestore
  .collection('review_items')
  .where('userId', '==', userId)
  .aggregate({
    totalCount: firebase.firestore.AggregateField.count(),
    learned: firebase.firestore.AggregateField.count()
      .where('status', '==', 'mastered'),
    learning: firebase.firestore.AggregateField.count()
      .where('status', '==', 'learning')
  })
  .get();
```

#### 3. Use Compound Queries Instead of Multiple Queries
```typescript
// Single query with multiple conditions
const items = await firestore
  .collection('review_items')
  .where('userId', '==', userId)
  .where('status', 'in', ['new', 'learning'])
  .where('srsData.nextReviewAt', '<=', new Date())
  .orderBy('priority', 'desc')
  .orderBy('srsData.nextReviewAt', 'asc')
  .limit(50)
  .get();
```

## Implementation Timeline

### Week 2, Day 4 (4 hours)
1. **Morning (2 hours)**:
   - Deploy composite indexes
   - Implement query batching
   - Test with load testing tools

2. **Afternoon (2 hours)**:
   - Implement pagination
   - Add Redis caching layer
   - Update monitoring

### Expected Results After Optimization

| Metric | Current | After Optimization | Improvement |
|--------|---------|-------------------|-------------|
| Avg Query Time | 85ms | 25ms | **70% faster** |
| Queue Load P95 | 420ms | 150ms | **64% faster** |
| Session Creation P95 | 1250ms | 400ms | **68% faster** |
| Cache Hit Rate | 62% | 90% | **45% increase** |
| DB Read Operations | 10,000/hour | 3,000/hour | **70% reduction** |
| Monthly Firestore Cost | $150 | $45 | **70% savings** |

## Monitoring Queries

```typescript
// Add query performance monitoring
export class QueryMonitor {
  async trackQuery(queryName: string, operation: () => Promise<any>) {
    const start = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      
      performanceMonitor.trackDatabaseQuery(queryName, duration);
      
      if (duration > 100) {
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      performanceMonitor.trackError('DatabaseQueryError');
      throw error;
    }
  }
}
```

## Rollback Plan

If optimizations cause issues:

1. **Indexes**: Can't be rolled back, but won't break existing queries
2. **Batching**: Feature flag to disable
3. **Caching**: Flush Redis and disable
4. **Denormalization**: Keep normalized data as source of truth

```typescript
// Feature flags for gradual rollout
const features = {
  USE_BATCH_QUERIES: process.env.ENABLE_BATCH_QUERIES === 'true',
  USE_REDIS_CACHE: process.env.ENABLE_REDIS_CACHE === 'true',
  USE_DENORMALIZED_DATA: process.env.ENABLE_DENORMALIZED === 'true'
};
```

---

*Database Optimization Strategy prepared by Agent 4 - Integration & Performance Lead*
*Ready for Week 2 Day 4 implementation*