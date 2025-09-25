# Multi-Agent Implementation Milestones
## Universal Review Engine with Pin & Practice System

### Overview
This document breaks down the implementation into 5 milestones that can be executed by 7 specialized agents working in parallel. Total timeline: 3 weeks with proper parallelization.

---

## Milestone 1: Core SRS Algorithm
**Agent Role**: Algorithm Specialist  
**Duration**: 3-4 days  
**Dependencies**: None (can start immediately)

### Objectives
Implement a complete Spaced Repetition System (SRS) based on SM-2 algorithm that integrates with the existing ReviewableContent interface.

### Detailed Specifications

#### 1.1 Core Algorithm Module
**File**: `/src/lib/review-engine/srs/algorithm.ts`

```typescript
export interface SRSData {
  interval: number;          // Days until next review
  easeFactor: number;        // 1.3 to 2.5
  repetitions: number;       // Successful review count
  lastReviewedAt: Date | null;
  nextReviewAt: Date;
}

export interface ReviewResult {
  correct: boolean;
  responseTime: number;      // milliseconds
  confidence?: 1 | 2 | 3 | 4 | 5;
}

export class SRSAlgorithm {
  calculateNextReview(item: ReviewableContent & SRSData, result: ReviewResult): SRSData
  calculateInterval(easeFactor: number, repetitions: number): number
  calculateEaseFactor(previousEF: number, quality: number): number
  getQualityFromResult(result: ReviewResult): number
  adjustForResponseTime(interval: number, responseTime: number): number
}
```

#### 1.2 State Management
**File**: `/src/lib/review-engine/srs/state-manager.ts`

```typescript
export class SRSStateManager {
  // Track review states: new → learning → mastered
  updateItemState(item: ReviewableContent, result: ReviewResult): void
  getItemState(item: ReviewableContent): 'new' | 'learning' | 'mastered'
  shouldGraduate(item: ReviewableContent & SRSData): boolean
  shouldDemote(item: ReviewableContent & SRSData): boolean
}
```

#### 1.3 Difficulty Calculator
**File**: `/src/lib/review-engine/srs/difficulty.ts`

```typescript
export class DifficultyCalculator {
  calculateInitialDifficulty(content: ReviewableContent): number
  adjustDifficulty(current: number, performance: ReviewResult[]): number
  getDifficultyModifier(difficulty: number): number
}
```

#### 1.4 Testing Requirements
**File**: `/src/lib/review-engine/srs/__tests__/algorithm.test.ts`

- Test interval progression for correct answers
- Test streak reset on wrong answers
- Test ease factor adjustments
- Test state transitions (new → learning → mastered)
- Test edge cases (max interval, min ease factor)
- Performance benchmarks (< 10ms per calculation)

### Deliverables
1. Complete SRS algorithm implementation
2. State management system
3. 100% test coverage
4. Performance benchmarks
5. Integration with ReviewableContent interface

### Success Criteria
- [ ] Algorithm correctly implements SM-2 with modifications
- [ ] All state transitions work correctly
- [ ] Performance: < 10ms per review calculation
- [ ] Test coverage > 95%
- [ ] TypeScript strict mode compliant

---

## Milestone 2: Pinning System
**Agent Role**: Frontend Feature Developer  
**Duration**: 4-5 days  
**Dependencies**: None (can start immediately)

### Objectives
Create a complete pinning system allowing users to manually select content for review with bulk operations support.

### Detailed Specifications

#### 2.1 Pin Manager Service
**File**: `/src/lib/review-engine/pinning/pin-manager.ts`

```typescript
export interface PinOptions {
  priority?: 'low' | 'normal' | 'high';
  tags?: string[];
  setId?: string;
  releaseSchedule?: 'immediate' | 'gradual';
  dailyLimit?: number;
}

export class PinManager {
  async pin(userId: string, contentId: string, options?: PinOptions): Promise<void>
  async pinBulk(userId: string, contentIds: string[], options?: PinOptions): Promise<void>
  async unpin(userId: string, contentId: string): Promise<void>
  async unpinBulk(userId: string, contentIds: string[]): Promise<void>
  async getPinnedItems(userId: string): Promise<PinnedItem[]>
  async isPinned(userId: string, contentId: string): Promise<boolean>
  async applyGradualRelease(items: PinnedItem[], dailyLimit: number): Promise<void>
}
```

