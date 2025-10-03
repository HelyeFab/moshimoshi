# Blog and Resources - Firebase Collections

## Overview
Public and private content collections for blog posts, learning resources, and educational materials.

## Collections

### `blog` (Top-Level)

**Description:** Blog posts and articles for the Moshimoshi platform.

**Access:**
- 🔒 Admin write-only
- 👁️ Public read (published posts)
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
{
  // Post identification
  id: string                          // Auto-generated document ID
  slug: string                        // URL-friendly slug (unique)

  // Content
  title: string                       // Post title
  subtitle?: string                   // Optional subtitle
  content: string                     // Markdown content
  excerpt: string                     // Short summary (150 chars)

  // Metadata
  author: {
    id: string                        // Author user ID
    name: string                      // Author display name
    avatar?: string                   // Author avatar URL
  }

  // Categorization
  tags: string[]                      // Post tags (e.g., ["grammar", "n5"])
  category: 'tutorial' | 'news' | 'announcement' | 'guide' | 'culture'
  difficulty?: 'beginner' | 'intermediate' | 'advanced'

  // Media
  coverImage?: string                 // Cover image URL
  images?: string[]                   // Additional images in post

  // Publishing
  status: 'draft' | 'published' | 'archived'
  publishedAt?: Timestamp             // When published
  scheduledFor?: Timestamp            // Scheduled publish time

  // SEO
  seo: {
    metaTitle?: string                // SEO title (defaults to title)
    metaDescription?: string          // SEO description (defaults to excerpt)
    keywords?: string[]               // SEO keywords
  }

  // Engagement
  stats: {
    views: number                     // View count
    likes: number                     // Like count
    comments: number                  // Comment count
    shares: number                    // Share count
  }

  // Timestamps
  createdAt: Timestamp                // When created
  updatedAt: Timestamp                // Last update
}
```

**Example Document:**

```json
{
  "id": "abc123def456",
  "slug": "mastering-japanese-particles-wa-vs-ga",
  "title": "Mastering Japanese Particles: は vs. が",
  "subtitle": "Understanding the difference between wa and ga",
  "content": "# Introduction\n\nThe particles は (wa) and が (ga)...",
  "excerpt": "Learn the fundamental differences between wa and ga particles in Japanese grammar with practical examples.",
  "author": {
    "id": "admin-user-123",
    "name": "Moshimoshi Team",
    "avatar": "/avatars/team.png"
  },
  "tags": ["grammar", "particles", "beginner"],
  "category": "tutorial",
  "difficulty": "beginner",
  "coverImage": "/blog/particles-cover.jpg",
  "status": "published",
  "publishedAt": "2025-10-01T10:00:00.000Z",
  "seo": {
    "metaTitle": "Master は (wa) vs. が (ga) Particles | Japanese Grammar",
    "metaDescription": "Learn the fundamental differences...",
    "keywords": ["japanese particles", "wa vs ga", "japanese grammar"]
  },
  "stats": {
    "views": 1234,
    "likes": 89,
    "comments": 12,
    "shares": 45
  },
  "createdAt": "2025-09-28T14:00:00.000Z",
  "updatedAt": "2025-10-01T10:00:00.000Z"
}
```

**Firestore Path Example:**
```
blog/abc123def456
```

---

### `resources` (Top-Level)

**Description:** Educational resources, study materials, and downloadable content.

**Access:**
- 🔒 Admin write-only
- 👁️ Public read (published resources)
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
{
  // Resource identification
  id: string                          // Auto-generated document ID
  slug: string                        // URL-friendly slug

  // Content
  title: string                       // Resource title
  description: string                 // Detailed description
  type: 'pdf' | 'worksheet' | 'audio' | 'video' | 'interactive' | 'link'

  // Files
  files: Array<{
    name: string                      // File name
    url: string                       // Download/access URL
    size: number                      // File size in bytes
    format: string                    // File format (e.g., "pdf", "mp3")
  }>

  // Categorization
  category: 'grammar' | 'vocabulary' | 'kanji' | 'listening' | 'reading' | 'culture'
  tags: string[]                      // Resource tags
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

  // Access control
  accessLevel: 'free' | 'premium' | 'admin'
  isPremium: boolean                  // Quick premium check

  // Media
  thumbnail?: string                  // Thumbnail image
  previewImages?: string[]            // Preview images

  // Metadata
  author?: {
    id: string
    name: string
  }

  // Publishing
  status: 'draft' | 'published' | 'archived'
  publishedAt?: Timestamp

  // Engagement
  stats: {
    downloads: number                 // Download count
    views: number                     // View count
    rating: number                    // Average rating (0-5)
    ratingCount: number               // Number of ratings
  }

  // Related content
  relatedResources?: string[]         // Related resource IDs
  relatedBlogPosts?: string[]         // Related blog post IDs

  // Timestamps
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Example Document:**

```json
{
  "id": "resource-xyz789",
  "slug": "jlpt-n5-kanji-practice-sheet",
  "title": "JLPT N5 Kanji Practice Worksheet",
  "description": "Comprehensive practice sheet covering all 100 JLPT N5 kanji with stroke order diagrams and example sentences.",
  "type": "worksheet",
  "files": [
    {
      "name": "n5-kanji-worksheet.pdf",
      "url": "/resources/n5-kanji-worksheet.pdf",
      "size": 2457600,
      "format": "pdf"
    },
    {
      "name": "n5-kanji-answer-key.pdf",
      "url": "/resources/n5-kanji-answer-key.pdf",
      "size": 1024000,
      "format": "pdf"
    }
  ],
  "category": "kanji",
  "tags": ["jlpt", "n5", "practice", "worksheet"],
  "difficulty": "beginner",
  "jlptLevel": "N5",
  "accessLevel": "free",
  "isPremium": false,
  "thumbnail": "/resources/thumbnails/n5-kanji.jpg",
  "status": "published",
  "publishedAt": "2025-09-15T10:00:00.000Z",
  "stats": {
    "downloads": 567,
    "views": 1234,
    "rating": 4.7,
    "ratingCount": 89
  },
  "relatedResources": ["resource-abc123", "resource-def456"],
  "createdAt": "2025-09-10T14:00:00.000Z",
  "updatedAt": "2025-09-15T10:00:00.000Z"
}
```

**Firestore Path Example:**
```
resources/resource-xyz789
```

---

### `news` (Top-Level)

**Description:** Japanese news articles for reading practice with furigana and translations.

**Access:**
- 🔒 Admin/scraper write
- 👁️ Public read
- 📍 Location: Top-level collection

**Document Structure:**

```typescript
{
  // Article identification
  id: string                          // Auto-generated document ID
  url: string                         // Original article URL
  sourceId: string                    // Source identifier (e.g., "nhk_easy")

  // Content
  title: string                       // Article title
  titleFurigana?: string              // Title with furigana
  content: string                     // Article text
  contentFurigana?: string            // Content with furigana
  translation?: string                // English translation

  // Metadata
  category: string                    // News category
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedReadingTime: number        // Minutes

  // Media
  image?: string                      // Article image
  imageCaption?: string               // Image caption

  // Publishing
  publishedAt: Timestamp              // Original publish date
  scrapedAt: Timestamp                // When scraped
  lastUpdated: Timestamp              // Last update

  // Status
  status: 'active' | 'archived'       // Availability status
  featured: boolean                   // Featured article flag

  // Stats
  stats: {
    views: number
    completions: number               // Users who finished reading
  }
}
```

**Example Document:**

```json
{
  "id": "news-20251003-001",
  "url": "https://www3.nhk.or.jp/news/easy/...",
  "sourceId": "nhk_easy",
  "title": "新しい技術で車がもっと安全に",
  "titleFurigana": "新(あたら)しい技術(ぎじゅつ)で車(くるま)がもっと安全(あんぜん)に",
  "content": "新しい技術で、車の事故を...",
  "contentFurigana": "新(あたら)しい技術(ぎじゅつ)で...",
  "translation": "With new technology, cars become safer...",
  "category": "technology",
  "difficulty": "easy",
  "estimatedReadingTime": 5,
  "image": "/news/images/car-safety.jpg",
  "publishedAt": "2025-10-03T06:00:00.000Z",
  "scrapedAt": "2025-10-03T07:00:00.000Z",
  "lastUpdated": "2025-10-03T07:00:00.000Z",
  "status": "active",
  "featured": true,
  "stats": {
    "views": 456,
    "completions": 123
  }
}
```

**Firestore Path Example:**
```
news/news-20251003-001
```

## API Endpoints

### Blog

#### GET `/api/blog/public`
Get published blog posts (public)

**Query Params:**
- `limit` - Results limit (default: 20)
- `category` - Filter by category
- `tag` - Filter by tag
- `page` - Pagination

**Response:**
```json
{
  "posts": [
    {
      "id": "...",
      "slug": "...",
      "title": "...",
      "excerpt": "...",
      "coverImage": "...",
      "publishedAt": "...",
      "stats": {...}
    }
  ],
  "total": 45,
  "page": 1
}
```

**File:** `/src/app/api/blog/public/route.ts`

---

#### GET `/api/blog/slug/[slug]`
Get blog post by slug

**Response:**
```json
{
  "post": {
    "id": "...",
    "slug": "...",
    "title": "...",
    "content": "...",
    "author": {...},
    "tags": [...],
    "publishedAt": "..."
  }
}
```

**File:** `/src/app/api/blog/slug/[slug]/route.ts`

---

#### POST `/api/blog` (Admin)
Create new blog post

**Auth:** Required (Admin)

**Request:**
```json
{
  "title": "Post Title",
  "slug": "post-title",
  "content": "# Markdown content...",
  "excerpt": "Short summary",
  "category": "tutorial",
  "tags": ["grammar", "beginner"],
  "status": "draft"
}
```

**File:** `/src/app/api/blog/route.ts`

---

### Resources

#### GET `/api/resources/public`
Get public resources

**Query Params:**
- `category` - Filter by category
- `difficulty` - Filter by difficulty
- `jlptLevel` - Filter by JLPT level
- `accessLevel` - Filter by access (free/premium)

**Response:**
```json
{
  "resources": [
    {
      "id": "...",
      "title": "...",
      "type": "...",
      "category": "...",
      "isPremium": false,
      "thumbnail": "...",
      "stats": {...}
    }
  ]
}
```

**File:** `/src/app/api/resources/public/route.ts`

---

#### GET `/api/resources/[id]`
Get specific resource

**Response:**
```json
{
  "resource": {
    "id": "...",
    "title": "...",
    "description": "...",
    "files": [...],
    "relatedResources": [...]
  }
}
```

**File:** `/src/app/api/resources/[id]/route.ts`

---

#### GET `/api/resources/related`
Get related resources

**Query Params:**
- `resourceId` - Current resource ID
- `limit` - Results limit

**Response:**
```json
{
  "related": [
    {
      "id": "...",
      "title": "...",
      "type": "...",
      "thumbnail": "..."
    }
  ]
}
```

**File:** `/src/app/api/resources/related/route.ts`

---

### News

#### GET `/api/news/articles`
Get news articles

**Query Params:**
- `limit` - Results limit
- `difficulty` - Filter by difficulty
- `category` - Filter by category
- `featured` - Show only featured

**Response:**
```json
{
  "articles": [
    {
      "id": "...",
      "title": "...",
      "titleFurigana": "...",
      "difficulty": "easy",
      "image": "...",
      "publishedAt": "..."
    }
  ]
}
```

**File:** `/src/app/api/news/articles/route.ts`

---

#### GET `/api/news/article/[id]`
Get specific news article

**Response:**
```json
{
  "article": {
    "id": "...",
    "title": "...",
    "content": "...",
    "contentFurigana": "...",
    "translation": "...",
    "estimatedReadingTime": 5
  }
}
```

**File:** `/src/app/api/news/article/[id]/route.ts`

---

#### POST `/api/news/scrape` (Admin)
Trigger news scraping

**Auth:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "scraped": 15,
  "message": "Scraped 15 new articles"
}
```

