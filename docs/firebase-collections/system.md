# System Collections - Firebase Collections

## Overview
System-level collections for operational data, caching, logging, and administrative functions.

## Collections

### `tts_cache` (Top-Level)

**Description:** Cache for Text-to-Speech synthesis to reduce API costs and improve performance.

**Access:**
- 🔒 System-only (API routes)
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
{
  // Cache key (document ID is hash of text + voice + settings)
  text: string                        // Original text to synthesize
  hash: string                        // MD5 hash of cache key

  // TTS settings
  voice: string                       // Voice ID (e.g., "ja-JP-Neural2-B")
  provider: 'google' | 'elevenlabs'   // TTS provider
  settings: {
    rate?: number                     // Speech rate (0.25-4.0)
    pitch?: number                    // Voice pitch (-20 to 20)
    volume?: number                   // Volume gain (-96 to 16)
  }

  // Audio data
  audioUrl: string                    // Firebase Storage URL
  audioFormat: string                 // Format (e.g., "mp3", "wav")
  audioSize: number                   // File size in bytes
  duration: number                    // Audio duration in seconds

  // Usage tracking
  hitCount: number                    // Number of cache hits
  lastAccessed: Timestamp             // Last access time
  expiresAt: Timestamp                // Expiration time (90 days)

  // Metadata
  createdAt: Timestamp                // When cached
  createdBy?: string                  // User ID who created (optional)
}
```

**Example Document:**

```json
{
  "text": "こんにちは、世界",
  "hash": "5d41402abc4b2a76b9719d911017c592",
  "voice": "ja-JP-Neural2-B",
  "provider": "google",
  "settings": {
    "rate": 1.0,
    "pitch": 0,
    "volume": 0
  },
  "audioUrl": "https://storage.googleapis.com/tts-cache/abc123.mp3",
  "audioFormat": "mp3",
  "audioSize": 24576,
  "duration": 2.5,
  "hitCount": 45,
  "lastAccessed": "2025-10-03T14:30:00.000Z",
  "expiresAt": "2026-01-03T14:30:00.000Z",
  "createdAt": "2025-10-01T10:00:00.000Z"
}
```

**Firestore Path Example:**
```
tts_cache/5d41402abc4b2a76b9719d911017c592
```

---

### `admin_logs` (Top-Level)

**Description:** Audit log of all admin actions for security and compliance.

**Access:**
- 🔒 Admin-only
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
{
  // Action identification
  id: string                          // Auto-generated log ID
  action: string                      // Action type (e.g., "user.update", "content.publish")

  // Actor
  adminId: string                     // Admin user ID
  adminEmail: string                  // Admin email

  // Target
  targetType: 'user' | 'content' | 'system' | 'subscription'
  targetId?: string                   // Target entity ID
  targetEmail?: string                // Target email (for user actions)

  // Action details
  details: {
    before?: object                   // State before action
    after?: object                    // State after action
    changes?: object                  // Changed fields
    reason?: string                   // Reason for action
  }

  // Context
  ipAddress?: string                  // IP address of admin
  userAgent?: string                  // Browser user agent
  requestId?: string                  // Request trace ID

  // Status
  status: 'success' | 'failed' | 'partial'
  error?: string                      // Error message if failed

  // Timestamp
  timestamp: Timestamp                // When action occurred
}
```

**Example Document:**

```json
{
  "id": "log-abc123def456",
  "action": "user.subscription.upgrade",
  "adminId": "admin-user-123",
  "adminEmail": "admin@moshimoshi.app",
  "targetType": "user",
  "targetId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "targetEmail": "user@example.com",
  "details": {
    "before": {
      "plan": "free"
    },
    "after": {
      "plan": "premium_yearly"
    },
    "reason": "Customer support request - billing issue resolution"
  },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "status": "success",
  "timestamp": "2025-10-03T14:30:00.000Z"
}
```

**Firestore Path Example:**
```
admin_logs/log-abc123def456
```

---

### `idempotency_keys` (Top-Level)

**Description:** Stores idempotency keys to prevent duplicate operations (e.g., duplicate payments).