#### 2.2 Pin Button Component
**File**: `/src/components/review/PinButton.tsx`

```typescript
interface PinButtonProps {
  contentType: ContentType;
  contentId: string;
  contentData?: {
    primary: string;
    meaning?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  variant?: 'icon' | 'button' | 'toggle';
  onPinChange?: (isPinned: boolean) => void;
}

// Features to implement:
// - Optimistic UI updates
// - Loading states
// - Error handling with retry
// - Offline support (queue action)
// - Animation on state change
// - Keyboard accessibility (Space/Enter to toggle)
```

#### 2.3 Bulk Selection Interface
**File**: `/src/components/review/BulkSelector.tsx`

```typescript
interface BulkSelectorProps {
  items: ReviewableContent[];
  onSelectionChange: (selected: Set<string>) => void;
  maxSelection?: number;
  layout?: 'grid' | 'list';
  selectionMode?: 'single' | 'multiple' | 'range';
}

// Features to implement:
// - Select all/none/invert
// - Range selection (Shift+Click)
// - Visual feedback for selection
// - Selection counter
// - Floating action bar
// - Keyboard navigation (arrows + space)
// - Touch-friendly for mobile
```

#### 2.4 Pin State Store
**File**: `/src/stores/pin-store.ts`

```typescript
// Using Zustand or Context API
interface PinStore {
  pinnedItems: Map<string, PinnedItem>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadPinnedItems: (userId: string) => Promise<void>;
  pinItem: (contentId: string, options?: PinOptions) => Promise<void>;
  unpinItem: (contentId: string) => Promise<void>;
  pinBulk: (contentIds: string[], options?: PinOptions) => Promise<void>;
  unpinBulk: (contentIds: string[]) => Promise<void>;
  clearError: () => void;
}
```

#### 2.5 Gradual Release Scheduler
**File**: `/src/lib/review-engine/pinning/release-scheduler.ts`

```typescript
export class ReleaseScheduler {
  scheduleGradualRelease(items: PinnedItem[], dailyLimit: number): ReleaseSchedule[]
  calculateReleaseDate(index: number, dailyLimit: number): Date
  getItemsForToday(schedule: ReleaseSchedule[]): PinnedItem[]
}
```

### Deliverables
1. PinManager service with all operations
2. PinButton component with animations
3. BulkSelector with keyboard/touch support
4. State management solution
5. Gradual release system
6. Offline support with sync queue

### Success Criteria
- [ ] Pin/unpin works instantly (optimistic UI)
- [ ] Bulk operations handle 1000+ items smoothly
- [ ] Offline actions sync when online
- [ ] Gradual release correctly spaces items
- [ ] Accessibility: WCAG 2.1 AA compliant

---

## Milestone 3A: Database Infrastructure
**Agent Role**: Database Specialist  
**Duration**: 5 days  
**Dependencies**: None (can start immediately)

### Objectives
Design and implement complete Firestore schema with security rules and data access layer.

### Detailed Specifications

#### 3.1 Firestore Collections Schema
**File**: `/src/lib/firebase/schema/review-collections.ts`

