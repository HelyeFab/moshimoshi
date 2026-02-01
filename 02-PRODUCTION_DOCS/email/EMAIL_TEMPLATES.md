# Email Templates System

> **Status**: ACTIVE
> **Last Updated**: 2026-01-30
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

### Method 1: Admin UI (Recommended)

1. Go to **Admin → Email Templates** (`/admin/email-templates`)
2. Click **"Create Template"**
3. Choose a starter template or start from scratch
4. Edit content in the visual editor
5. Add custom variables if needed
6. Save and preview

### Method 2: Use Starter Templates

The system includes pre-built starters:

| Starter | Use Case |
|---------|----------|
| Welcome Email | New user onboarding |
| Feature Announcement | Announce new features |
| Streak Reminder | Nudge users to maintain streak |
| Weekly Progress | Weekly stats summary |
| Thank You Note | Express gratitude |
| Newsletter | General announcements |

Access via: **Create Template → Choose Starter**

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

> ⚠️ **Important:** Only templates with `status: 'active'` appear in the Email Campaigns template selector. New templates default to `draft` — remember to activate them before using in campaigns.

---

## HTML Template Structure

Every email template must include the full HTML structure for email client compatibility:

```html
<!DOCTYPE html>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #f5f5f5; margin: 0; padding: 0;">
  <div class="email-container" style="max-width: 600px; margin: 0 auto; padding: 20px; width: 100%;">
    <div class="email-card" style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">

      <!-- YOUR CONTENT HERE -->

    </div>
  </div>
</body>
</html>
```

---

## Brand Assets & Colors

### Logo

```html
<img src="https://moshimoshi.app/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px;" />
```

### Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary (Pink) | `#ec4899` | Buttons, accents |
| Secondary (Purple) | `#8b5cf6` | Gradients |
| Accent (Orange) | `#f97316` | Highlights |
| Text | `#111827` | Body text |
| Text Light | `#6b7280` | Secondary text |
| Text Muted | `#9ca3af` | Footer text |
| Background | `#f5f5f5` | Email background |
| Card Background | `#ffffff` | Content card |
| Border | `#e5e7eb` | Dividers |
| Success | `#10b981` | Checkmarks |
| Error | `#ef4444` | Warnings |

### Gradient Button

```html
<a href="{{url}}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">
  Button Text
</a>
```

---

## Common Components

### Header with Logo

```html
<div style="text-align: center; margin-bottom: 24px;">
  <div style="margin-bottom: 20px;">
    <img src="https://moshimoshi.app/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px;" />
  </div>
  <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #111827;">
    Welcome, {{name}}!
  </h2>
</div>
```

### Character Message - Doshi (Mascot)

```html
<div style="display: flex; align-items: flex-start; gap: 16px; margin: 24px 0; padding: 20px; background: #f5f5f5; border-radius: 12px;">
  <img src="https://moshimoshi.app/doshi.png" alt="Doshi" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />
  <div style="flex: 1;">
    <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827;">Doshi</p>
    <p style="margin: 0; color: #6b7280;">Your message here!</p>
  </div>
</div>
```

### Character Message - Emma (Developer)

```html
<div style="display: flex; align-items: flex-start; gap: 16px; margin: 24px 0; padding: 20px; background: #f5f5f5; border-radius: 12px;">
  <img src="https://moshimoshi.app/doshi-emma.JPG" alt="Emma" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />
  <div style="flex: 1;">
    <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827;">Emma (Developer) 👩‍💻</p>
    <p style="margin: 0; color: #6b7280;">Your message here!</p>
  </div>
</div>
```

### Info Box

```html
<div style="padding: 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">💡 Pro Tip</p>
  <p style="margin: 0; color: #1e40af;">Your tip content here.</p>
</div>
```

### Success Box

```html
<div style="padding: 16px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">✅ Success</p>
  <p style="margin: 0; color: #166534;">Your success message here.</p>
</div>
```

### Warning Box

```html
<div style="padding: 16px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">⚠️ Warning</p>
  <p style="margin: 0; color: #92400e;">Your warning message here.</p>
</div>
```

### Feature List with Checkmarks

```html
<ul style="list-style: none; padding: 0; margin: 16px 0;">
  <li style="margin-bottom: 8px; padding-left: 8px;">
    <span style="color: #10b981; margin-right: 8px;">✓</span>
    Feature one
  </li>
  <li style="margin-bottom: 8px; padding-left: 8px;">
    <span style="color: #10b981; margin-right: 8px;">✓</span>
    Feature two
  </li>
  <li style="margin-bottom: 8px; padding-left: 8px;">
    <span style="color: #10b981; margin-right: 8px;">✓</span>
    Feature three
  </li>
</ul>
```

### CTA Button (Centered)

```html
<div style="text-align: center; margin: 24px 0;">
  <a href="https://moshimoshi.app/en/account" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px;">
    Button Text 🎁
  </a>
</div>
```

### Footer