**Access:**
- 🔒 System-only
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
{
  // Idempotency key (document ID is the key)
  key: string                         // Unique idempotency key

  // Operation details
  operation: string                   // Operation type
  userId?: string                     // User ID (if applicable)
  status: 'processing' | 'completed' | 'failed'

  // Result
  result?: object                     // Operation result (if completed)
  error?: string                      // Error message (if failed)

  // Timing
  createdAt: Timestamp                // When key created
  completedAt?: Timestamp             // When operation completed
  expiresAt: Timestamp                // Expiration time (24 hours)
}
```

**Example Document:**

```json
{
  "key": "payment-8onZzlQg3tQxkw8pinSF9ow4Q6j2-1696350000000",
  "operation": "create_subscription",
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "status": "completed",
  "result": {
    "subscriptionId": "sub_ABC123",
    "plan": "premium_monthly"
  },
  "createdAt": "2025-10-03T14:30:00.000Z",
  "completedAt": "2025-10-03T14:30:05.123Z",
  "expiresAt": "2025-10-04T14:30:00.000Z"
}
```

**Firestore Path Example:**
```
idempotency_keys/payment-8onZzlQg3tQxkw8pinSF9ow4Q6j2-1696350000000
```

---

### `ops` (Top-Level)

**Description:** Operational data, feature flags, system configuration, and maintenance mode.

**Access:**
- 🔒 System/Admin-only
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
// Document ID: specific configuration type

{
  // Feature Flags (document ID: "feature_flags")
  features: {
    [featureId: string]: {
      enabled: boolean
      rolloutPercent: number          // 0-100 for gradual rollout
      allowedUsers?: string[]         // Whitelisted user IDs
      description: string
    }
  }

  // Maintenance Mode (document ID: "maintenance")
  maintenanceMode: {
    enabled: boolean
    startTime?: Timestamp
    estimatedEndTime?: Timestamp
    message: string
    allowedUsers?: string[]           // Admin users who can access
  }

  // System Config (document ID: "config")
  config: {
    maxConcurrentRequests: number
    rateLimitWindow: number           // milliseconds
    cacheExpiry: number               // seconds
    [key: string]: any
  }

  // Last updated
  updatedAt: Timestamp
  updatedBy: string                   // Admin ID
}
```

**Example Documents:**

**Feature Flags:**
```json
{
  "features": {
    "ai_story_generation": {
      "enabled": true,
      "rolloutPercent": 50,
      "description": "AI-powered story generation"
    },
    "voice_recording": {
      "enabled": false,
      "rolloutPercent": 0,
      "description": "Voice recording for pronunciation practice"
    },
    "beta_features": {
      "enabled": true,
      "rolloutPercent": 100,
      "allowedUsers": ["admin-user-123", "beta-tester-456"],
      "description": "Access to beta features"
    }
  },
  "updatedAt": "2025-10-03T14:30:00.000Z",
  "updatedBy": "admin-user-123"
}
```

**Maintenance Mode:**
```json
{
  "maintenanceMode": {
    "enabled": false,
    "startTime": null,
    "estimatedEndTime": null,
    "message": "System is currently available",
    "allowedUsers": ["admin-user-123"]
  },
  "updatedAt": "2025-10-03T14:30:00.000Z",
  "updatedBy": "admin-user-123"
}
```

**Firestore Path Examples:**
```
ops/feature_flags
ops/maintenance
ops/config
```

---

### `todos` (Top-Level)

**Description:** Simple todo list system (development/testing feature).