```typescript
// Collection: review_items
interface ReviewItemDocument {
  id: string;                    // Auto-generated
  userId: string;                // User reference
  
  // Content reference
  contentType: ContentType;
  contentId: string;
  contentData: {                 // Denormalized for performance
    primary: string;
    secondary?: string;
    tertiary?: string;
    audioUrl?: string;
    imageUrl?: string;
  };
  
  // Review data
  status: 'new' | 'learning' | 'mastered';
  srsData: {
    interval: number;
    easeFactor: number;
    repetitions: number;
    lastReviewedAt: Timestamp | null;
    nextReviewAt: Timestamp;
  };
  
  // Statistics
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  streak: number;
  bestStreak: number;
  
  // Organization
  tags: string[];
  setIds: string[];
  priority: 'low' | 'normal' | 'high';
  
  // Metadata
  pinnedAt: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;              // For optimistic locking
}

// Collection: review_sets
interface ReviewSetDocument {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: 'official' | 'custom' | 'shared';
  
  // Content
  itemIds: string[];
  itemCount: number;            // Denormalized
  contentTypes: ContentType[];
  
  // Sharing
  isPublic: boolean;
  sharedWith: string[];
  originalSetId?: string;
  
  // Progress (denormalized)
  progress: {
    new: number;
    learning: number;
    mastered: number;
  };
  
  // Settings
  dailyNewLimit: number;
  reviewOrder: 'sequential' | 'random' | 'difficulty';
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessedAt: Timestamp;
}

// Collection: review_sessions
interface ReviewSessionDocument {
  id: string;
  userId: string;
  
  // Session info
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  duration: number;              // seconds
  
  // Items reviewed
  itemsReviewed: Array<{
    itemId: string;
    correct: boolean;
    responseTime: number;
    attemptCount: number;
  }>;
  
  // Statistics
  totalItems: number;
  correctItems: number;
  incorrectItems: number;
  accuracy: number;
  avgResponseTime: number;
  
  // Context
  sessionType: 'daily' | 'quick' | 'custom' | 'test';
  setId?: string;
  deviceType: 'web' | 'mobile' | 'tablet';
  isCompleted: boolean;
}
```

#### 3.2 Data Access Layer
**File**: `/src/lib/firebase/dao/review-dao.ts`

```typescript
export class ReviewItemDAO {
  async create(item: Omit<ReviewItemDocument, 'id'>): Promise<string>
  async update(id: string, updates: Partial<ReviewItemDocument>): Promise<void>
  async delete(id: string): Promise<void>
  async get(id: string): Promise<ReviewItemDocument | null>
  async getByUser(userId: string): Promise<ReviewItemDocument[]>
  async getDueItems(userId: string, before: Date): Promise<ReviewItemDocument[]>
  async bulkCreate(items: ReviewItemDocument[]): Promise<void>
  async bulkUpdate(updates: Map<string, Partial<ReviewItemDocument>>): Promise<void>
}

export class ReviewSetDAO {
  async create(set: Omit<ReviewSetDocument, 'id'>): Promise<string>
  async update(id: string, updates: Partial<ReviewSetDocument>): Promise<void>
  async delete(id: string): Promise<void>
  async get(id: string): Promise<ReviewSetDocument | null>
  async getByUser(userId: string): Promise<ReviewSetDocument[]>
  async getPublicSets(): Promise<ReviewSetDocument[]>
  async addItems(setId: string, itemIds: string[]): Promise<void>
  async removeItems(setId: string, itemIds: string[]): Promise<void>
}
```

#### 3.3 Security Rules
**File**: `/firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Review items - users can only access their own
    match /review_items/{itemId} {
      allow read: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.userId &&
        request.resource.data.keys().hasAll(['userId', 'contentType', 'contentId']);
      
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.userId &&
        request.resource.data.version == resource.data.version + 1;
      
      allow delete: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Review sets - handle sharing
    match /review_sets/{setId} {
      allow read: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        resource.data.isPublic == true ||
        request.auth.uid in resource.data.sharedWith
      );
      
      allow write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

#### 3.4 Migration Scripts
**File**: `/scripts/migrate-review-data.ts`

```typescript
export class ReviewDataMigration {
  async migrateFromOldSchema(): Promise<void>
  async createDefaultSets(): Promise<void>
  async backfillSRSData(): Promise<void>
  async cleanupOrphanedItems(): Promise<void>
}
```

#### 3.5 Composite Indexes
**File**: `/firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "review_items",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "srsData.nextReviewAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "review_items",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### Deliverables
1. Complete Firestore schema
2. Data Access Layer with all CRUD operations
3. Security rules with tests
4. Migration scripts
5. Composite indexes
6. Backup/restore procedures

### Success Criteria
- [ ] All CRUD operations work correctly
- [ ] Security rules pass all tests
- [ ] Queries perform < 100ms
- [ ] Batch operations handle 500+ items
- [ ] Version control prevents conflicts

---

## Milestone 3B: Caching Infrastructure
**Agent Role**: Caching Specialist  
**Duration**: 5 days  
**Dependencies**: Milestone 3A (can start after schema is defined)

### Objectives
Implement high-performance caching layer with Redis/Upstash for optimal response times.

### Detailed Specifications

#### 3.1 Redis Client Setup
**File**: `/src/lib/redis/client.ts`

