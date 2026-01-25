# Email Suppression & Campaign System - Technical Onboarding Guide

**Version:** 1.2
**Last Updated:** 2025-01-25
**Author:** Claude Code (Technical Lead)
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [File Structure & Responsibilities](#3-file-structure--responsibilities)
4. [Core Flows](#4-core-flows)
5. [Database Schema (Firebase Firestore)](#5-database-schema-firebase-firestore)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Token System & Security](#7-token-system--security)
8. [Admin Dashboard Components](#8-admin-dashboard-components)
9. [Email Templates](#9-email-templates)
10. [Webhook Integration](#10-webhook-integration)
11. [Environment Variables](#11-environment-variables)
12. [Testing Guide](#12-testing-guide)
13. [Common Issues & Fixes](#13-common-issues--fixes)
14. [Production Checklist](#14-production-checklist)

---

## 1. Executive Summary

### What This System Does

The Email Suppression & Campaign System provides:

1. **Global Email Suppression List** - Prevents sending to unsubscribed, bounced, or complained emails
2. **HMAC-Signed Unsubscribe Links** - Industry-standard secure tokens (RFC 8058 compliant)
3. **One-Click Unsubscribe** - Gmail/Yahoo compliance via List-Unsubscribe headers
4. **Webhook Integration** - Automatic bounce/complaint handling from Resend
5. **Campaign Management** - Admin dashboard for creating, previewing, and sending email campaigns
6. **Email Preview** - Render email templates before sending

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Email-based suppression** (not user-based) | Marketing emails should respect unsubscribe regardless of user account status |
| **"All or Nothing" unsubscribe** | Single unsubscribe removes from ALL marketing emails - no category management |
| **HMAC tokens** (not JWT/database) | Stateless verification, no token storage needed, impossible to forge |
| **7-day token expiry** | Balance between security and user convenience |
| **Server-only modules** | Firebase Admin SDK cannot be bundled for client-side |

---

## 2. Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ADMIN DASHBOARD                            │
│  /[locale]/admin/email-campaigns/page.tsx                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ Create       │ │ Preview      │ │ Send         │                │
│  │ Campaign     │ │ Recipients   │ │ Campaign     │                │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                │
│         │                │                │                         │
│         ▼                ▼                ▼                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Email Preview Modal                        │  │
│  │  - HTML/Text toggle                                           │  │
│  │  - Renders with unsubscribe footer                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│ POST /api/admin/campaigns           Create campaign                  │
│ GET  /api/admin/campaigns           List campaigns                   │
│ GET  /api/admin/campaigns/[id]      Get single campaign              │
│ PUT  /api/admin/campaigns/[id]      Update campaign (draft only)     │
│ POST /api/admin/campaigns/[id]/send Send campaign                    │
│ POST /api/admin/campaigns/[id]/send-test Send test email             │
│ GET  /api/admin/campaigns/[id]/preview  Preview recipients           │
│ GET  /api/admin/campaigns/[id]/email-preview  Render email template  │
│ DELETE /api/admin/campaigns/[id]    Delete campaign (draft only)     │
├─────────────────────────────────────────────────────────────────────┤
│ GET  /api/email/unsubscribe         Unsubscribe (link click)         │
│ POST /api/email/unsubscribe         Programmatic unsubscribe         │
│ POST /api/email/unsubscribe/one-click  RFC 8058 one-click           │
├─────────────────────────────────────────────────────────────────────┤
│ POST /api/webhooks/resend           Bounce/complaint webhook         │
│ GET  /api/webhooks/resend           Webhook verification             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│ src/lib/email/suppression/                                          │
│ ├── types.ts          Type definitions                               │
│ ├── tokens.ts         HMAC token generation/verification             │
│ ├── service.ts        Firestore CRUD for suppression list           │
│ └── index.ts          Barrel export                                  │
├─────────────────────────────────────────────────────────────────────┤
│ src/lib/email/campaigns/                                             │
│ ├── types.ts          Campaign type definitions                      │
│ └── service.ts        Campaign CRUD & sending logic                  │
├─────────────────────────────────────────────────────────────────────┤
│ src/lib/email/                                                       │
│ ├── resend.ts         Resend SDK wrapper (client-safe)              │
│ └── campaign-sender.ts Server-only email sending with headers        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────────────────────────────┐  │
│  │    Resend    │◄────────│  Email Provider (SMTP)               │  │
│  │    API       │         │  - Send transactional emails         │  │
│  └──────┬───────┘         │  - Bounce/complaint webhooks         │  │
│         │                 └──────────────────────────────────────┘  │
│         │                                                            │
│         │ Webhooks                                                   │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  /api/webhooks/resend                                         │   │
│  │  - Verifies SVix signature                                    │   │
│  │  - Adds to suppression list on bounce/complaint               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FIREBASE FIRESTORE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  email_suppressions (Collection)                                     │
│  └── {email_hash} (Document)                                         │
│      ├── email: string                                               │
│      ├── emailHash: string                                           │
│      ├── reason: 'unsubscribe' | 'bounce' | 'complaint'              │
│      ├── source: 'user' | 'admin' | 'webhook' | 'system'            │
│      ├── createdAt: Timestamp                                        │
│      └── metadata?: { bounceType?, webhookPayload? }                 │
│                                                                      │
│  email_campaigns (Collection)                                        │
│  └── {campaignId} (Document)                                         │
│      ├── name: string                                                │
│      ├── subject: string                                             │
│      ├── template: 'waitlist' | 'welcome' | 'custom'                │
│      ├── segment: { type, respectMarketingPrefs, emailVerifiedOnly }│
│      ├── status: 'draft' | 'sending' | 'sent' | 'failed'           │
│      ├── stats: { totalRecipients, sentCount, failedCount, ... }    │
│      ├── createdAt: Timestamp                                        │
│      ├── createdBy: string                                           │
│      └── sentAt?: Timestamp                                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure & Responsibilities

### Suppression Module

```
src/lib/email/suppression/
├── types.ts              # Type definitions
├── tokens.ts             # HMAC token generation/verification
├── service.ts            # Firestore CRUD operations
└── index.ts              # Barrel export
```

#### `types.ts` - Type Definitions

```typescript
// Key types exported:
export interface EmailSuppression {
  email: string
  emailHash: string
  reason: SuppressionReason      // 'unsubscribe' | 'bounce' | 'complaint'
  source: SuppressionSource      // 'user' | 'admin' | 'webhook' | 'system'
  createdAt: Date
  metadata?: {
    bounceType?: 'hard' | 'soft'
    webhookPayload?: Record<string, unknown>
  }
}

export interface UnsubscribeTokenPayload {
  email: string    // Normalized email
  exp: number      // Expiration timestamp (Unix)
  iat: number      // Issued at timestamp
}

export interface ResendWebhookPayload {
  type: 'email.bounced' | 'email.complained' | 'email.delivered' | ...
  data: {
    to: string[]
    bounce?: { type: 'hard' | 'soft' }
  }
}
```

#### `tokens.ts` - HMAC Token System

```typescript
// Key functions:

// Hash email for storage (privacy)
export function hashEmail(email: string): string

// Create signed unsubscribe token
export function createUnsubscribeToken(
  email: string,
  options?: { expiresInDays?: number }
): string

// Verify and decode token (throws on invalid)
export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload

// Generate full unsubscribe URL
export function generateUnsubscribeUrl(email: string): string
```

**Token Format:**
```
base64url(JSON.stringify(payload)).base64url(HMAC-SHA256(payload, secret))
```

**Security Properties:**
- Stateless verification
- Cannot forge without secret
- Expiration enforced
- Email embedded in token

#### `service.ts` - Suppression Service

```typescript
// Singleton instance
export const suppressionService = new SuppressionService()

// Key methods:
class SuppressionService {
  // Check if email is suppressed (before sending)
  async isEmailSuppressed(email: string): Promise<{
    suppressed: boolean
    reason?: SuppressionReason
    details?: EmailSuppression
  }>

  // Check multiple emails at once (batch operations)
  async checkBatch(emails: string[]): Promise<Map<string, SuppressionReason | null>>

  // Add email to suppression list
  async addSuppression(
    email: string,
    reason: SuppressionReason,
    source: SuppressionSource,
    metadata?: Record<string, unknown>
  ): Promise<boolean>

  // Remove from suppression (re-subscribe)
  async removeSuppression(email: string): Promise<boolean>

  // Get suppression stats
  async getStats(): Promise<SuppressionStats>
}
```

### Campaign Module

```
src/lib/email/campaigns/
├── types.ts              # Campaign type definitions
└── service.ts            # Campaign CRUD & sending
```

#### `types.ts` - Campaign Types

```typescript
export interface EmailCampaign {
  id: string
  name: string
  subject: string
  template: 'waitlist' | 'welcome' | 'password_reset' | 'custom'
  templateId?: string              // For custom templates
  templateVariables?: Record<string, string>
  segment: EmailSegment
  status: 'draft' | 'sending' | 'sent' | 'failed'
  stats: CampaignStats
  testEmail?: string               // Email address for test sends
  createdAt: Date | FirebaseTimestamp
  createdBy: string
  updatedAt?: Date | FirebaseTimestamp
  updatedBy?: string
  sentAt?: Date | FirebaseTimestamp
}

export interface EmailSegment {
  type: 'all' | 'premium' | 'free' | 'waitlist' | 'inactive'
  respectMarketingPrefs: boolean
  emailVerifiedOnly: boolean
}

export interface CampaignStats {
  totalRecipients: number
  sentCount: number
  failedCount: number
  skippedCount: number
}
```

#### `service.ts` - Campaign Service

Key integration with suppression:

```typescript
// In sendCampaign():
for (const email of recipients) {
  // Check global suppression list FIRST
  const { suppressed, reason } = await suppressionService.isEmailSuppressed(email)
  if (suppressed) {
    console.log(`Skipping suppressed email: ${email} (${reason})`)
    skippedCount++
    continue
  }

  // Send with unsubscribe headers
  await sendCampaignEmail(email, subject, htmlContent, textContent)
  sentCount++
}
```

### Email Sender Module

```
src/lib/email/
├── resend.ts             # Resend SDK wrapper (client-safe imports)
└── campaign-sender.ts    # Server-only campaign sending
```

#### `campaign-sender.ts` - Server-Only

**Why this file exists:** Firebase Admin SDK cannot be bundled for client-side. The suppression service imports firebase-admin. To prevent webpack bundling issues, campaign email sending (which needs unsubscribe URLs and List-Unsubscribe headers) is in a separate server-only file.

```typescript
export async function sendCampaignEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ id: string }> {
  const unsubscribeUrl = generateUnsubscribeUrl(to)
  const oneClickUrl = `${baseUrl}/api/email/unsubscribe/one-click`

  return resend.emails.send({
    to,
    subject,
    html: appendUnsubscribeFooter(html, unsubscribeUrl),
    text: appendUnsubscribeFooterText(text, unsubscribeUrl),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@moshimoshi.app>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
}
```

---

## 4. Core Flows

### Flow 1: User Clicks Unsubscribe Link

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User receives email with unsubscribe link                        │
│    https://moshimoshi.app/api/email/unsubscribe?token=xxx           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. GET /api/email/unsubscribe?token=xxx                             │
│                                                                      │
│    a) Extract token from query string                                │
│    b) Verify HMAC signature (tokens.ts:verifyUnsubscribeToken)      │
│    c) Check expiration (7 days default)                              │
│    d) Extract email from payload                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Add to suppression list                                          │
│                                                                      │
│    suppressionService.addSuppression(email, 'unsubscribe', 'user')  │
│                                                                      │
│    Firestore document created:                                       │
│    email_suppressions/{hash} = {                                     │
│      email: "user@example.com",                                      │
│      emailHash: "abc123...",                                         │
│      reason: "unsubscribe",                                          │
│      source: "user",                                                 │
│      createdAt: Timestamp                                            │
│    }                                                                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Return branded HTML success page                                  │
│                                                                      │
│    "You've been unsubscribed from Moshimoshi marketing emails."     │
│    [Re-subscribe link]                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Gmail/Yahoo One-Click Unsubscribe

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Email sent with headers:                                          │
│    List-Unsubscribe: <url>, <mailto:...>                            │
│    List-Unsubscribe-Post: List-Unsubscribe=One-Click                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Gmail shows "Unsubscribe" button in email header                  │
│    User clicks it                                                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Gmail sends:                                                      │
│    POST /api/email/unsubscribe/one-click                            │
│    Content-Type: application/x-www-form-urlencoded                  │
│    Body: List-Unsubscribe=One-Click                                 │
│    Headers: List-Unsubscribe-Email: user@example.com                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. API extracts email from List-Unsubscribe-Email header            │
│    OR from original List-Unsubscribe URL                            │
│                                                                      │
│    Adds to suppression list                                          │
│    Returns 200 OK                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Resend Webhook (Bounce/Complaint)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Email bounces or user reports spam                                │
│    Resend captures the event                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Resend sends webhook:                                             │
│    POST /api/webhooks/resend                                         │
│    Headers:                                                          │
│      svix-id: msg_xxx                                                │
│      svix-timestamp: 1706000000                                      │
│      svix-signature: v1,base64signature                              │
│    Body: {                                                           │
│      type: "email.bounced",                                          │
│      data: {                                                         │
│        to: ["user@example.com"],                                     │
│        bounce: { type: "hard" }                                      │
│      }                                                               │
│    }                                                                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Verify SVix signature                                             │
│                                                                      │
│    a) Get secret from RESEND_WEBHOOK_SECRET                          │
│    b) Reconstruct signed content: svix-id.svix-timestamp.body       │
│    c) Calculate HMAC-SHA256                                          │
│    d) Compare with svix-signature                                    │
│    e) Verify timestamp within 5 minutes (replay protection)         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Process event                                                     │
│                                                                      │
│    email.bounced (hard only):                                        │
│      suppressionService.addSuppression(email, 'bounce', 'webhook')  │
│                                                                      │
│    email.complained:                                                 │
│      suppressionService.addSuppression(email, 'complaint', 'webhook')│
│                                                                      │
│    email.delivered: Log for analytics (optional)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Return 200 OK (always, to prevent Resend retry)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 4: Send Campaign (Admin)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Admin creates campaign in dashboard                               │
│    - Name, subject, template, segment                                │
│    POST /api/admin/campaigns                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Admin previews recipients                                         │
│    GET /api/admin/campaigns/[id]/preview                            │
│    Returns: totalRecipients, segment details                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Admin previews email content                                      │
│    GET /api/admin/campaigns/[id]/email-preview                      │
│    Returns: { html, text, campaign info }                           │
│    Modal shows HTML/Text toggle with iframe preview                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Admin sends campaign                                              │
│    POST /api/admin/campaigns/[id]/send                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Campaign sending process                                          │
│                                                                      │
│    a) Update status to 'sending'                                     │
│    b) Query recipients from Firestore based on segment              │
│    c) For each recipient:                                            │
│       i. Check suppressionService.isEmailSuppressed()               │
│       ii. If suppressed → skip (increment skippedCount)             │
│       iii. If not → send with campaign-sender.ts                    │
│       iv. Batch: 50 emails, 1 second delay between batches          │
│    d) Update stats and status to 'sent'                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema (Firebase Firestore)

