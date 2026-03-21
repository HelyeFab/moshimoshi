# Email Templates System

> **Status**: ACTIVE
> **Last Updated**: 2026-02-12
> **Admin URL**: `/admin/email-templates`

---

## Overview

The email template system allows you to create, manage, and send beautiful HTML emails to users. Templates are stored in Firestore and can be used in email campaigns.

### Key Features

- Visual editor with live preview
- Variable substitution (`{{name}}`, `{{unsubscribeUrl}}`)
- Starter templates to jumpstart creation
- Mobile-responsive designs
- Plain text fallback generation
- Character messages (Doshi, Emma)

---

## Quick Start

### Method 1: Admin UI (Recommended for non-engineers)

1. Go to **Admin > Email Templates** (`/admin/email-templates`)
2. Click **"Create Template"**
3. Choose a starter template or start from scratch
4. Edit content in the visual editor
5. Add custom variables if needed
6. Save and preview

### Method 2: Code + Seed Script (Recommended for agents / engineers)

This is the preferred method when building templates programmatically. It produces two deliverables:

1. **Starter function** in `src/lib/email/templates/starters.ts` (reusable via admin UI)
2. **Seed script** in `scripts/add-<slug>-template.js` (pushes to Firestore directly)

See [Code-First Template Creation](#code-first-template-creation) for the complete pattern.

---

## Template Structure

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `name` | Display name | "Welcome Email" |
| `slug` | Unique identifier (lowercase, hyphens) | "welcome-email" |
| `subject` | Email subject line | "Welcome to Moshimoshi, {{name}}!" |
| `htmlContent` | Full HTML email content | See below |
| `textContent` | Plain text fallback | See below |
| `category` | Template category | `marketing`, `transactional`, `notification`, `custom` |

### Optional Fields

| Field | Description |
|-------|-------------|
| `description` | Internal notes about the template |
| `variables` | Custom variable definitions |
| `status` | `draft`, `active`, or `archived` |

> Only templates with `status: 'active'` appear in the Email Campaigns template selector. New templates default to `draft` — remember to activate them before using in campaigns.

### API Integration Notes (Important)

- `POST /api/admin/templates` returns `templateId` in the response payload.
- Do not assume `data.template.id` exists unless your client explicitly maps that shape.
- Slugs must be lowercase kebab-case (`^[a-z0-9-]+$`).

---

## Brand Assets & Colors

### Images (Absolute URLs)

| Asset | URL | Usage |
|-------|-----|-------|
| Logo | `https://moshimoshi.app/logo-mo-generated.png` | Header (60x60, border-radius: 12px) |
| Doshi | `https://moshimoshi.app/doshi.png` | Character message avatar (80x80, circular) |
| Emma | `https://moshimoshi.app/doshi-emma.JPG` | Developer character avatar (80x80, circular) |

### Brand Colors

| Constant Key | Hex | Usage |
|-------------|-----|-------|
| `primary` | `#ec4899` | Pink — buttons, accents, gradients |
| `primaryDark` | `#db2777` | Darker pink |
| `secondary` | `#8b5cf6` | Purple — gradients |
| `accent` | `#f97316` | Orange — highlights, badges |
| `text` | `#111827` | Body text |
| `textLight` | `#6b7280` | Secondary text |
| `textMuted` | `#9ca3af` | Footer text |
| `background` | `#f5f5f5` | Email background, character bubble bg |
| `cardBg` | `#ffffff` | Content card |
| `border` | `#e5e7eb` | Dividers |
| `success` | `#10b981` | Checkmarks, positive indicators |
| `error` | `#ef4444` | Warnings |

### Social Links

| Platform | URL |
|----------|-----|
| X | `https://x.com/AppMoshimoshi` |
| Instagram | `https://www.instagram.com/moshimoshi.app/` |
| TikTok | `https://www.tiktok.com/@moshimoshiapp23` |
| Facebook | `https://www.facebook.com/profile.php?id=61583293235389` |

### UTM Convention for CTAs

Always add UTM params to the primary CTA link:

```
?utm_source=email&utm_medium=announcement&utm_campaign=<template-slug>
```

Example: `https://moshimoshi.app/en/flashcards?utm_source=email&utm_medium=announcement&utm_campaign=flashcards_launch`

---

## base.ts Helper API Reference

**File:** `src/lib/email/templates/base.ts`

These TypeScript functions generate email-safe HTML. Use them in starter functions.

### Constants

```typescript
import {
  EMAIL_ASSETS,   // { logo, doshi, doshiEmma, social: { x, instagram, tiktok, facebook }, appUrl, settingsUrl }
  EMAIL_COLORS,   // { primary, primaryDark, secondary, accent, text, textLight, textMuted, background, cardBg, border, success, error }
  EMAIL_STYLES,   // { body, container, card, heading1, heading2, paragraph, smallText, mutedText, primaryButton, secondaryButton, link, logoStyle, characterImage, divider }
} from './base'
```

### Functions

#### `wrapEmailHtml(content: string): string`
Wraps content in the full HTML document (DOCTYPE, meta tags, responsive CSS, body/container/card divs). **Every template must use this as the outermost wrapper.**

#### `emailHeader(options?): string`
```typescript
emailHeader({
  showLogo?: boolean,      // default: true
  greeting?: string,       // e.g. "Welcome to Moshimoshi"
  recipientName?: string,  // e.g. "{{name}}" — appended to greeting with comma
})
```

#### `emailFooter(options?): string`
```typescript
emailFooter({
  unsubscribeUrl?: string,  // e.g. "{{unsubscribeUrl}}"
  showSocial?: boolean,     // default: true — X, Instagram, TikTok, Facebook
  showDoshi?: boolean,      // default: false — small Doshi image above social links
})
```

#### `characterMessage(options): string`
```typescript
characterMessage({
  character: 'doshi' | 'emma',   // picks avatar image automatically
  message: string,                // the speech bubble text (can contain HTML entities)
  name?: string,                  // override display name (default: "Doshi" or "Emma")
})
```

#### `ctaButton(options): string`
```typescript
ctaButton({
  text: string,                       // button label
  url: string,                        // href (use absolute URL with UTM)
  variant?: 'primary' | 'secondary',  // default: 'primary' (gradient pink-purple)
})
```

#### `featureList(features: string[]): string`
Renders a `<ul>` with green checkmarks. Items can contain HTML (`<strong>`, `&mdash;`, etc).

#### `highlightBox(options): string`
```typescript
highlightBox({
  content: string,                           // body text
  type?: 'info' | 'success' | 'warning',    // default: 'info' (blue)
  title?: string,                            // optional bold title above content
})
// Colors: info = blue (#eff6ff/#3b82f6/#1e40af)
//         success = green (#f0fdf4/#22c55e/#166534)
//         warning = amber (#fffbeb/#f59e0b/#92400e)
```

#### `buildEmail(options): string`
Convenience wrapper that calls `emailHeader` + your content + `emailFooter` + `wrapEmailHtml`.
```typescript
buildEmail({
  content: string,
  greeting?: string,
  recipientName?: string,
  showLogo?: boolean,
  showDoshiInFooter?: boolean,
  unsubscribeUrl?: string,
})
```

---

## Code-First Template Creation

This is the complete, copy-pasteable pattern for creating a new email campaign template. Follow these two steps exactly.

### Step 1: Add Starter Function to `starters.ts`

**File:** `src/lib/email/templates/starters.ts`

**1a) Add the function** (before `getStarterTemplates`):