**File:** `/src/app/api/news/scrape/route.ts`

## Queries & Indexes

### Required Indexes

```
Collection: blog
- status (asc), publishedAt (desc)
- category (asc), publishedAt (desc)
- tags (array-contains), publishedAt (desc)
- slug (asc) - Unique constraint

Collection: resources
- status (asc), publishedAt (desc)
- category (asc), difficulty (asc)
- accessLevel (asc), category (asc)
- isPremium (asc), publishedAt (desc)

Collection: news
- status (asc), publishedAt (desc)
- difficulty (asc), publishedAt (desc)
- featured (asc), publishedAt (desc)
```

## Related Files

- API Routes: `/src/app/api/blog/`, `/src/app/api/resources/`, `/src/app/api/news/`
- Admin Pages: `/src/app/admin/blog/`, `/src/app/admin/resources/`
- Public Pages: `/src/app/blog/`, `/src/app/resources/`, `/src/app/news/`

## Analytics Use Cases

1. **Content Performance:** Track views, engagement per post/resource
2. **Popular Topics:** Identify trending categories and tags
3. **User Journey:** Resource → Blog → Sign up conversion
4. **Download Patterns:** Premium vs. free resource downloads
5. **Reading Difficulty:** Match content to user levels

## Data Retention

- **Published content:** Retained indefinitely
- **Draft content:** 90 days of inactivity
- **Archived content:** Retained but not displayed
- **News articles:** 6 months (then archived)
- **Stats:** Aggregated monthly, retained indefinitely

## Privacy & Compliance

- All content is public (no personal data)
- Stats are aggregated (no individual tracking)
- GDPR compliant for EU visitors
- No cookies required for viewing

## Performance Optimization

- **CDN:** Static files served via CDN
- **Caching:** Blog posts cached for 5 minutes
- **Lazy loading:** Images loaded on demand
- **Pagination:** 20 items per page max
- **Prerendering:** Static generation for popular posts