### Collection: `email_suppressions`

**Document ID:** SHA-256 hash of lowercased, trimmed email

```typescript
{
  // The email address (stored for admin reference)
  email: "user@example.com",

  // SHA-256 hash for deduplication and lookup
  emailHash: "abc123def456...",

  // Why this email was suppressed
  reason: "unsubscribe" | "bounce" | "complaint",

  // How the suppression was created
  source: "user" | "admin" | "webhook" | "system",

  // When suppression was added
  createdAt: Timestamp,

  // Optional additional info
  metadata?: {
    bounceType?: "hard" | "soft",
    webhookPayload?: { ... }
  }
}
```

**Indexes Required:**
- `emailHash` (default, used for lookups)
- `reason` (for filtering)
- `createdAt` (for sorting)

### Collection: `email_campaigns`

```typescript
{
  // Auto-generated document ID
  id: "abc123",

  // Campaign display name
  name: "Welcome Email January 2025",

  // Email subject line
  subject: "Welcome to Moshimoshi!",

  // Template to use
  template: "waitlist" | "welcome" | "password_reset" | "custom",

  // Custom template reference (when template = "custom")
  templateId?: "template-doc-id",
  templateVariables?: { key: "value" },

  // Recipient targeting
  segment: {
    type: "all" | "premium" | "free" | "waitlist" | "inactive",
    respectMarketingPrefs: true,
    emailVerifiedOnly: false
  },

  // Current status
  status: "draft" | "sending" | "sent" | "failed",

  // Sending statistics
  stats: {
    totalRecipients: 1500,
    sentCount: 1450,
    failedCount: 10,
    skippedCount: 40  // Suppressed emails
  },

  // Test email for sending previews to yourself
  testEmail?: "admin@example.com",

  // Audit fields
  createdAt: Timestamp,
  createdBy: "admin-uid",
  updatedAt?: Timestamp,
  updatedBy?: "admin-uid",
  sentAt?: Timestamp
}
```