```typescript
/**
 * My Feature Announcement Starter
 * Brief description of what this email announces
 */
export function myFeatureStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <!-- Announcement badge -->
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.primary}, ${EMAIL_COLORS.secondary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
        NEW FEATURE
      </span>
    </div>

    <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">
      Your Headline Here
    </h1>

    <p style="${EMAIL_STYLES.paragraph}; text-align: center; color: ${EMAIL_COLORS.textLight}; font-size: 18px;">
      One-liner subheadline describing the feature.
    </p>

    <hr style="${EMAIL_STYLES.divider}" />

    ${characterMessage({
      character: 'doshi',
      message: "Hey {{name}}-san! Your personalized Doshi message here.",
    })}

    <h2 style="${EMAIL_STYLES.heading2}">What you can do</h2>

    ${featureList([
      '<strong>Feature one</strong> &mdash; description',
      '<strong>Feature two</strong> &mdash; description',
      '<strong>Feature three</strong> &mdash; description',
    ])}

    ${highlightBox({
      type: 'info',
      title: 'Pro tip',
      content: 'Your tip content here.',
    })}

    ${ctaButton({ text: 'Try It Now', url: 'https://moshimoshi.app/en/your-page?utm_source=email&utm_medium=announcement&utm_campaign=your-slug' })}

    <p style="${EMAIL_STYLES.smallText}; text-align: center;">
      Optional footer note about free vs premium.
    </p>

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
  `)

  const text = `
YOUR HEADLINE HERE

One-liner subheadline.

Hey {{name}},

Doshi says: "Your personalized message here."

WHAT YOU CAN DO:
- Feature one - description
- Feature two - description
- Feature three - description

Pro tip: Your tip content here.

Try It Now: https://moshimoshi.app/en/your-page

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: '{{name}}, your subject line here',
  }
}
```