```typescript
import { Redis } from '@upstash/redis';

export class RedisClient {
  private static instance: Redis;
  
  static getInstance(): Redis
  static async healthCheck(): Promise<boolean>
  static async flushPattern(pattern: string): Promise<void>
}

export class CacheKeyBuilder {
  static reviewQueue(userId: string): string
  static userStats(userId: string): string
  static sessionProgress(sessionId: string): string
  static pinnedItems(userId: string): string
  static content(type: string, id: string): string
  static rateLimit(userId: string, action: string): string
}
```

#### 3.2 Review Queue Cache
**File**: `/src/lib/redis/caches/queue-cache.ts`

```typescript
export class QueueCache {
  async set(userId: string, items: ReviewItemDocument[]): Promise<void>
  async get(userId: string, limit?: number): Promise<ReviewItemDocument[] | null>
  async addItem(userId: string, item: ReviewItemDocument): Promise<void>
  async removeItem(userId: string, itemId: string): Promise<void>
  async getDueCount(userId: string): Promise<number>
  async invalidate(userId: string): Promise<void>
  
  // Use sorted sets for efficient due-date ordering
  private async updateSortedSet(userId: string, items: ReviewItemDocument[]): Promise<void>
}
```

#### 3.3 Statistics Cache
**File**: `/src/lib/redis/caches/stats-cache.ts`

```typescript
export interface CachedStatistics {
  totalPinned: number;
  newItems: number;
  learningItems: number;
  masteredItems: number;
  dueToday: number;
  streak: number;
  lastReview: string;
  accuracy7d: number;
}

export class StatsCache {
  async set(userId: string, stats: CachedStatistics): Promise<void>
  async get(userId: string): Promise<CachedStatistics | null>
  async increment(userId: string, field: keyof CachedStatistics, value: number): Promise<void>
  async updateStreak(userId: string, streak: number): Promise<void>
  async invalidate(userId: string): Promise<void>
}
```

#### 3.4 Content Cache
**File**: `/src/lib/redis/caches/content-cache.ts`

```typescript
export class ContentCache {
  async set(type: string, id: string, content: any, ttl?: number): Promise<void>
  async get(type: string, id: string): Promise<any | null>
  async mget(items: Array<{type: string, id: string}>): Promise<any[]>
  async invalidate(type: string, id: string): Promise<void>
  async warmup(items: Array<{type: string, id: string, content: any}>): Promise<void>
}
```

#### 3.5 Cache Invalidation Strategy
**File**: `/src/lib/redis/invalidation/invalidator.ts`

```typescript
export class CacheInvalidator {
  // Invalidation triggers
  async onItemPinned(userId: string, itemId: string): Promise<void>
  async onItemUnpinned(userId: string, itemId: string): Promise<void>
  async onItemReviewed(userId: string, itemId: string): Promise<void>
  async onSessionComplete(userId: string, sessionId: string): Promise<void>
  async onSettingsChanged(userId: string): Promise<void>
  
  // Bulk invalidation
  async invalidateUser(userId: string): Promise<void>
  async invalidatePattern(pattern: string): Promise<void>
  
  // Smart invalidation with dependencies
  private getDependentKeys(key: string): string[]
}
```

#### 3.6 Cache Warming
**File**: `/src/lib/redis/warming/warmer.ts`

```typescript
export class CacheWarmer {
  async warmUserCache(userId: string): Promise<void>
  async warmQueueCache(userId: string): Promise<void>
  async warmContentCache(contentIds: string[]): Promise<void>
  
  // Scheduled warming
  async scheduleWarmup(schedule: CronSchedule): Promise<void>
  async warmActiveUsers(): Promise<void>
  async preWarmTomorrowQueues(): Promise<void>
}
```

#### 3.7 Performance Monitoring
**File**: `/src/lib/redis/monitoring/monitor.ts`

```typescript
export class CacheMonitor {
  async getMetrics(): Promise<CacheMetrics>
  async getHitRate(window?: number): Promise<number>
  async getLatency(): Promise<LatencyMetrics>
  async getMemoryUsage(): Promise<MemoryMetrics>
  
  // Alerting
  async checkHealth(): Promise<HealthStatus>
  async reportSlowOperation(op: string, duration: number): Promise<void>
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgLatency: number;
  memoryUsage: number;
  keyCount: number;
}
```