---

## 6. API Endpoints Reference

### Unsubscribe Endpoints

#### `GET /api/email/unsubscribe`

Handles unsubscribe link clicks from emails.

**Query Parameters:**
- `token` (required): HMAC-signed unsubscribe token

**Responses:**
- `200`: HTML success page (unsubscribed)
- `400`: HTML error page (missing token)
- `401`: HTML error page (invalid/expired token)
- `500`: HTML error page (server error)

**Example:**
```
GET /api/email/unsubscribe?token=eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLC...
```

#### `POST /api/email/unsubscribe`

Programmatic unsubscribe (for API integrations).

**Request Body:**
```json
{
  "token": "eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLC..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully unsubscribed"
}
```

#### `POST /api/email/unsubscribe/one-click`

RFC 8058 compliant one-click unsubscribe for email clients.

**Request:**
```
POST /api/email/unsubscribe/one-click
Content-Type: application/x-www-form-urlencoded

List-Unsubscribe=One-Click
```

**Headers Checked:**
- `List-Unsubscribe-Email`: Email address (primary)
- Fallback: Parse from referrer or List-Unsubscribe URL

**Response:**
```json
{
  "success": true,
  "message": "Successfully unsubscribed"
}
```

### Webhook Endpoint

#### `POST /api/webhooks/resend`

Handles Resend email events.

**Headers (SVix):**
- `svix-id`: Unique message ID
- `svix-timestamp`: Unix timestamp
- `svix-signature`: `v1,base64signature`

**Request Body:**
```json
{
  "type": "email.bounced",
  "data": {
    "to": ["user@example.com"],
    "bounce": { "type": "hard" }
  }
}
```

**Response:**
```json
{
  "received": true
}
```

### Admin Campaign Endpoints

All require `Authorization: Bearer {firebase-id-token}` and admin role.

#### `POST /api/admin/campaigns`

Create a new campaign.

**Request:**
```json
{
  "name": "Welcome Email",
  "subject": "Welcome to Moshimoshi!",
  "template": "welcome",
  "segment": {
    "type": "all",
    "respectMarketingPrefs": true,
    "emailVerifiedOnly": false
  }
}
```

#### `GET /api/admin/campaigns`

List all campaigns.

#### `GET /api/admin/campaigns/[id]`

Get a single campaign by ID.

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "abc123",
    "name": "Welcome Email",
    "subject": "Welcome to Moshimoshi!",
    "template": "custom",
    "templateId": "template-doc-id",
    "templateVariables": { "featureTitle": "Kanji Memory Aids" },
    "segment": { ... },
    "status": "draft",
    "testEmail": "admin@example.com",
    "createdAt": "2025-01-25T12:00:00Z",
    "createdBy": "admin-uid"
  }
}
```

#### `PUT /api/admin/campaigns/[id]`

Update a draft campaign.

**Request:**
```json
{
  "name": "Updated Campaign Name",
  "subject": "Updated Subject Line",
  "template": "custom",
  "templateId": "new-template-id",
  "templateVariables": { "key": "value" },
  "testEmail": "test@example.com",
  "segment": {
    "type": "all",
    "respectMarketingPrefs": true,
    "emailVerifiedOnly": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Campaign updated successfully"
}
```

**Errors:**
- `400 INVALID_STATUS` - Cannot edit non-draft campaigns
- `404 NOT_FOUND` - Campaign not found

#### `POST /api/admin/campaigns/[id]/send-test`

Send a test email to the campaign's configured test email address.

**Prerequisites:**
- Campaign must have a `testEmail` configured
- Campaign uses a custom template with `templateId`

**Response (success):**
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "email": "admin@example.com"
}
```

**Errors:**
- `400 NO_TEST_EMAIL` - No test email configured
- `404 TEMPLATE_NOT_FOUND` - Custom template not found
- `500 EMAIL_SEND_FAILED` - Resend API error

#### `GET /api/admin/campaigns/[id]/preview`

Preview recipient count and segment details.

**Response:**
```json
{
  "success": true,
  "totalRecipients": 1500,
  "segment": {
    "type": "all",
    "respectMarketingPrefs": true,
    "emailVerifiedOnly": false
  }
}
```

#### `GET /api/admin/campaigns/[id]/email-preview`

Render email template for preview.

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "abc123",
    "name": "Welcome Email",
    "subject": "Welcome to Moshimoshi!",
    "template": "welcome"
  },
  "preview": {
    "html": "<!DOCTYPE html>...",
    "text": "Welcome to Moshimoshi...",
    "previewEmail": "preview@example.com"
  }
}
```

#### `POST /api/admin/campaigns/[id]/send`

Send the campaign to all eligible recipients.

#### `DELETE /api/admin/campaigns/[id]`

Delete a draft campaign.

---

## 7. Token System & Security

### HMAC Token Architecture

```typescript
// Token structure
{
  payload: {
    email: "user@example.com",  // Normalized
    exp: 1706500000,            // Expiration (Unix timestamp)
    iat: 1705895200             // Issued at (Unix timestamp)
  },
  signature: "HMAC-SHA256(payload, secret)"
}