**1b) Register in `getStarterTemplates()`** (at the bottom of starters.ts):

```typescript
export function getStarterTemplates() {
  return {
    // ... existing entries ...
    myFeature: {
      name: 'My Feature Announcement',
      description: 'Brief description for admin UI',
      ...myFeatureStarter(),
    },
  }
}
```

**1c) Verify:** `npx tsc --noEmit --skipLibCheck src/lib/email/templates/starters.ts`

### Step 2: Create Seed Script

**File:** `scripts/add-<slug>-template.js`

Copy this template exactly, replacing only the marked sections:

```javascript
/**
 * Add <Template Name> template to Firestore
 *
 * Usage: node scripts/add-<slug>-template.js
 */

const admin = require('firebase-admin')
const path = require('path')

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

// ──────────────────────────────────────────────
// REPLACE: Paste your full HTML content here
// Use the raw HTML output, NOT the base.ts helpers
// (seed scripts run outside Next.js and can't import base.ts)
// ──────────────────────────────────────────────
const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Moshimoshi</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        padding: 12px !important;
      }
      .email-card {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #f5f5f5; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div class="email-container" style="max-width: 600px; margin: 0 auto; padding: 20px; width: 100%;">
    <div class="email-card" style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">

      <!-- REPLACE: Your email body HTML here -->

      <!-- Header with Logo -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="margin-bottom: 20px;">
          <img src="https://moshimoshi.app/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
        </div>
      </div>

      <!-- YOUR CONTENT SECTIONS HERE -->

      <!-- Footer (always include) -->
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://moshimoshi.app/doshi.png" alt="Doshi" style="width: 60px; height: 60px;" />
        </div>
        <div style="text-align: center; margin-bottom: 16px;">
          <a href="https://x.com/AppMoshimoshi" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">X</a>
          <span style="color: #e5e7eb;">|</span>
          <a href="https://www.instagram.com/moshimoshi.app/" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">Instagram</a>
          <span style="color: #e5e7eb;">|</span>
          <a href="https://www.tiktok.com/@moshimoshiapp23" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">TikTok</a>
          <span style="color: #e5e7eb;">|</span>
          <a href="https://www.facebook.com/profile.php?id=61583293235389" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">Facebook</a>
        </div>
        <p style="font-size: 12px; color: #9ca3af; margin: 8px 0; line-height: 1.5;">
          You're receiving this email because you signed up for Moshimoshi.
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin: 8px 0; line-height: 1.5;">
          <a href="{{unsubscribeUrl}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from marketing emails
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 12px; line-height: 1.5;">
          &copy; 2026 Moshimoshi. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>`

// ──────────────────────────────────────────────
// REPLACE: Plain text version
// ──────────────────────────────────────────────
const textContent = `YOUR HEADLINE

Hey {{name}},

Your plain text content here.

CTA: https://moshimoshi.app/en/your-page

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
© 2026 Moshimoshi. All rights reserved.`