### Deliverables
1. Redis client with connection pooling
2. All cache implementations
3. Invalidation strategy
4. Cache warming system
5. Performance monitoring
6. Documentation on cache keys

### Success Criteria
- [ ] Cache hit rate > 95% for hot data
- [ ] Response time < 10ms for cached data
- [ ] Automatic invalidation works correctly
- [ ] Memory usage < 100MB per 1000 users
- [ ] Monitoring dashboard available

---

## Milestone 4: API Layer
**Agent Role**: Backend API Developer  
**Duration**: 5-7 days  
**Dependencies**: Milestones 3A and 3B

### Objectives
Create comprehensive REST API with authentication, rate limiting, and error handling.

### Detailed Specifications

#### 4.1 Pin Management Endpoints
**File**: `/src/app/api/review/pin/route.ts`

```typescript
// POST /api/review/pin
export async function POST(request: Request) {
  // Single pin
  // Body: { contentType, contentId, tags?, priority? }
  // Returns: { success, itemsAdded, reviewItems[], stats }
}

// DELETE /api/review/pin
export async function DELETE(request: Request) {
  // Unpin
  // Body: { itemIds: string[] }
  // Returns: { success, itemsRemoved, stats }
}

// POST /api/review/pin/bulk
export async function POST(request: Request) {
  // Bulk pin
  // Body: { items[], tags?, priority?, releaseSchedule? }
  // Returns: { success, itemsAdded, reviewItems[], stats }
}

// GET /api/review/pin/check
export async function GET(request: Request) {
  // Check if pinned
  // Query: ?contentType=x&contentIds=id1,id2
  // Returns: { pinned: { [id]: boolean } }
}
```

#### 4.2 Review Queue Endpoints
**File**: `/src/app/api/review/queue/route.ts`

```typescript
// GET /api/review/queue
export async function GET(request: Request) {
  // Get review queue
  // Query: ?limit=20&type=daily&contentType=kana
  // Returns: { items[], stats, nextReviewIn }
}

// POST /api/review/queue/custom
export async function POST(request: Request) {
  // Create custom queue
  // Body: { filters, limit, order }
  // Returns: { items[], stats }
}

// GET /api/review/queue/preview
export async function GET(request: Request) {
  // Preview what's coming
  // Query: ?days=7
  // Returns: { schedule: { [date]: count } }
}
```

#### 4.3 Session Management Endpoints
**File**: `/src/app/api/review/session/route.ts`

```typescript
// POST /api/review/session/start
export async function POST(request: Request) {
  // Start session
  // Body: { type, itemIds, settings }
  // Returns: { sessionId, items[], totalItems, estimatedTime }
}

// POST /api/review/session/[sessionId]/answer
export async function POST(request: Request, { params }) {
  // Submit answer
  // Body: { itemId, correct, responseTime, answerType, confidence? }
  // Returns: { processed, itemUpdate, sessionProgress }
}

// POST /api/review/session/[sessionId]/complete
export async function POST(request: Request, { params }) {
  // Complete session
  // Body: { feedback?, rating? }
  // Returns: { summary, achievements?, nextReviewTime }
}

// GET /api/review/session/[sessionId]
export async function GET(request: Request, { params }) {
  // Get session state
  // Returns: { session, progress, currentItem }
}

// POST /api/review/session/[sessionId]/pause
export async function POST(request: Request, { params }) {
  // Pause session
  // Returns: { saved, canResume }
}
```

#### 4.4 Statistics Endpoints
**File**: `/src/app/api/review/stats/route.ts`

```typescript
// GET /api/review/stats
export async function GET(request: Request) {
  // Get user statistics
  // Query: ?period=week&detailed=true
  // Returns: { overview, current, streaks, byContentType?, recentActivity? }
}

// GET /api/review/stats/heatmap
export async function GET(request: Request) {
  // Get heatmap data
  // Query: ?days=365
  // Returns: { data: Array<{date, count, level}> }
}

// GET /api/review/stats/progress
export async function GET(request: Request) {
  // Get progress over time
  // Query: ?contentType=kanji&days=30
  // Returns: { progress: Array<{date, new, learning, mastered}> }
}
```