// Token format (URL-safe)
base64url(payload) + "." + base64url(signature)
```

### Security Properties

| Property | Implementation |
|----------|----------------|
| **Integrity** | HMAC-SHA256 signature prevents tampering |
| **Authenticity** | Only server with secret can create valid tokens |
| **Expiration** | Checked on verification (default: 7 days) |
| **Email Binding** | Email embedded in token, cannot be used for different email |
| **Stateless** | No database lookup needed for verification |

### Secret Management

```bash
# Generate cryptographically secure secret (32 bytes = 256 bits)
openssl rand -base64 32

# Store in environment
UNSUBSCRIBE_TOKEN_SECRET=your-32-byte-secret-here
```

**Security Requirements:**
- Minimum 32 bytes (256 bits)
- Stored only in environment variables
- Different secrets for production/staging
- Rotate periodically (requires migration plan)

### Token Verification Flow

```typescript
function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload {
  // 1. Split token into parts
  const [payloadB64, signatureB64] = token.split('.')

  // 2. Decode payload
  const payload = JSON.parse(base64url.decode(payloadB64))

  // 3. Verify signature
  const expectedSignature = createSignature(payload)
  if (signatureB64 !== base64url.encode(expectedSignature)) {
    throw new Error('Invalid token signature')
  }

  // 4. Check expiration
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token has expired')
  }

  // 5. Return verified payload
  return payload
}
```

---

## 8. Admin Dashboard Components

### Page: `/[locale]/admin/email-campaigns/page.tsx`

**State Management:**

```typescript
// Campaign list
const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

// Modals
const [showNewCampaignModal, setShowNewCampaignModal] = useState(false)
const [deleteModalOpen, setDeleteModalOpen] = useState(false)
const [previewModalOpen, setPreviewModalOpen] = useState(false)
const [emailPreviewModalOpen, setEmailPreviewModalOpen] = useState(false)
const [sendModalOpen, setSendModalOpen] = useState(false)

// Modal data
const [campaignToDelete, setCampaignToDelete] = useState<{id: string, name: string} | null>(null)
const [campaignToSend, setCampaignToSend] = useState<{id: string, name: string} | null>(null)
const [previewData, setPreviewData] = useState<any>(null)
const [emailPreviewData, setEmailPreviewData] = useState<any>(null)
const [emailPreviewLoading, setEmailPreviewLoading] = useState(false)

// Feedback modals
const [errorModalOpen, setErrorModalOpen] = useState(false)
const [errorMessage, setErrorMessage] = useState<string>('')
const [successModalOpen, setSuccessModalOpen] = useState(false)
const [successMessage, setSuccessMessage] = useState<string>('')
```

### Component: `CampaignCard`

**Props:**
```typescript
{
  campaign: EmailCampaign
  onSend: () => void
  onSendTest: () => void        // Send test email to configured address
  onPreview: () => void
  onEmailPreview: () => void
  onDelete: () => void
  onRefresh: () => void
  emailPreviewLoading: boolean
  sendingTest: boolean          // Loading state for test email
}
```

**Features:**
- Status badge (draft/sending/sent/failed)
- Metadata display (template, segment, dates)
- Stats grid (total, sent, failed, skipped)
- Action buttons:
  - **Preview Recipients** - Shows recipient count
  - **Email Preview** - Opens template preview modal
  - **Send Test** - Sends test email to configured testEmail (draft only)
  - **Send Now** - Triggers send confirmation (draft only)
  - **Delete** - Triggers delete confirmation (draft only)
  - **Refresh Status** - Refetches data (sending status)

### Component: `EmailPreviewModal`

**Props:**
```typescript
{
  isOpen: boolean
  onClose: () => void
  data: {
    campaign: { id, name, subject, template }
    preview: { html, text, previewEmail }
  }
}
```

**Features:**
- HTML/Text toggle buttons
- Campaign info header (name, template, subject)
- HTML preview in sandboxed iframe
- Text preview in monospace pre block
- Note about preview email address

### Template Editor (Admin UI)

The email template editor uses CodeMirror for HTML editing with syntax highlighting.

**Features:**
- Visual editor tab (Tiptap-based WYSIWYG)
- HTML Source tab (CodeMirror with syntax highlighting)
- Dark mode support (auto-detects system theme)
- Template preview modal

**Known Limitations:**
- **Visual editor strips inline CSS** - The Tiptap visual editor may strip inline CSS styles when switching between tabs. For templates with complex styling, edit only in the HTML Source tab.
- **Recommended workflow:** Use seed scripts (e.g., `scripts/seed-kanji-mnemonics-template.mjs`) for complex templates to preserve all CSS styling.

### Component: `NewCampaignModal`

**Form Fields:**
- Campaign Name (text input)
- Email Template (select: waitlist, welcome, password_reset, custom)
- Custom Template (select, shown when template = custom)
- Email Subject (text input)
- Template Variables (key-value inputs, shown for custom templates)
- Segment Type (select: all, premium, free, waitlist, inactive)
- Respect Marketing Preferences (checkbox)
- Email Verified Only (checkbox)
- **Test Email** (email input) - Address to send test emails before launching campaign

---

## 9. Email Templates

### Template System Architecture

The email template system consists of modular components for building branded, responsive emails.

```
src/lib/email/templates/
├── base.ts       # Common elements, assets, styles, and HTML builders
├── starters.ts   # Pre-built starter templates
├── types.ts      # TypeScript interfaces for templates
└── variables.ts  # Variable substitution system
```

### Brand Assets

All assets are served from `/public/` with absolute URLs for email client compatibility:

| Asset | File | Size | Purpose |
|-------|------|------|---------|
| Logo | `logo-mo-generated.png` | 16KB | Main logo for email headers |
| Logo SVG | `logo-mo.svg` | <1KB | Vector logo |
| Logo + Text | `logo-mo-with-text.svg` | <1KB | Full brand mark |
| Doshi | `doshi.png` | 46KB | Red panda mascot character |
| Emma | `doshi-emma.JPG` | 226KB | Founder/developer character |

### Base Components (`base.ts`)

Reusable building blocks for all email templates:

```typescript
// Header with logo and greeting
emailHeader({ showLogo: true, greeting: 'Welcome', recipientName: '{{name}}' })

