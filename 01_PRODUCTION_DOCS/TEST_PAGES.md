# Moshimoshi Test Pages

This document lists all available test and demo pages for development and QA purposes.

## Available Test Pages

### 🏘️ Village Layout Personalization Test

**URL**: `/test-village-personalization`

**Purpose**: Test and visualize how learning goals affect the Learning Village dashboard layout

**Features**:
- Interactive goal selection (JLPT, Anime, Travel, Conversation)
- Live preview of district order
- Update your account's goal directly
- Comparison table for all goals
- Technical details and debugging info

**When to Use**:
- Testing onboarding personalization
- Demonstrating the feature to stakeholders
- Verifying layout changes after code updates
- QA testing before deployment

**Documentation**: `/src/app/[locale]/test-village-personalization/README.md`

---

### 📧 Email Test Page

**URL**: `/test-email`

**Purpose**: Test email sending functionality

---

### ✍️ Furigana Test Page

**URL**: `/test-furigana`

**Purpose**: Test furigana (ruby text) rendering

---

### 💳 Pricing Test Pages

**URLs**:
- `/test-pricing` - Main pricing test
- `/test-pricing/alternative` - Alternative pricing layout

**Purpose**: Test pricing page layouts and Stripe integration

---

### 🔐 Entitlements Test Page

**URL**: `/test-entitlements`

**Purpose**: Test entitlement system and feature flags

---

### 🔔 Notifications Test Pages

**URLs**:
- `/test-notifications` - General notifications
- `/notifications-demo` - Notification components demo

**Purpose**: Test push notifications and in-app notifications

---

### 🃏 Flashcards Test Page

**URL**: `/test-flashcards`

**Purpose**: Test flashcard functionality and UI

---

### 🗣️ TTS Demo Page

**URL**: `/tts-demo`

**Purpose**: Test text-to-speech functionality

---

### 🎭 Modal Test Page

**URL**: `/test-modal`

**Purpose**: Test modal dialogs and overlays

---

### 🔑 Auth Test Page

**URL**: `/auth-test`

**Purpose**: Test authentication flows and session management

---

### 💰 Stripe Testing (Admin)

**URL**: `/admin/stripe-testing`

**Purpose**: Admin-only Stripe integration testing

**Access**: Requires admin privileges

---

### 📰 NHK Demo

**URL**: `/demo/nhk`

**Purpose**: Demo of NHK news integration

---

## Using Test Pages

### General Guidelines

1. **Development Only**: Some test pages should not be accessible in production
2. **Clean Up**: Test pages may create test data - clean up after testing
3. **Access Control**: Some pages require authentication or admin access
4. **Documentation**: Each test page should have inline documentation

### Best Practices

1. **Before Deployment**:
   - Run through all test pages
   - Verify functionality works as expected
   - Check for console errors
   - Test on mobile and desktop

2. **After Code Changes**:
   - Test affected features
   - Verify no regressions
   - Update test pages if needed

3. **For QA**:
   - Use test pages to verify user stories
   - Document any issues found
   - Include screenshots in bug reports

## Creating New Test Pages

When creating a new test page:

1. **Location**: `/src/app/[locale]/test-[feature-name]/page.tsx`
2. **Documentation**: Include a `README.md` in the same directory
3. **Naming**: Use `test-` or `demo-` prefix
4. **Update This File**: Add entry to this document
5. **Add Comments**: Explain purpose and usage in code

### Template Structure

```tsx
'use client'

import { useState } from 'react'

export default function TestFeatureName() {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            🧪 Feature Name Test Page
          </h1>
          <p className="text-gray-600 mt-2">
            Description of what this page tests
          </p>
        </div>

        {/* Test Content */}
        <div className="space-y-6">
          {/* Your test components */}
        </div>

        {/* Technical Info */}
        <div className="mt-8 p-4 bg-gray-900 text-gray-100 rounded-lg">
          <h3 className="font-bold mb-2">Technical Details</h3>
          {/* Debug info */}
        </div>
      </div>
    </div>
  )
}
```

## Production Considerations

### Test Pages in Production

**Recommendation**: Hide test pages in production environment

**Options**:
1. **Environment Check**: Only render in development
2. **Feature Flag**: Use feature flag system
3. **Admin Only**: Require admin authentication
4. **Remove**: Don't include in production build

**Example**:
```tsx
export default function TestPage() {
  if (process.env.NODE_ENV === 'production') {
    return <div>Not available in production</div>
  }

  return <TestContent />
}
```

### Security

- Never expose sensitive data on test pages
- Sanitize all test data before display
- Require authentication for data-modifying tests
- Log all test page access for audit

## Maintenance

- Review test pages quarterly
- Remove obsolete test pages
- Update documentation when features change
- Ensure all test pages still work after major updates

---

Last Updated: 2026-01-10
