# User Agent Tracking

**Status:** ACTIVE
**Last Updated:** 2026-01-29
**Initial Implementation:** (pending commit)

## Overview

Comprehensive user agent tracking system for support and feedback forms that automatically captures detailed browser, device, and system information when users submit contact forms or feedback. This information helps the support team diagnose issues more effectively and understand the user's technical environment.

### Problem Solved

Support requests and feedback often lack crucial technical context:
- "The app doesn't work" - but on what browser?
- "I'm seeing an error" - but what's their screen resolution?
- Bug reports without environment details

### Solution

A **comprehensive user agent tracking system** that:
1. Automatically captures 10 data points about the user's environment
2. Includes formatted technical details in all support emails
3. Uses a reusable React hook (`useUserAgent`)
4. Formats data in a clean, readable email section
5. Respects privacy (disclosed in privacy policy)

---

## Quick Start

### For Users

User agent tracking is **automatic and transparent**:
1. Fill out any contact or feedback form
2. Submit normally
3. Technical details are automatically included
4. Disclosed in privacy policy (all 6 languages)

### For Developers

**Add to any form in 3 steps:**

```tsx
import { useUserAgent } from '@/hooks/useUserAgent'

export function MyContactForm() {
  // 1. Use the hook
  const userAgent = useUserAgent()

  // 2. Include in form submission
  const handleSubmit = async () => {
    await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        ...formData,
        userAgent  // ← Add this
      })
    })
  }

  // 3. Update API route to use formatUserAgentForEmail()
}
```

---

## Architecture

### System Flow

```
User fills form
     ↓
useUserAgent() hook captures environment data
     ↓
Form submits with userAgent object
     ↓
API route receives data
     ↓
formatUserAgentForEmail() creates HTML section
     ↓
Email sent via Resend with formatted technical details
```

### Data Captured

| Field | Example | Purpose |
|-------|---------|---------|
| **browser** | Chrome | Identify browser-specific issues |
| **browserVersion** | 120.0.6099.129 | Version-specific bugs |
| **os** | Windows | OS compatibility issues |
| **osVersion** | 11 | Version-specific problems |
| **device** | Desktop | Mobile vs desktop issues |
| **screen** | 1920x1080 | Layout/responsive issues |
| **viewport** | 1536x864 | Actual viewing area |
| **userAgent** | Mozilla/5.0... | Full technical string |
| **timezone** | America/New_York | Time-related issues |
| **language** | en-US | Localization problems |

### Components

1. **useUserAgent Hook** (`src/hooks/useUserAgent.ts`)
   - Uses ua-parser-js library for parsing
   - Returns typed `UserAgentInfo` object
   - Graceful fallback if unavailable

2. **formatUserAgentForEmail()** (`src/hooks/useUserAgent.ts`)
   - Formats data as HTML for emails
   - Clean table layout
   - Option B: Detailed Section format

3. **Forms Using the Hook:**
   - ContactPage (`/contact`)
   - FeedbackWidget (floating button)

4. **API Routes:**
   - `/api/contact` - Contact form emails
   - `/api/support/feedback` - Feedback widget emails

---

## Implementation Details

### useUserAgent Hook

```typescript
interface UserAgentInfo {
  browser: string          // 'Chrome'
  browserVersion: string   // '120.0.6099.129'
  os: string              // 'Windows'
  osVersion: string       // '11'
  device: string          // 'Desktop' | 'Mobile' | 'Tablet'
  screen: string          // '1920x1080'
  viewport: string        // '1536x864'
  userAgent: string       // Full UA string
  timezone: string        // 'America/New_York'
  language: string        // 'en-US'
}
```

**Dependencies:**
- `ua-parser-js` - User agent string parsing

**Usage:**
```tsx
const userAgent = useUserAgent()  // null initially, then populates
```

### Email Format (Option B - Detailed)

```
TECHNICAL DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Browser:           Chrome 120.0.6099.129
Operating System:  Windows 11
Device:            Desktop
Screen:            1920x1080
Viewport:          1536x864
Timezone:          America/New_York
Language:          en-US
User Agent:        Mozilla/5.0 (Windows NT 10.0...)
```

### API Integration

**Contact API** (`/api/contact/route.ts`):
```typescript
import { formatUserAgentForEmail } from '@/hooks/useUserAgent'

const { userAgent } = await request.json()

const emailContent = `
  ...
  ${userAgent ? formatUserAgentForEmail(userAgent) : ''}
  ...
`
```

**Feedback API** (`/api/support/feedback/route.ts`):
- New endpoint created
- Same pattern as contact API
- Category-based email routing

---

## Forms Integration

### 1. Contact Page

**Location:** `src/app/[locale]/contact/ContactPage.tsx`