// Footer with unsubscribe, social links, copyright
emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })

// Character message with avatar (Doshi or Emma)
characterMessage({
  character: 'doshi',  // or 'emma'
  message: "Your motivational message here!",
  name: 'Doshi'        // Optional custom name
})

// CTA Button (primary or secondary)
ctaButton({ text: 'Start Learning', url: '{{appUrl}}', variant: 'primary' })

// Feature list with checkmarks
featureList(['Feature 1', 'Feature 2', 'Feature 3'])

// Highlight box (info, success, warning)
highlightBox({ type: 'info', title: 'Pro tip', content: 'Your tip here' })

// Wrap content in full HTML document
wrapEmailHtml(content)
```

### Brand Colors

```typescript
EMAIL_COLORS = {
  primary: '#ec4899',      // Pink
  secondary: '#8b5cf6',    // Purple
  accent: '#f97316',       // Orange
  success: '#10b981',      // Green
  text: '#111827',
  textLight: '#6b7280',
  background: '#f5f5f5',
}
```

### Starter Templates (`starters.ts`)

Pre-built templates ready to use:

| Template | Function | Use Case |
|----------|----------|----------|
| Welcome | `welcomeEmailStarter()` | New user onboarding with Doshi greeting |
| Feature Announcement | `featureAnnouncementStarter()` | New feature releases with Emma message |
| Streak Reminder | `streakReminderStarter()` | Engagement nudge with streak stats |
| Weekly Progress | `weeklyProgressStarter()` | Stats summary with XP, words, minutes |
| New Content | `newContentReleaseStarter()` | Content announcements |
| Thank You | `thankYouNoteStarter()` | Appreciation emails with both characters |
| Newsletter | `newsletterStarter()` | General announcements |

**Example Usage:**

```typescript
import { getStarterTemplates } from '@/lib/email/templates/starters'

const templates = getStarterTemplates()
const welcome = templates.welcome
// Returns: { name, description, html, text, subject }
```

### Variable System (`variables.ts`)

Templates support dynamic variable substitution using `{{variableName}}` syntax.

**System Variables (always available):**

| Variable | Description | Default |
|----------|-------------|---------|
| `{{email}}` | Recipient email | `user@example.com` |
| `{{name}}` | Recipient name | `John` |
| `{{unsubscribeUrl}}` | Unsubscribe link | Generated per-user |
| `{{preferencesUrl}}` | Settings page | `/settings/notifications` |
| `{{currentYear}}` | Current year | `2025` |

**Template-Specific Variables:**

| Template | Variables |
|----------|-----------|
| Streak Reminder | `{{streakDays}}` |
| Weekly Progress | `{{xpEarned}}`, `{{wordsLearned}}`, `{{minutesPracticed}}`, `{{weekDate}}` |
| Feature Announcement | `{{featureTitle}}`, `{{featureDescription}}`, `{{featureUrl}}` |
| New Content | `{{contentType}}`, `{{contentTitle}}`, `{{contentDescription}}`, `{{contentUrl}}` |

### Legacy Templates

For backward compatibility, these templates are also supported:

- **`waitlist`**: Uses `buildWaitlistThankYouContent()` from `src/lib/email/waitlistThankYou.ts`
- **`welcome`**: Basic welcome template
- **`custom`**: Uses templates from `email_templates` Firestore collection

### Mobile/Android Email Considerations

Email templates include mobile-responsive CSS to handle display issues across devices:

**Required Meta Tags:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="x-apple-disable-message-reformatting">
```

**Android Text Size Fix:**
Android email clients may inflate text sizes. Include these styles:
```css
body, table, td, p, a, li, blockquote {
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
}
```

**Mobile Responsive Classes:**
Templates use CSS classes for mobile font size adjustments:
```css
@media only screen and (max-width: 620px) {
  .mobile-text { font-size: 14px !important; line-height: 1.5 !important; }
  .mobile-text-sm { font-size: 12px !important; }
  .mobile-heading { font-size: 16px !important; }
  .mobile-cta { font-size: 14px !important; padding: 12px 20px !important; }
  .container { width: 100% !important; padding: 10px !important; }
  .card { padding: 16px !important; }
}
```

**Testing Recommendations:**
1. Always send test emails to both iOS and Android devices
2. Check Gmail app on Android specifically (known for text inflation)
3. Verify CTA buttons are tappable on mobile

### Unsubscribe Footer

Automatically appended by `CampaignService.appendUnsubscribeFooter()`:

```html
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
  <p>You're receiving this email because you signed up for Moshimoshi.</p>
  <p>
    <a href="{{unsubscribeUrl}}" style="color: #6b7280; text-decoration: underline;">
      Unsubscribe
    </a>
    from marketing emails
  </p>
</div>
```

---

## 10. Webhook Integration

### Resend Webhook Setup

1. **Go to Resend Dashboard** → Webhooks
2. **Add endpoint:**
   - URL: `https://moshimoshi.app/api/webhooks/resend`
   - Events: `email.bounced`, `email.complained`
3. **Copy signing secret** to `RESEND_WEBHOOK_SECRET`

### Signature Verification (SVix)

```typescript
async function verifyWebhookSignature(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET

  // Get SVix headers
  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  // Check timestamp (5 minute tolerance for replay protection)
  const timestamp = parseInt(svixTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > 300) {
    return false
  }

  // Reconstruct signed content
  const signedContent = `${svixId}.${svixTimestamp}.${body}`

  // Decode secret (base64 with "whsec_" prefix)
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64')

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64')

  // Compare with received signatures
  for (const sig of svixSignature.split(' ')) {
    const [version, signature] = sig.split(',')
    if (version === 'v1' && signature === expectedSignature) {
      return true
    }
  }

  return false
}
```

### Event Handling

| Event | Action |
|-------|--------|
| `email.bounced` (hard) | Add to suppression with reason `bounce` |
| `email.bounced` (soft) | Log only, no suppression (temporary issue) |
| `email.complained` | Add to suppression with reason `complaint` |
| `email.delivered` | Log for analytics (optional) |
| `email.opened` | Track engagement (optional) |
| `email.clicked` | Track engagement (optional) |

---

## 11. Environment Variables

### Required Variables

```bash
# Token signing secret (32+ bytes, base64)
UNSUBSCRIBE_TOKEN_SECRET=your-secret-here

# Resend webhook signing secret (from Resend dashboard)
RESEND_WEBHOOK_SECRET=whsec_xxxxx

# Resend API key
RESEND_API_KEY=re_xxxxx

# Firebase Admin (for Firestore)
FIREBASE_ADMIN_PROJECT_ID=your-project
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# App URL (for generating unsubscribe links)
NEXT_PUBLIC_APP_URL=https://moshimoshi.app
```