// ──────────────────────────────────────────────
// REPLACE: Template metadata
// ──────────────────────────────────────────────
const template = {
  name: 'Your Template Name',
  slug: 'your-template-slug',
  description: 'Internal description of what this campaign is about.',
  subject: '{{name}}, your subject line here',
  htmlContent: htmlContent,
  textContent: textContent,
  category: 'marketing',   // 'marketing' | 'transactional' | 'notification' | 'custom'
  status: 'active',        // 'draft' | 'active' | 'archived'
  variables: [
    {
      name: 'name',
      label: 'Recipient Name',
      type: 'string',
      defaultValue: 'there',
      required: false,
    },
    // Add more custom variables here if needed
  ],
  createdBy: 'system',
  createdAt: admin.firestore.Timestamp.now(),
  updatedBy: 'system',
  updatedAt: admin.firestore.Timestamp.now(),
}

async function addTemplate() {
  try {
    // Duplicate check
    const existing = await db.collection('email_templates')
      .where('slug', '==', template.slug)
      .get()

    if (!existing.empty) {
      console.log(`Template with slug "${template.slug}" already exists.`)
      console.log(`Existing ID: ${existing.docs[0].id}`)
      console.log('Delete it first or use a different slug.')
      process.exit(1)
    }

    console.log(`Adding "${template.name}" template to Firestore...`)

    const docRef = await db.collection('email_templates').add(template)

    console.log('Template added successfully!')
    console.log(`Template ID: ${docRef.id}`)
    console.log(`Name: ${template.name}`)
    console.log(`Slug: ${template.slug}`)
    console.log(`Status: ${template.status}`)
    console.log(`\nView in admin: http://localhost:3000/en/admin/email-templates`)

    process.exit(0)
  } catch (error) {
    console.error('Error adding template:', error)
    process.exit(1)
  }
}

addTemplate()
```

**Run:** `node scripts/add-<slug>-template.js`

### Checklist (Both Steps Together)

| # | Action | File |
|---|--------|------|
| 1 | Write starter function | `src/lib/email/templates/starters.ts` |
| 2 | Register in `getStarterTemplates()` | `src/lib/email/templates/starters.ts` (bottom) |
| 3 | Type-check | `npx tsc --noEmit --skipLibCheck src/lib/email/templates/starters.ts` |
| 4 | Create seed script with raw HTML + plain text + metadata | `scripts/add-<slug>-template.js` |
| 5 | Run seed script | `node scripts/add-<slug>-template.js` |
| 6 | Verify in admin UI | `/admin/email-templates` |
| 7 | Send test email to yourself | Admin UI preview/send |

---

## Existing Starter Templates

| Key | Name | Use Case |
|-----|------|----------|
| `welcome` | Welcome Email | New user onboarding |
| `featureAnnouncement` | Feature Announcement | Announce new features |
| `newContentRelease` | New Content Release | New lessons/videos/content |
| `thankYouNote` | Thank You Note | Express gratitude |
| `streakReminder` | Streak Reminder | Nudge users to maintain streak |
| `weeklyProgress` | Weekly Progress | Weekly stats summary |
| `newsletter` | Newsletter | General announcements |
| `coJourneyAnnouncement` | Co-Journey Announcement | Moshi's MNN series |
| `flashcardsLaunch` | Flashcards Launch | Flashcards feature announcement |
| `kuchiguse500DeckUpdate` | Kuchiguse 500 Deck Update | DeckMarket + flashcards rollout email |
| `adjectives-100-master-deck` | Adjectives 100 Master Deck | 100 Japanese Adjectives deck launch email |

Access via: **Create Template > Choose Starter** or `GET /api/admin/templates/starters`

---

## Raw HTML Components (for Seed Scripts)

Seed scripts run outside Next.js and **cannot import base.ts helpers**. Use these raw HTML blocks directly in your `htmlContent` string. All values are pre-resolved from the brand constants above.

### Email Client Compatibility Note

For broad client support (especially mobile Gmail/Outlook), prefer table/stacked structures over `display:flex` in critical content blocks (e.g., character avatars + message text).

### Header with Logo

```html
<div style="text-align: center; margin-bottom: 24px;">
  <div style="margin-bottom: 20px;">
    <img src="https://moshimoshi.app/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
  </div>