**Changes:**
```typescript
import { useUserAgent } from '@/hooks/useUserAgent'

// Line 16: Add hook
const userAgent = useUserAgent()

// Line 113-117: Include in submission
body: JSON.stringify({
  ...formData,
  to: emailMap[formData.category] || 'support@moshimoshi.app',
  userAgent: userAgent  // ← Added
})
```

### 2. Feedback Widget

**Location:** `src/components/support/FeedbackWidget.tsx`

**Changes:**
```typescript
import { useUserAgent } from '@/hooks/useUserAgent'

// Line 11: Add hook
const userAgent = useUserAgent()

// Line 26-34: Replace navigator.userAgent
userAgent: userAgent  // ← Now uses full object
```

---

## Privacy Compliance

### Privacy Policy Updates

**Added to all 6 languages** (en, ja, fr, it, de, es):

> **Technical Information**: When you contact us via forms, we automatically collect technical information about your device and browser (browser type and version, operating system, screen resolution, timezone, and language settings) to help us provide better support and diagnose technical issues.

### Disclosure Locations

- Privacy Policy page (`/privacy`)
- No in-form notice (not required, disclosed in PP)

### Data Retention

- Stored in emails only
- Not persisted to database
- Subject to email retention policies

---

## Testing

### Manual Testing Checklist

**Contact Form:**
- [ ] Navigate to `/contact`
- [ ] Fill out form completely
- [ ] Submit form
- [ ] Verify email received with "TECHNICAL DETAILS" section
- [ ] Check all 10 fields populated correctly

**Feedback Widget:**
- [ ] Click feedback button (bottom-right)
- [ ] Fill category and message
- [ ] Submit feedback
- [ ] Verify email received with technical details

**Different Environments:**
- [ ] Test on Chrome (Desktop)
- [ ] Test on Safari (macOS)
- [ ] Test on Firefox (Windows)
- [ ] Test on Mobile Chrome (Android)
- [ ] Test on Mobile Safari (iOS)

**Edge Cases:**
- [ ] SSR (should handle gracefully)
- [ ] Blocked JavaScript (should degrade)
- [ ] Privacy-focused browser (should still work)

### Automated Testing

```typescript
// useUserAgent.test.ts
import { renderHook } from '@testing-library/react'
import { useUserAgent } from '@/hooks/useUserAgent'

describe('useUserAgent', () => {
  it('should return null on server', () => {
    const { result } = renderHook(() => useUserAgent())
    expect(result.current).toBeNull()
  })

  it('should parse user agent on client', () => {
    const { result } = renderHook(() => useUserAgent())
    expect(result.current).toHaveProperty('browser')
    expect(result.current).toHaveProperty('os')
  })
})
```

---

## Key Files

| File | Description |
|------|-------------|
| `src/hooks/useUserAgent.ts` | Main hook + formatting function |
| `src/app/[locale]/contact/ContactPage.tsx:16,113` | Contact form integration |
| `src/components/support/FeedbackWidget.tsx:11,26` | Feedback widget integration |
| `src/app/api/contact/route.ts:3-4,8,52` | Contact API integration |
| `src/app/api/support/feedback/route.ts` | Feedback API (new file) |

---

## Dependencies

**New dependency added:**
```bash
npm install ua-parser-js
npm install -D @types/ua-parser-js
```

**Why ua-parser-js?**
- Industry-standard UA parsing library
- Handles edge cases and new browsers
- Regular updates
- TypeScript support
- 20MB+ UA database

---

## Future Enhancements

- [ ] Add performance metrics (page load time, etc.)
- [ ] Add network information (connection type)
- [ ] Add installed PWA detection
- [ ] Add battery level (if permission granted)
- [ ] Dashboard for analyzing support patterns by browser/OS
- [ ] Automatic bug priority based on environment

---

## Troubleshooting

### "ua-parser-js not found"

```bash
npm install ua-parser-js @types/ua-parser-js
```

### User agent data is null

**Cause:** Server-side rendering or hook not mounted yet

**Solution:** Normal behavior, wait for client-side hydration

### Email missing technical details

**Cause:** userAgent not passed to API

**Fix:**
1. Check form submission includes `userAgent: userAgent`
2. Check API route imports `formatUserAgentForEmail`
3. Check API route calls formatting function

### Wrong browser/OS detected

**Cause:** UA string parsing issue

**Solution:** Check ua-parser-js updates, may need library update

---

## Related Documentation

- [Email Templates](../email/EMAIL_TEMPLATES.md)
- [Contact Form](../../src/app/[locale]/contact/ContactPage.tsx)
- [Resend Integration](../email/EMAIL_NOTIFICATIONS.md)

---

*Last Updated: 2026-01-29*