### Setting Up Secrets

```bash
# Generate unsubscribe token secret
openssl rand -base64 32

# Add to Vercel (both production and preview)
vercel env add UNSUBSCRIBE_TOKEN_SECRET production
vercel env add UNSUBSCRIBE_TOKEN_SECRET preview

# Resend webhook secret comes from Resend dashboard
# Copy it when creating the webhook
```

---

## 12. Testing Guide

### Unit Tests

**Location:** `src/lib/email/suppression/__tests__/suppression.test.ts`

**Run tests:**
```bash
npm test -- --testPathPattern=suppression
```

**Test Coverage:**

```typescript
describe('Token Module', () => {
  describe('hashEmail', () => {
    it('should create consistent hash for same email')
    it('should normalize email before hashing')
    it('should create different hashes for different emails')
  })

  describe('createUnsubscribeToken', () => {
    it('should create valid token format')
    it('should include email in payload')
    it('should set correct expiration')
    it('should use default 7-day expiry')
    it('should accept custom expiry')
  })

  describe('verifyUnsubscribeToken', () => {
    it('should verify valid token')
    it('should reject tampered token')
    it('should reject expired token')
    it('should reject invalid format')
  })

  describe('generateUnsubscribeUrl', () => {
    it('should generate full URL with token')
    it('should use correct base URL')
  })
})
```

### Integration Testing

**Test endpoint:** `/api/email/test-unsubscribe` (development only)

```bash
# 1. Generate test token
curl "http://localhost:3000/api/email/test-unsubscribe?action=generate&email=test@example.com"

# 2. Test unsubscribe flow
curl "http://localhost:3000/api/email/unsubscribe?token={token}"

# 3. Check if suppressed
curl "http://localhost:3000/api/email/test-unsubscribe?action=check&email=test@example.com"

# 4. Test re-subscribe
curl -X POST "http://localhost:3000/api/email/test-unsubscribe" \
  -H "Content-Type: application/json" \
  -d '{"action": "resubscribe", "email": "test@example.com"}'
```

### Manual Testing Checklist

- [ ] Create a campaign in admin dashboard
- [ ] Configure test email address in campaign settings
- [ ] Preview recipients (check count matches expected)
- [ ] Preview email (HTML and text views)
- [ ] **Send test email** using the "Send Test" button
- [ ] Verify test email received (subject prefixed with `[TEST]`)
- [ ] Check email renders correctly on:
  - [ ] Desktop email client
  - [ ] iOS Mail app
  - [ ] Android Gmail app
- [ ] Verify email received with unsubscribe link
- [ ] Click unsubscribe link → see success page
- [ ] Try same link again → see already unsubscribed message
- [ ] Send another campaign → your email should be skipped
- [ ] Check Firestore for suppression document
- [ ] Test re-subscribe (admin only)

---

## 13. Common Issues & Fixes

### Issue 1: Webpack Bundling Error

**Error:**
```
Module not found: Can't resolve 'fs'
./node_modules/@google-cloud/firestore/...
```

**Cause:** Firebase Admin SDK being bundled for client-side due to import chain.

**Solution:** Create server-only modules. The `campaign-sender.ts` file was created specifically to avoid this:

```typescript
// BAD: This pulls firebase-admin into client bundle
// src/lib/email/resend.ts
import { suppressionService } from './suppression'
export async function sendCampaignEmail() { ... }

// GOOD: Server-only file
// src/lib/email/campaign-sender.ts
import { suppressionService } from './suppression'
export async function sendCampaignEmail() { ... }
```

### Issue 2: Crypto Import Error

**Error:**
```
TypeError: crypto.createHmac is not a function
```

**Cause:** Using `import crypto from 'crypto'` instead of `import * as crypto from 'crypto'`

**Solution:**
```typescript
// BAD
import crypto from 'crypto'

// GOOD
import * as crypto from 'crypto'
```

### Issue 3: Token Verification Failing

**Symptoms:**
- All tokens rejected as invalid
- "Invalid token signature" error

**Possible Causes:**
1. **Different secrets in dev/prod** - Verify `UNSUBSCRIBE_TOKEN_SECRET` matches
2. **Secret not loaded** - Check environment variable is set
3. **Base64 encoding issues** - Ensure using base64url, not base64
4. **Payload mutation** - Don't modify payload between create and verify

**Debug:**
```typescript
console.log('Secret exists:', !!process.env.UNSUBSCRIBE_TOKEN_SECRET)
console.log('Secret length:', process.env.UNSUBSCRIBE_TOKEN_SECRET?.length)
```

### Issue 4: Webhook Signature Verification Failing

**Symptoms:**
- Resend webhooks rejected with 401
- "Invalid signature" in logs

**Possible Causes:**
1. **Wrong secret** - Copy from Resend dashboard again
2. **"whsec_" prefix handling** - Secret is base64 after removing prefix
3. **Body parsing** - Must use raw body, not parsed JSON

**Solution:**
```typescript
// Get raw body BEFORE parsing
const body = await request.text()

// Verify THEN parse
const isValid = await verifyWebhookSignature(request, body)
const payload = JSON.parse(body)
```

### Issue 5: Suppression Not Working

**Symptoms:**
- Emails sent to suppressed addresses
- Check returns false for suppressed email

**Possible Causes:**
1. **Email normalization** - Must lowercase and trim before hashing
2. **Firestore initialization** - `ensureAdminInitialized()` not called
3. **Document ID mismatch** - Using wrong hash algorithm

**Debug:**
```typescript
// Check what hash is being used
const hash = hashEmail('test@example.com')
console.log('Hash:', hash)

// Check Firestore directly
const doc = await adminFirestore.collection('email_suppressions').doc(hash).get()
console.log('Document exists:', doc.exists)
```

---

## 14. Production Checklist

### Before Deployment

- [x] **Environment variables set in Vercel:** *(Completed 2025-01-25)*
  - [x] `UNSUBSCRIBE_TOKEN_SECRET` (same for production and preview)
  - [x] `RESEND_WEBHOOK_SECRET`
  - [x] `RESEND_API_KEY`
  - [x] Firebase Admin credentials

- [x] **Resend webhook configured:** *(Completed 2025-01-25)*
  - [x] Endpoint: `https://moshimoshi.app/api/webhooks/resend`
  - [x] Events: `email.bounced`, `email.complained`
  - [x] Signing secret copied to env

- [x] **Firebase Firestore:**
  - [x] `email_suppressions` collection exists
  - [x] `email_campaigns` collection exists
  - [x] Security rules allow admin access

### After Deployment

- [x] **Test unsubscribe flow:** *(Tested 2025-01-25)*
  1. ✅ Sent test email with unsubscribe link
  2. ✅ Clicked unsubscribe link - success page displayed
  3. ✅ Verified suppression in Firestore (`suppressed: true, reason: "unsubscribe"`)
  4. ✅ Confirmed subsequent emails would be skipped

- [x] **Test re-subscribe flow:** *(Tested 2025-01-25)*
  1. ✅ Re-subscribed via test endpoint
  2. ✅ Verified suppression removed