</div>
```

### Announcement Badge

```html
<div style="text-align: center; margin-bottom: 24px;">
  <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
    NEW FEATURE
  </span>
</div>
```

Badge variants (change gradient):
- **New Feature:** `linear-gradient(135deg, #ec4899, #8b5cf6)` (pink > purple)
- **New Content:** `linear-gradient(135deg, #f97316, #ec4899)` (orange > pink)
- **New Series:** same as New Content

### Heading (h1)

```html
<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #111827; text-align: center; line-height: 1.3;">
  Your Headline
</h1>
```

### Heading (h2)

```html
<h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827; line-height: 1.3;">
  Section Title
</h2>
```

### Paragraph

```html
<p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
  Your paragraph text here.
</p>
```

### Subheadline (under h1)

```html
<p style="margin: 0 0 16px 0; font-size: 18px; color: #6b7280; text-align: center; line-height: 1.6;">
  One-liner description in lighter text.
</p>
```

### Divider

```html
<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
```

### Character Message - Doshi

```html
<div style="display: flex; align-items: flex-start; gap: 16px; margin: 24px 0; padding: 20px; background: #f5f5f5; border-radius: 12px;">
  <img src="https://moshimoshi.app/doshi.png" alt="Doshi" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />
  <div style="flex: 1;">
    <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827;">Doshi</p>
    <p style="margin: 0; color: #6b7280; line-height: 1.6;">Your message here!</p>
  </div>
</div>
```

### Character Message - Emma (Developer)

```html
<div style="display: flex; align-items: flex-start; gap: 16px; margin: 24px 0; padding: 20px; background: #f5f5f5; border-radius: 12px;">
  <img src="https://moshimoshi.app/doshi-emma.JPG" alt="Emma" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />
  <div style="flex: 1;">
    <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827;">Emma (Developer)</p>
    <p style="margin: 0; color: #6b7280; line-height: 1.6;">Your message here!</p>
  </div>
</div>
```

### Feature List with Checkmarks

```html
<ul style="list-style: none; padding: 0; margin: 16px 0;">
  <li style="margin-bottom: 12px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
    <span style="color: #10b981; margin-right: 8px; font-weight: 700;">&#10003;</span>
    <strong>Feature one</strong> &mdash; description
  </li>
  <li style="margin-bottom: 12px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
    <span style="color: #10b981; margin-right: 8px; font-weight: 700;">&#10003;</span>
    <strong>Feature two</strong> &mdash; description
  </li>
</ul>
```

### Info Box (blue)

```html
<div style="padding: 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af; line-height: 1.5;">Pro tip</p>
  <p style="margin: 0; color: #1e40af; line-height: 1.6;">Your tip content here.</p>
</div>
```

### Success Box (green)

```html
<div style="padding: 16px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534; line-height: 1.5;">Success</p>
  <p style="margin: 0; color: #166534; line-height: 1.6;">Your success message here.</p>
</div>
```

### Warning Box (amber)

```html
<div style="padding: 16px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e; line-height: 1.5;">Warning</p>
  <p style="margin: 0; color: #92400e; line-height: 1.6;">Your warning message here.</p>
</div>
```

### Gradient Highlight Card (pink > purple bg)

```html
<div style="background: linear-gradient(135deg, #fdf2f8, #ede9fe); border-radius: 12px; padding: 24px; margin: 24px 0;">
  <p style="margin: 0 0 16px 0; font-weight: 700; font-size: 18px; color: #111827; line-height: 1.3;">
    Card Title
  </p>
  <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.6;">
    Card content here.
  </p>
</div>
```

### Stats Box (centered number + label)

```html
<div style="text-align: center; padding: 20px; background: #f5f5f5; border-radius: 12px; margin: 20px 0;">
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Label</p>
  <p style="margin: 0 0 4px 0; font-size: 32px; font-weight: 700; color: #ec4899;">{{value}}</p>
  <p style="margin: 0; font-size: 14px; color: #6b7280;">Sublabel</p>
</div>
```

### CTA Button (Primary — gradient)

```html
<div style="text-align: center; margin: 32px 0 16px 0;">
  <a href="YOUR_URL_WITH_UTM" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; line-height: 1.3;">
    Button Text
  </a>
</div>
```

### CTA Button (Secondary — outline)

```html
<div style="text-align: center; margin: 16px 0;">
  <a href="YOUR_URL" style="display: inline-block; padding: 12px 24px; background: #f5f5f5; color: #111827; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; border: 1px solid #e5e7eb; line-height: 1.3;">
    Secondary Action
  </a>
</div>
```

### Small Text (below CTA)

```html
<p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6;">
  Optional note about free vs premium tiers.
</p>
```

### Footer (always include)

```html
<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://moshimoshi.app/doshi.png" alt="Doshi" style="width: 60px; height: 60px;" />
  </div>
  <div style="text-align: center; margin-bottom: 16px;">
    <a href="https://x.com/AppMoshimoshi" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">X</a>
    <span style="color: #e5e7eb;">|</span>
    <a href="https://www.instagram.com/moshimoshi.app/" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">Instagram</a>
    <span style="color: #e5e7eb;">|</span>
    <a href="https://www.tiktok.com/@moshimoshiapp23" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">TikTok</a>
    <span style="color: #e5e7eb;">|</span>
    <a href="https://www.facebook.com/profile.php?id=61583293235389" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">Facebook</a>
  </div>
  <p style="font-size: 12px; color: #9ca3af; margin: 8px 0; line-height: 1.5;">
    You're receiving this email because you signed up for Moshimoshi.
  </p>
  <p style="font-size: 12px; color: #9ca3af; margin: 8px 0; line-height: 1.5;">
    <a href="{{unsubscribeUrl}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from marketing emails
  </p>
  <p style="font-size: 12px; color: #9ca3af; margin-top: 12px; line-height: 1.5;">
    &copy; 2026 Moshimoshi. All rights reserved.
  </p>
</div>
```

The Doshi image in the footer is optional — remove the `<div>` with Doshi if not wanted.

---

## Variables

### System Variables (Always Available)

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{{name}}` | Recipient's name | "John" |
| `{{email}}` | Recipient's email | "john@example.com" |
| `{{unsubscribeUrl}}` | Unsubscribe link | Auto-generated |
| `{{preferencesUrl}}` | Notification settings | `/settings/notifications` |
| `{{currentYear}}` | Current year | "2026" |

### Custom Variables

Define per-template in the `variables` array:

```javascript
{
  name: 'featureTitle',        // used as {{featureTitle}} in content
  label: 'Feature Title',      // human-readable label in admin UI
  type: 'string',              // 'string' | 'url' | 'date' | 'number'
  defaultValue: 'New Feature', // used in previews
  required: false,             // whether campaign must provide it
}
```

### Variable Usage in Content

```html
<p>Hey {{name}},</p>
<p>{{doshiMessage}}</p>
<a href="{{ctaUrl}}">Click Here</a>
```

---

## Firestore Schema

Collection: `email_templates`

```typescript
{
  id: string,              // Auto-generated by Firestore
  name: string,            // "Welcome Email"
  slug: string,            // "welcome-email" (unique)
  description: string,     // Internal notes
  subject: string,         // Email subject
  htmlContent: string,     // Full HTML
  textContent: string,     // Plain text
  variables: [             // Custom variables
    {
      name: string,
      label: string,
      type: 'string' | 'url' | 'date' | 'number',
      defaultValue: string,
      required: boolean
    }
  ],
  category: 'marketing' | 'transactional' | 'notification' | 'custom',
  status: 'draft' | 'active' | 'archived',
  createdBy: string,       // 'system' for seed scripts, admin UID for UI
  createdAt: Timestamp,
  updatedBy: string,
  updatedAt: Timestamp
}
```

---

## API Reference

### List Templates
```
GET /api/admin/templates
GET /api/admin/templates?status=active
```

### Get Template
```
GET /api/admin/templates/{id}
```

### Create Template
```
POST /api/admin/templates
Content-Type: application/json

{
  "name": "My Template",
  "slug": "my-template",
  "subject": "Hello {{name}}",
  "htmlContent": "...",
  "textContent": "...",
  "category": "marketing",
  "status": "draft",
  "variables": []
}
```

> Set `"status": "active"` if you want the template immediately available in campaigns.

### Update Template
```
PUT /api/admin/templates/{id}
Content-Type: application/json

{
  "name": "Updated Name",
  "status": "active"
}
```

### Preview Template
```
POST /api/admin/templates/{id}/preview
Content-Type: application/json

{
  "variables": {
    "name": "John",
    "customVar": "Value"
  }
}
```

### Get Starter Templates
```
GET /api/admin/templates/starters
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/email/templates/types.ts` | TypeScript interfaces (`EmailTemplate`, `TemplateVariable`, etc.) |
| `src/lib/email/templates/base.ts` | HTML builder functions + constants (`EMAIL_COLORS`, `EMAIL_STYLES`, `EMAIL_ASSETS`) |
| `src/lib/email/templates/starters.ts` | Pre-built starter template functions + `getStarterTemplates()` registry |
| `src/lib/email/templates/variables.ts` | Variable substitution (`substituteVariables`, `extractVariables`, `validateVariables`) |
| `src/app/api/admin/templates/route.ts` | CRUD API endpoints |
| `src/app/[locale]/admin/email-templates/page.tsx` | Admin list page |
| `src/components/admin/email-templates/TemplateEditor.tsx` | Visual editor component |
| `scripts/add-*-template.js` | Seed scripts that push templates to Firestore |

---

## Best Practices

### Do's

- **Use inline styles** — email clients strip `<style>` tags for body content
- **Include `line-height: 1.6`** on all `<p>` and `<li>` elements in seed scripts
- **Include alt text** on images
- **Test on multiple clients** — Gmail, Apple Mail, Outlook
- **Keep subject lines under 50 characters**
- **Always include unsubscribe link** (`{{unsubscribeUrl}}`)
- **Use absolute URLs** for all links and images
- **Include plain text fallback**
- **Use `/en/` locale in URLs** (default locale)
- **Add UTM params** to the primary CTA

### Don'ts

- **Don't use external CSS files**
- **Don't use JavaScript**
- **Don't use background images** (poor support)
- **Don't use `position: absolute`**
- **Don't forget mobile responsiveness**
- **Don't use complex layouts** (tables are safer)
- **Don't import base.ts in seed scripts** (they run outside Next.js)

---

## Troubleshooting

### Images not showing

- Use absolute URLs: `https://moshimoshi.app/doshi.png`
- Check image is publicly accessible
- Some email clients block images by default

### Layout broken on mobile

- Add responsive CSS in `<style>` tag (included in the HTML shell)
- Use `max-width: 100%` on images
- Test with mobile preview

### Variables not replaced

- Check variable syntax: `{{variableName}}` (no spaces)
- Ensure variable is defined in template or is a system variable
- Check variable names match exactly (case-sensitive)

### Email going to spam

- Include unsubscribe link
- Don't use spam trigger words
- Ensure sender domain has proper SPF/DKIM

### Seed script fails

- Ensure `moshimoshi-service-account.json` is in project root
- Check slug uniqueness — run with existing slug will exit with error
- Verify Firebase project matches production

---

## Related Documentation

- [EMAIL_NOTIFICATIONS.md](./EMAIL_NOTIFICATIONS.md) - Admin notification system
- [EMAIL_SUPPRESSION_SYSTEM.md](./EMAIL_SUPPRESSION_SYSTEM.md) - Bounce and unsubscribe handling

---

*Created: 2026-01-27 | Last updated: 2026-02-12*