#### 4.5 Review Sets Endpoints
**File**: `/src/app/api/review/sets/route.ts`

```typescript
// GET /api/review/sets
export async function GET(request: Request) {
  // Get user's sets
  // Query: ?category=custom&includeProgress=true
  // Returns: { sets[] }
}

// POST /api/review/sets
export async function POST(request: Request) {
  // Create set
  // Body: { name, description, itemIds?, contentFilters?, settings }
  // Returns: { setId, set }
}

// PUT /api/review/sets/[setId]
export async function PUT(request: Request, { params }) {
  // Update set
  // Body: { name?, description?, settings? }
  // Returns: { updated }
}

// POST /api/review/sets/[setId]/items
export async function POST(request: Request, { params }) {
  // Add items to set
  // Body: { itemIds?, contentIds? }
  // Returns: { added, total }
}

// DELETE /api/review/sets/[setId]/items
export async function DELETE(request: Request, { params }) {
  // Remove items from set
  // Body: { itemIds }
  // Returns: { removed, remaining }
}

// POST /api/review/sets/preset
export async function POST(request: Request) {
  // Add preset set
  // Body: { presetId }
  // Returns: { setId, itemsAdded }
}
```

#### 4.6 Middleware & Utilities
**File**: `/src/app/api/review/_middleware.ts`

```typescript
// Authentication middleware
export async function authenticate(request: Request): Promise<User | null>

// Rate limiting
export async function rateLimit(userId: string, action: string): Promise<boolean>

// Request validation
export async function validateRequest(schema: ZodSchema, data: any): Promise<void>

// Error handling
export function handleApiError(error: any): Response

// CORS headers
export function setCorsHeaders(response: Response): Response
```

#### 4.7 API Documentation
**File**: `/src/app/api/review/docs/route.ts`

```typescript
// GET /api/review/docs
// Returns OpenAPI/Swagger documentation
export async function GET() {
  return Response.json(openApiSpec);
}
```

### Deliverables
1. All API endpoints implemented
2. Authentication middleware
3. Rate limiting per endpoint
4. Request validation with Zod
5. Error handling with proper codes
6. OpenAPI documentation
7. Postman collection

### Success Criteria
- [ ] All endpoints return < 200ms
- [ ] Rate limiting prevents abuse
- [ ] Proper HTTP status codes
- [ ] Comprehensive error messages
- [ ] 100% endpoint test coverage
- [ ] OpenAPI spec validated

---

## Milestone 5A: Review Dashboard UI
**Agent Role**: UI/UX Developer  
**Duration**: 5 days  
**Dependencies**: Milestone 4 (API layer)

### Objectives
Build complete review dashboard with statistics, queue management, and progress visualization.

### Detailed Specifications

#### 5.1 Dashboard Layout
**File**: `/src/app/review/page.tsx`

```typescript
export default function ReviewDashboard() {
  // Main dashboard with responsive grid layout
  // - Header with streak and daily goal
  // - Stats overview cards
  // - Review queue section
  // - Quick actions
  // - Recent activity
  // - Progress charts
}

// Layout structure:
// Desktop: 3-column layout
// Tablet: 2-column layout
// Mobile: Single column with collapsible sections
```

#### 5.2 Stats Overview Cards
**File**: `/src/components/review/dashboard/StatsOverview.tsx`

```typescript
interface StatsCardProps {
  label: string;
  value: number | string;
  change?: number;
  icon: ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'purple';
  onClick?: () => void;
}

// Cards to implement:
// - Due Now (with urgency indicator)
// - New Items (with daily limit)
// - Learning Items (with progress bar)
// - Mastered Items (with celebration animation)
// - Today's Goal (with progress ring)
// - Current Streak (with flame animation)
```

#### 5.3 Review Queue Component
**File**: `/src/components/review/dashboard/ReviewQueue.tsx`

```typescript
interface ReviewQueueProps {
  items: ReviewItem[];
  onStartReview: (items: ReviewItem[]) => void;
  onItemClick: (item: ReviewItem) => void;
  viewMode: 'compact' | 'detailed' | 'cards';
}

// Features:
// - Virtual scrolling for performance
// - Grouping by content type
// - Filtering options
// - Sort by: due date, difficulty, type
// - Quick preview on hover
// - Swipe actions on mobile
// - Bulk selection mode
```