- [ ] **Test webhook:**
  1. Send test event from Resend dashboard
  2. Check server logs for verification
  3. Verify no errors

- [x] **Monitor logs for:**
  - Signature verification failures
  - Suppression service errors
  - Campaign sending issues

### Monitoring

**Key Metrics:**
- Suppression count by reason (unsubscribe, bounce, complaint)
- Campaign delivery rate (sent / total)
- Webhook processing success rate

**Log Patterns:**
```bash
# Successful unsubscribe
[Unsubscribe] Successfully unsubscribed: user@example.com

# Suppression check
[CampaignService] Skipping suppressed email: user@example.com (unsubscribe)

# Webhook processing
[ResendWebhook] Received event: email.bounced
[ResendWebhook] Hard bounce for: user@example.com
```

---

## Appendix A: Creating Email Templates (AI Agent Guide)

This section is for AI agents tasked with creating new email templates.

### Template Architecture Overview

```
Templates are stored in TWO places:
1. Code (starters.ts)     → Pre-built templates, requires deployment
2. Firestore              → Custom templates, editable via admin UI
```

### Method 1: Add a Code-Based Template

**When to use:** For permanent, frequently-used templates.

**Step 1:** Add the template function to `src/lib/email/templates/starters.ts`:

```typescript
export function myNewTemplateStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true, greeting: 'Hello', recipientName: '{{name}}' })}

    <p style="${EMAIL_STYLES.paragraph}">
      Your email content here...
    </p>

    ${characterMessage({
      character: 'doshi',  // or 'emma'
      message: "Doshi's message to the user!",
    })}

    ${ctaButton({ text: 'Call to Action', url: '{{ctaUrl}}' })}

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}' })}
  `)

  const text = `
Hello {{name}},

Your plain text version here...

CTA: {{ctaUrl}}

---
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: 'Your Subject Line - {{variable}}',
  }
}
```

**Step 2:** Register in `getStarterTemplates()`:

```typescript
export function getStarterTemplates() {
  return {
    // ... existing templates
    myNewTemplate: {
      name: 'My New Template',
      description: 'Description for admin UI',
      ...myNewTemplateStarter(),
    },
  }
}
```

**Step 3:** Add to seed script and re-seed:

```bash
node scripts/seed-email-templates.mjs
```

### Method 2: Create via Admin UI

**When to use:** For one-off campaigns or user-editable templates.

1. Go to `/en/admin/email-templates`
2. Click "New Template"
3. Fill in the form with HTML content
4. Save → Template is stored in Firestore `email_templates` collection

### Available Components (base.ts)

| Component | Usage |
|-----------|-------|
| `emailHeader()` | Logo + greeting |
| `emailFooter()` | Unsubscribe, social links, copyright |
| `characterMessage()` | Doshi or Emma with avatar and message |
| `ctaButton()` | Primary/secondary call-to-action button |
| `featureList()` | Bulleted list with checkmarks |
| `highlightBox()` | Info/success/warning callout box |
| `wrapEmailHtml()` | Wraps content in full HTML document |

### Available Variables

**System variables (always available):**
- `{{name}}` - Recipient's name
- `{{email}}` - Recipient's email
- `{{unsubscribeUrl}}` - Unsubscribe link (REQUIRED in all templates)
- `{{currentYear}}` - Current year

**Custom variables:** Define per-template, e.g., `{{featureTitle}}`, `{{streakDays}}`

### Brand Assets

| Asset | URL |
|-------|-----|
| Logo | `https://moshimoshi.app/logo-mo-generated.png` |
| Doshi | `https://moshimoshi.app/doshi.png` |
| Emma | `https://moshimoshi.app/doshi-emma.JPG` |

### Brand Colors

```typescript
primary: '#ec4899'    // Pink
secondary: '#8b5cf6'  // Purple
accent: '#f97316'     // Orange
success: '#10b981'    // Green
```

### Testing Your Template

1. Create the template in code or admin UI
2. Go to admin dashboard → Email Campaigns
3. Create a test campaign using your template
4. Click "Email Preview" to see rendered HTML
5. Send to yourself to test the actual email

### Important Rules

1. **Always include `{{unsubscribeUrl}}`** - Required for CAN-SPAM/GDPR compliance
2. **Test on mobile** - Send test emails to both iOS and Android devices
3. **Include mobile CSS** - Add `-webkit-text-size-adjust: 100%` and responsive media queries
4. **Provide plain text version** - Some email clients don't render HTML
5. **Use inline styles** - Email clients strip `<style>` tags (but media queries in `<head>` work)
6. **Keep images small** - Large images may not load
7. **Use seed scripts for complex templates** - Avoid visual editor for templates with detailed CSS styling

---

## Appendix B: Resend Rate Limits & Bulk Sending Guide

### Resend Limits

| Limit Type | Value | Notes |
|------------|-------|-------|
| **Rate Limit** | 2 emails/second | API will reject with 429 if exceeded |
| **Daily Quota (Free)** | 100 emails/day | Resets at midnight UTC |
| **Daily Quota (Starter)** | ~200 emails/day | Check your plan |
| **Daily Quota (Pro)** | Higher | Check Resend dashboard |

### Campaign Sending Architecture

The campaign service sends emails at **2 emails/second** to respect Resend's rate limit:

```typescript
// src/lib/email/campaigns/service.ts
private readonly EMAILS_PER_SECOND = 2
private readonly RATE_LIMIT_DELAY_MS = 1000
```

**Time estimates:**
| Recipients | Time |
|------------|------|
| 100 | ~1 minute |
| 500 | ~4 minutes |
| 1000 | ~8 minutes |

### Handling Quota Exceeded

When daily quota is exceeded:
1. Resend API returns success initially (email queued)
2. Then returns `429 daily_quota_exceeded`
3. Emails after quota are NOT delivered

**To identify undelivered emails:**

```bash
# Run this to analyze which emails were sent before quota hit
node -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./moshimoshi-service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const CAMPAIGN_ID = 'YOUR_CAMPAIGN_ID';  // <-- Change this
const DAILY_QUOTA = 201;  // <-- Your Resend daily quota

async function analyze() {
  const snapshot = await db.collection('email_campaigns').doc(CAMPAIGN_ID)
    .collection('sent_emails').orderBy('sentAt', 'asc').get();

  const emails = [];
  snapshot.forEach(doc => emails.push(doc.data().email));

  console.log('Total tracked:', emails.length);
  console.log('Likely delivered:', Math.min(DAILY_QUOTA, emails.length));
  console.log('Likely NOT delivered:', Math.max(0, emails.length - DAILY_QUOTA));

  // Save undelivered to file
  const notDelivered = emails.slice(DAILY_QUOTA);
  if (notDelivered.length > 0) {
    fs.writeFileSync('not-delivered-emails.txt', notDelivered.join('\n'));
    console.log('Saved to: not-delivered-emails.txt');
  }
}
analyze();
"
```

### Bulk Sending Scripts

#### 1. Send Campaign with Tracking

Use this instead of the admin UI for large campaigns. Tracks each sent email in a subcollection for safe retries.