```html
<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
  <!-- Optional Doshi image -->
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="https://moshimoshi.app/doshi.png" alt="Doshi" style="width: 60px; height: 60px;" />
  </div>

  <!-- Social links -->
  <div style="text-align: center; margin-bottom: 16px;">
    <a href="https://x.com/AppMoshimoshi" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">X</a>
    <span style="color: #e5e7eb;">|</span>
    <a href="https://www.instagram.com/moshimoshi.app/" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">Instagram</a>
    <span style="color: #e5e7eb;">|</span>
    <a href="https://www.tiktok.com/@moshimoshiapp23" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">TikTok</a>
  </div>

  <p style="font-size: 12px; color: #9ca3af;">
    You're receiving this email because you signed up for Moshimoshi.
  </p>
  <p style="font-size: 12px; color: #9ca3af;">
    <a href="{{unsubscribeUrl}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from marketing emails
  </p>
  <p style="font-size: 12px; color: #9ca3af; margin-top: 12px;">
    © 2026 Moshimoshi. All rights reserved.
  </p>
</div>
```

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

You can define custom variables for each template:

```typescript
{
  name: 'doshiMessage',
  label: "Doshi's Message",
  type: 'string',
  defaultValue: "You're doing great!",
  required: false
}
```

**Variable Types:**
- `string` - Text content
- `url` - Links
- `date` - Date values
- `number` - Numeric values

### Using Variables in Content

```html
<p>Hey {{name}},</p>
<p>{{doshiMessage}}</p>
<a href="{{ctaUrl}}">Click Here</a>
```

---

## Creating a Template Step-by-Step

### Step 1: Plan Your Email

Before creating, define:
- **Purpose**: What action do you want the user to take?
- **Audience**: Who receives this?
- **Content**: Key message and CTA
- **Variables**: What needs to be personalized?

### Step 2: Start with the Base Structure

Copy the full HTML structure from above, including:
- DOCTYPE and meta tags
- Responsive CSS
- Container divs

### Step 3: Add the Header

```html
<!-- Header with Logo -->
<div style="text-align: center; margin-bottom: 24px;">
  <div style="margin-bottom: 20px;">
    <img src="https://moshimoshi.app/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px;" />
  </div>
</div>
```

### Step 4: Add Your Content

Build your content using the components above:
- Headings and paragraphs
- Character messages
- Info boxes
- Feature lists
- CTA buttons

### Step 5: Add the Footer

Always include:
- Social links
- Unsubscribe link (`{{unsubscribeUrl}}`)
- Copyright

### Step 6: Create Plain Text Version

Create a simplified text version for email clients that don't render HTML:

```text
Welcome to Moshimoshi, {{name}}!

We're excited to have you...

Doshi says: "Your message here!"

Click here to get started: https://moshimoshi.app/en/account

---
Unsubscribe: {{unsubscribeUrl}}
© 2026 Moshimoshi
```

### Step 7: Define Custom Variables

In the template editor, add any custom variables your template uses.

### Step 8: Preview and Test

1. Use the **Preview** button to see the rendered email
2. Send a **Test Email** to yourself
3. Check on desktop and mobile

### Step 9: Set Status to Active

Once satisfied, change status from `draft` to `active`.

---

## Best Practices

### Do's ✅

- **Use inline styles** - Email clients strip `<style>` tags
- **Include alt text** on images
- **Test on multiple clients** - Gmail, Apple Mail, Outlook
- **Keep subject lines under 50 characters**
- **Always include unsubscribe link**
- **Use absolute URLs** for all links and images
- **Include plain text fallback**
- **Use the default locale in URLs** (`/en/account`)

### Don'ts ❌

- **Don't use external CSS files**
- **Don't use JavaScript**
- **Don't use background images** (poor support)
- **Don't use `position: absolute`**
- **Don't forget mobile responsiveness**
- **Don't use complex layouts** (tables are safer)

---

## Firestore Schema

Templates are stored in `email_templates` collection:

```typescript
{
  id: string,              // Auto-generated
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
  createdBy: string,       // Admin UID
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

> 💡 **Tip:** Set `"status": "active"` if you want the template immediately available in campaigns. Otherwise, update it later via PUT.

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
| `src/lib/email/templates/types.ts` | TypeScript interfaces |
| `src/lib/email/templates/base.ts` | Common HTML builders |
| `src/lib/email/templates/starters.ts` | Pre-built starter templates |
| `src/lib/email/templates/variables.ts` | Variable substitution utilities |
| `src/app/api/admin/templates/route.ts` | API endpoints |
| `src/app/[locale]/admin/email-templates/page.tsx` | Admin list page |
| `src/components/admin/email-templates/TemplateEditor.tsx` | Visual editor |

---

## Troubleshooting

### Images not showing

- Use absolute URLs: `https://moshimoshi.app/doshi.png`
- Check image is publicly accessible
- Some email clients block images by default

### Layout broken on mobile

- Add responsive CSS in `<style>` tag
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

---

## Example: Complete Template

See the "Thank You Discount Gift" template (`99jmdiJX90S2aWe6kpr7`) for a complete example featuring:
- Gift emoji header
- Gradient badge
- Doshi and Emma messages
- Info box
- CTA button
- Full footer

---

## Related Documentation

- [EMAIL_NOTIFICATIONS.md](./EMAIL_NOTIFICATIONS.md) - Admin notification system
- [EMAIL_SUPPRESSION_SYSTEM.md](./EMAIL_SUPPRESSION_SYSTEM.md) - Bounce and unsubscribe handling

---

*Created: 2026-01-27*