#### 5.4 Quick Actions Panel
**File**: `/src/components/review/dashboard/QuickActions.tsx`

```typescript
// Action buttons:
// - Start Daily Review (with item count)
// - Quick 5-Minute Session
// - Custom Review
// - Browse Review Sets
// - Add New Items
// - Review Settings

// Each action should have:
// - Icon + Label
// - Hover state with tooltip
// - Loading state
// - Disabled state with reason
// - Keyboard shortcut
```

#### 5.5 Recent Activity Timeline
**File**: `/src/components/review/dashboard/RecentActivity.tsx`

```typescript
interface ActivityItem {
  type: 'review' | 'pin' | 'achievement' | 'streak';
  timestamp: Date;
  data: any;
}

// Display format:
// - Timeline view with icons
// - Relative timestamps
// - Expandable details
// - Load more pagination
// - Filter by type
```

#### 5.6 Mobile-Optimized Views
**File**: `/src/components/review/dashboard/MobileDashboard.tsx`

```typescript
// Mobile-specific features:
// - Bottom tab navigation
// - Pull-to-refresh
// - Swipe between sections
// - Floating action button
// - Gesture controls
// - Compact stats view
```

### Deliverables
1. Responsive dashboard layout
2. All stats components
3. Review queue with virtual scrolling
4. Quick actions panel
5. Recent activity timeline
6. Mobile-optimized views
7. Loading and error states
8. Dark mode support

### Success Criteria
- [ ] Lighthouse performance > 90
- [ ] Works on all screen sizes
- [ ] Smooth animations (60fps)
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Loads in < 2 seconds

---

## Milestone 5B: Data Visualization & Gamification
**Agent Role**: Data Visualization Specialist  
**Duration**: 5 days  
**Dependencies**: Milestone 4 (API layer)

### Objectives
Create engaging visualizations and gamification elements to motivate users.

### Detailed Specifications

#### 5.1 Progress Heatmap
**File**: `/src/components/review/charts/ProgressHeatmap.tsx`

```typescript
interface HeatmapProps {
  data: Array<{
    date: string;
    count: number;
  }>;
  year?: number;
  colorScheme?: 'green' | 'blue' | 'purple';
  showTooltip?: boolean;
  onDayClick?: (date: string, count: number) => void;
}

// Features:
// - GitHub-style contribution graph
// - Color intensity based on review count
// - Hover tooltips with details
// - Click to see day's reviews
// - Month/year navigation
// - Export as image
// - Responsive sizing
```

#### 5.2 Learning Curve Chart
**File**: `/src/components/review/charts/LearningCurve.tsx`

```typescript
interface LearningCurveProps {
  data: Array<{
    date: string;
    new: number;
    learning: number;
    mastered: number;
  }>;
  period: 'week' | 'month' | 'year';
  showTrend?: boolean;
  animated?: boolean;
}

// Implementation:
// - Stacked area chart
// - Smooth transitions
// - Interactive legend
// - Zoom and pan
// - Export data as CSV
// - Trend line overlay
// - Milestone markers
```

#### 5.3 Progress Rings
**File**: `/src/components/review/charts/ProgressRing.tsx`

```typescript
interface ProgressRingProps {
  value: number;
  max: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  color?: string;
  animated?: boolean;
  showPercentage?: boolean;
}

// Features:
// - Animated fill on mount
// - Gradient colors
// - Center text/icon
// - Hover effects
// - Click to expand details
// - Milestone indicators
```

#### 5.4 Streak Display
**File**: `/src/components/review/gamification/StreakDisplay.tsx`

```typescript
interface StreakDisplayProps {
  currentStreak: number;
  bestStreak: number;
  lastReviewDate: Date;
  showCalendar?: boolean;
  animated?: boolean;
}

// Features:
// - Flame animation for active streaks
// - Freeze warning if about to lose
// - Calendar view of streak history
// - Share achievement button
// - Milestone celebrations (7, 30, 100 days)
// - Recovery tips if streak lost
```

#### 5.5 Achievement System
**File**: `/src/components/review/gamification/Achievements.tsx`