```bash
# Set environment variables
source .env.local

# Run tracked send
node scripts/send-campaign-tracked.mjs <campaignId>
```

**Features:**
- Tracks each successful send in `email_campaigns/{id}/sent_emails/`
- Can be re-run safely - skips already-sent emails
- Respects 2 emails/second rate limit
- Shows progress with ETA

#### 2. Resend to Quota-Failed Emails

After quota resets, resend only to emails that weren't delivered:

```bash
source .env.local
node scripts/resend-quota-failed.mjs <campaignId>
```

**Features:**
- Reads from `not-delivered-emails.txt`
- Stops if quota exceeded again
- Updates file with remaining emails
- Can be run multiple days until complete

#### 3. Resend to Specific Failed Emails

For campaigns with logged errors (rate limit failures, etc.):

```bash
source .env.local
node scripts/resend-failed-campaign.mjs <campaignId>
```

### Multi-Day Campaign Strategy

If you have more recipients than your daily quota:

**Day 1:**
```bash
# Send first batch (up to quota)
source .env.local && node scripts/send-campaign-tracked.mjs <campaignId>
# Script will stop when quota exceeded
# Check not-delivered-emails.txt for remaining
```

**Day 2+:**
```bash
# Wait for quota reset (midnight UTC)
source .env.local && node scripts/resend-quota-failed.mjs <campaignId>
# Repeat until not-delivered-emails.txt is empty
```

### Checking Campaign Status

```bash
node -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const sa = JSON.parse(fs.readFileSync('./moshimoshi-service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

db.collection('email_campaigns').doc('CAMPAIGN_ID').get().then(doc => {
  const d = doc.data();
  console.log('Name:', d.name);
  console.log('Status:', d.status);
  console.log('Stats:', JSON.stringify(d.stats, null, 2));
  console.log('Errors:', d.errors?.length || 0);
});
"
```

### Script Files Reference

| Script | Purpose |
|--------|---------|
| `scripts/send-campaign-tracked.mjs` | Send campaign with per-email tracking |
| `scripts/resend-quota-failed.mjs` | Resend from `not-delivered-emails.txt` |
| `scripts/resend-failed-campaign.mjs` | Resend to logged error emails |
| `scripts/seed-email-templates.mjs` | Seed email templates to Firestore |
| `scripts/seed-kanji-mnemonics-template.mjs` | Seed specific template |

### Troubleshooting

**"Too many requests" errors:**
- Resend rate limit is 2/second
- The campaign service now respects this
- If using old code, update `src/lib/email/campaigns/service.ts`

**Emails not delivered but script shows success:**
- Check Resend dashboard for actual delivery status
- Daily quota may have been exceeded
- Run analysis script to find undelivered emails

**User didn't receive email but others did:**
- Check if user has `marketingEmails: false` in preferences
- Check if user is in suppression list
- Check if user was filtered by segment criteria

```bash
# Check specific user
node -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const sa = JSON.parse(fs.readFileSync('./moshimoshi-service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'user@example.com';

async function check() {
  // Check preferences
  const users = await db.collection('users').where('email', '==', EMAIL).get();
  if (!users.empty) {
    const uid = users.docs[0].id;
    const prefs = await db.collection('users').doc(uid).collection('preferences').doc('settings').get();
    console.log('Preferences:', prefs.data());
  }

  // Check suppression
  const supp = await db.collection('email_suppressions').where('email', '==', EMAIL).get();
  console.log('Suppressed:', !supp.empty);
}
check();
"
```

---

## Appendix C: Quick Command Reference

```bash
# Run suppression tests
npm test -- --testPathPattern=suppression

# Generate unsubscribe secret
openssl rand -base64 32

# Add secret to Vercel
vercel env add UNSUBSCRIBE_TOKEN_SECRET production

# Check Firestore suppressions (using Firebase CLI)
firebase firestore:get email_suppressions --project moshimoshi

# Tail production logs
vercel logs --follow

# Local development
npm run dev
# Visit: http://localhost:3000/en/admin/email-campaigns
```

---

## Appendix D: File Quick Reference

### Suppression Module
| File | Purpose |
|------|---------|
| `src/lib/email/suppression/types.ts` | Type definitions |
| `src/lib/email/suppression/tokens.ts` | HMAC token creation/verification |
| `src/lib/email/suppression/service.ts` | Firestore CRUD for suppressions |
| `src/lib/email/suppression/index.ts` | Barrel export |

### Campaign Module
| File | Purpose |
|------|---------|
| `src/lib/email/campaigns/types.ts` | Campaign type definitions |
| `src/lib/email/campaigns/service.ts` | Campaign CRUD & sending |
| `src/lib/email/campaign-sender.ts` | Server-only email sending with headers |
| `src/lib/email/resend.ts` | Resend SDK wrapper |

### Template Module
| File | Purpose |
|------|---------|
| `src/lib/email/templates/base.ts` | Common elements, assets, styles, HTML builders |
| `src/lib/email/templates/starters.ts` | Pre-built starter templates (welcome, streak, etc.) |
| `src/lib/email/templates/types.ts` | Template TypeScript interfaces |
| `src/lib/email/templates/variables.ts` | Variable substitution system |

### API Endpoints
| File | Purpose |
|------|---------|
| `src/app/api/email/unsubscribe/route.ts` | Unsubscribe endpoint (GET/POST) |
| `src/app/api/email/unsubscribe/one-click/route.ts` | RFC 8058 one-click unsubscribe |
| `src/app/api/webhooks/resend/route.ts` | Resend webhook handler |
| `src/app/api/admin/campaigns/route.ts` | Campaign create/list API |
| `src/app/api/admin/campaigns/[id]/route.ts` | Campaign get/update/delete API |
| `src/app/api/admin/campaigns/[id]/send/route.ts` | Send campaign API |
| `src/app/api/admin/campaigns/[id]/send-test/route.ts` | Send test email API |
| `src/app/api/admin/campaigns/[id]/preview/route.ts` | Preview recipients API |
| `src/app/api/admin/campaigns/[id]/email-preview/route.ts` | Email template preview API |

### Admin UI
| File | Purpose |
|------|---------|
| `src/app/[locale]/admin/email-campaigns/page.tsx` | Admin dashboard UI |

### Assets
| File | Purpose |
|------|---------|
| `public/logo-mo-generated.png` | Email header logo |
| `public/doshi.png` | Doshi mascot character |
| `public/doshi-emma.JPG` | Emma/founder character |

### Scripts
| File | Purpose |
|------|---------|
| `scripts/send-campaign-tracked.mjs` | Send campaign with per-email tracking |
| `scripts/resend-quota-failed.mjs` | Resend from `not-delivered-emails.txt` after quota reset |
| `scripts/resend-failed-campaign.mjs` | Resend to logged error emails |
| `scripts/seed-email-templates.mjs` | Seed all email templates to Firestore |
| `scripts/seed-kanji-mnemonics-template.mjs` | Seed Kanji Mnemonics template |

---

**End of Document**

*For questions or updates, refer to the codebase or contact the development team.*