**Access:**
- ✅ Authenticated users (own todos only)
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
{
  // Todo item
  id: string                          // Auto-generated ID
  userId: string                      // Owner user ID
  text: string                        // Todo text
  completed: boolean                  // Completion status

  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Example Document:**

```json
{
  "id": "todo-abc123",
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "text": "Complete daily review session",
  "completed": false,
  "createdAt": "2025-10-03T09:00:00.000Z",
  "updatedAt": "2025-10-03T09:00:00.000Z"
}
```

**Firestore Path Example:**
```
todos/todo-abc123
```

*Note: This collection is used for development/testing and may be deprecated.*

---

### `youtube_series` (Top-Level)

**Description:** YouTube video series for language learning content.

**Access:**
- 🔒 Admin write
- 👁️ Public read
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
{
  // Series identification
  id: string                          // Auto-generated ID
  title: string                       // Series title
  channelId: string                   // YouTube channel ID
  playlistId?: string                 // YouTube playlist ID

  // Videos
  videos: Array<{
    videoId: string                   // YouTube video ID
    title: string                     // Video title
    description: string               // Video description
    thumbnailUrl: string              // Thumbnail URL
    duration: number                  // Duration in seconds
    publishedAt: string               // Publish date
    order: number                     // Order in series
  }>

  // Metadata
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: string                    // Category (e.g., "grammar", "conversation")
  tags: string[]                      // Tags

  // Stats
  stats: {
    totalVideos: number
    totalViews: number
    subscribers: number
  }

  // Sync
  lastSyncedAt: Timestamp             // Last YouTube sync
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Example Document:**

```json
{
  "id": "series-abc123",
  "title": "Beginner Japanese Conversation",
  "channelId": "UCxxxxxxxxxxxxxx",
  "playlistId": "PLyyyyyyyyyyyyyy",
  "videos": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Lesson 1: Greetings",
      "description": "Learn basic Japanese greetings...",
      "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "duration": 600,
      "publishedAt": "2025-09-01T10:00:00.000Z",
      "order": 1
    }
  ],
  "difficulty": "beginner",
  "category": "conversation",
  "tags": ["conversation", "beginner", "greetings"],
  "stats": {
    "totalVideos": 24,
    "totalViews": 45000,
    "subscribers": 1200
  },
  "lastSyncedAt": "2025-10-03T06:00:00.000Z",
  "createdAt": "2025-09-01T09:00:00.000Z",
  "updatedAt": "2025-10-03T06:00:00.000Z"
}
```

**Firestore Path Example:**
```
youtube_series/series-abc123
```

## API Endpoints

### TTS Cache

#### POST `/api/tts/synthesize`
Synthesize text to speech (with caching)

**Auth:** Required

**Request:**
```json
{
  "text": "こんにちは",
  "voice": "ja-JP-Neural2-B",
  "settings": {
    "rate": 1.0
  }
}
```

**Response:**
```json
{
  "audioUrl": "https://storage.googleapis.com/...",
  "duration": 2.5,
  "cached": true
}
```

**File:** `/src/app/api/tts/synthesize/route.ts`

---

#### GET `/api/tts/cache/stats` (Admin)
Get TTS cache statistics

**Auth:** Required (Admin)

**Response:**
```json
{
  "totalEntries": 1234,
  "totalSize": 567890123,
  "hitRate": 0.89,
  "avgHitsPerEntry": 12.5
}
```

**File:** `/src/app/api/tts/cache/stats/route.ts`

---

### Admin Logs

#### GET `/api/admin/logs` (Admin)
Get admin action logs

**Auth:** Required (Admin)

**Query Params:**
- `action` - Filter by action type
- `adminId` - Filter by admin
- `targetId` - Filter by target
- `startDate` - Start date
- `endDate` - End date
- `limit` - Results limit

**Response:**
```json
{
  "logs": [
    {
      "id": "...",
      "action": "...",
      "adminEmail": "...",
      "timestamp": "...",
      "status": "success"
    }
  ],
  "total": 567
}
```

**File:** `/src/app/api/admin/logs/route.ts`

---

### YouTube Series

#### GET `/api/youtube/series`
Get YouTube video series

**Response:**
```json
{
  "series": [
    {
      "id": "...",
      "title": "...",
      "difficulty": "beginner",
      "stats": {...},
      "videos": [...]
    }
  ]
}
```

**File:** `/src/app/api/youtube/series/route.ts`

---

#### POST `/api/admin/youtube-series/sync` (Admin)
Sync YouTube series from YouTube API

**Auth:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "synced": 5,
  "newVideos": 12
}
```

**File:** `/src/app/api/admin/youtube-series/sync/route.ts`

## Queries & Indexes

### Required Indexes

```
Collection: tts_cache
- expiresAt (asc) - For cleanup
- lastAccessed (asc) - For LRU eviction

Collection: admin_logs
- timestamp (desc)
- action (asc), timestamp (desc)
- adminId (asc), timestamp (desc)
- targetId (asc), timestamp (desc)

Collection: youtube_series
- difficulty (asc), createdAt (desc)
- category (asc), difficulty (asc)
```

## Cleanup & Maintenance

### TTS Cache Cleanup
- **Trigger:** Daily cron job
- **Logic:** Delete entries where `expiresAt < now`
- **Retention:** 90 days
- **LRU:** Evict least accessed if cache > 10GB

### Admin Logs Cleanup
- **Trigger:** Monthly cron job
- **Logic:** Archive logs older than 1 year
- **Retention:** 2 years in archive, then delete
- **Export:** Monthly export to Cloud Storage

### Idempotency Keys Cleanup
- **Trigger:** Hourly cron job
- **Logic:** Delete expired keys
- **Retention:** 24 hours

## Related Files

- TTS: `/src/app/api/tts/**`
- Admin: `/src/app/api/admin/**`
- Ops: `/src/lib/ops/feature-flags.ts`
- YouTube: `/src/app/api/youtube/**`

## Analytics Use Cases

1. **TTS Usage:** Track API costs, cache hit rate
2. **Admin Actions:** Audit compliance, security monitoring
3. **Feature Adoption:** Feature flag usage tracking
4. **Video Engagement:** YouTube series popularity
5. **System Health:** Monitor cache sizes, log volumes

## Security

- ✅ TTS cache: Public URLs with signed tokens
- ✅ Admin logs: Admin-only access
- ✅ Idempotency keys: System-only
- ✅ Ops config: Admin write, system read
- ✅ All operations logged for audit

## Performance Optimization

- **TTS Cache:** CDN distribution, gzip compression
- **Admin Logs:** Partitioned by month
- **Idempotency:** TTL index for auto-cleanup
- **Feature Flags:** Cached in memory for 1 minute