```typescript
interface Achievement {
  id: string;
  type: 'streak' | 'mastery' | 'speed' | 'accuracy' | 'milestone';
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
}

// Achievement types to implement:
// - First Review
// - 7-Day Streak
// - 30-Day Streak
// - 100 Items Mastered
// - Speed Demon (fast reviews)
// - Perfectionist (100% accuracy)
// - Night Owl (late night reviews)
// - Early Bird (morning reviews)
// - Completionist (finish all due)

// Features:
// - Trophy case display
// - Progress towards next achievement
// - Unlock animation
// - Share on social
// - Achievement notifications
```

#### 5.6 Level System
**File**: `/src/components/review/gamification/LevelSystem.tsx`

```typescript
interface LevelInfo {
  currentLevel: number;
  currentXP: number;
  requiredXP: number;
  title: string;
  badge: string;
}

// XP calculation:
// - Correct answer: +10 XP
// - Perfect session: +50 XP
// - Maintain streak: +5 XP/day
// - Master item: +25 XP

// Level titles (Japanese themed):
// 1-10: Beginner (初心者)
// 11-25: Student (学生)
// 26-50: Practitioner (実践者)
// 51-75: Expert (専門家)
// 76-99: Master (達人)
// 100: Sensei (先生)
```

#### 5.7 Leaderboard
**File**: `/src/components/review/gamification/Leaderboard.tsx`

```typescript
interface LeaderboardProps {
  type: 'global' | 'friends' | 'local';
  metric: 'streak' | 'mastered' | 'xp' | 'accuracy';
  period: 'day' | 'week' | 'month' | 'all';
}

// Features:
// - User ranking with avatar
// - Animated position changes
// - Filter by metric/period
// - Friend challenges
// - Opt-in/out privacy
```

### Deliverables
1. Interactive heatmap component
2. Learning curve visualization
3. Progress rings with animations
4. Streak display system
5. Achievement system with 20+ achievements
6. Level/XP system
7. Leaderboard component
8. Celebration animations

### Success Criteria
- [ ] All charts render < 100ms
- [ ] Smooth animations (60fps)
- [ ] Charts are responsive
- [ ] Data updates in real-time
- [ ] Accessible visualizations
- [ ] Works offline with cached data

---

## Implementation Timeline

### Week 1
- **Day 1-2**: All agents read specs, setup environments
- **Day 3-5**: 
  - M1: Core algorithm implementation
  - M2: Pin manager and components
  - M3A: Database schema design

### Week 2
- **Day 1-3**:
  - M1: Testing and integration
  - M2: Bulk operations and offline
  - M3A: DAL implementation
  - M3B: Cache setup (starts)
- **Day 4-5**:
  - M4: API endpoints (starts)
  - M3B: Cache implementation

### Week 3
- **Day 1-3**:
  - M4: Complete API layer
  - M5A: Dashboard UI (starts)
  - M5B: Visualizations (starts)
- **Day 4-5**:
  - M5A: Complete dashboard
  - M5B: Complete gamification
  - Integration testing

## Coordination Protocol

### Daily Sync Points
1. **Morning standup** (15 min): Progress updates
2. **Afternoon check** (5 min): Blocker identification
3. **EOD commit**: Push to feature branches

### Shared Resources
- **API contracts**: Must be finalized by Week 1 Day 5
- **Type definitions**: Shared TypeScript interfaces
- **Design tokens**: Consistent styling
- **Test data**: Shared fixtures

### Communication Channels
- **Slack/Discord**: Real-time communication
- **GitHub Issues**: Task tracking
- **PR Reviews**: Cross-agent code review
- **Wiki**: Documentation updates

## Definition of Done

### Per Milestone
- [ ] Code complete and pushed
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] PR approved by lead
- [ ] Deployed to staging

### Overall Project
- [ ] All milestones integrated
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] User acceptance testing
- [ ] Production deployment

## Risk Mitigation

### Technical Risks
1. **Integration conflicts**: Daily integration tests
2. **Performance issues**: Continuous profiling
3. **API changes**: Version everything
4. **Browser compatibility**: Test on all targets

### Process Risks
1. **Agent unavailability**: Document everything
2. **Scope creep**: Strict change control
3. **Timeline slip**: Daily progress tracking
4. **Quality issues**: Automated testing

---

This document provides everything needed for 7 specialized agents to work in parallel and deliver a production-ready review system in 3 weeks.