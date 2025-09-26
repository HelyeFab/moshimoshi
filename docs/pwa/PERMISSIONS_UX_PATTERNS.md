# PWA Permissions UX Patterns - Moshimoshi

## Overview
This document outlines best practices for requesting and managing PWA permissions in Moshimoshi, ensuring a user-friendly experience that maximizes opt-in rates while respecting user preferences.

## Core Principles

### 1. **Context-First Requests**
Never request permissions immediately on page load. Always provide context about WHY you need the permission first.

### 2. **Progressive Disclosure**
Request permissions only when the user needs the feature, not preemptively.

### 3. **Graceful Degradation**
Always provide fallback experiences when permissions are denied or APIs are unsupported.

### 4. **User Control**
Give users easy ways to manage and revoke permissions within the app.

## Permission Types & Strategies

### 📱 Install Prompt (A2HS)

**When to Show:**
- After 3+ visits to the site
- User has engaged with content (e.g., completed a lesson)
- At least 48 hours since last dismissal

**Implementation:**
```typescript
// src/components/pwa/A2HSPrompt.tsx
if (a2hsManager.shouldShowPrompt()) {
  setTimeout(() => setShowPrompt(true), 3000) // 3-second delay
}
```

**UX Pattern:**
1. Slide-in prompt from bottom on mobile, bottom-right on desktop
2. Clear benefits listed (offline access, faster loading, notifications)
3. Platform-specific instructions for iOS
4. "Not Now" option that dismisses for 14 days

### 🔔 Notifications

**When to Request:**
- After user completes first review session
- When user explores settings
- When user sets review goals

**Never Request:**
- On first visit
- Before user has created an account
- Immediately after install

**Implementation:**
```typescript
// src/components/pwa/NotificationPermissionFlow.tsx
if (notificationManager.shouldPromptForPermission()) {
  // Show custom UI first, then request permission
  setShowPrompt(true)
}
```

**UX Pattern:**
1. Custom pre-permission dialog explaining benefits
2. "Test Notification" button after granting
3. Quiet Hours settings immediately available
4. Clear instructions if blocked

### 📤 Share Target

**Setup:**
- Automatically enabled when app is installed
- No permission request needed
- Provide tutorial on first use

**UX Pattern:**
1. Modal opens when content is shared to app
2. Preview of shared content
3. List selection or creation
4. Success confirmation with navigation option

### 🎵 Media Session

**When to Enable:**
- Automatically when TTS playback starts
- No explicit permission needed

**UX Pattern:**
1. System media controls appear automatically
2. Show current text being spoken
3. Previous/Next navigate between sentences
4. Playback speed control

### 🔢 Badging

**When to Enable:**
- After notifications are enabled
- When review items are due

**Fallback Pattern:**
1. If API unsupported, show in-app badge
2. Position: top-right corner
3. Dismissible with X button
4. Animate on count change

## Error States & Recovery

### Permission Denied
```typescript
// Show helpful message with browser-specific instructions
if (permission === 'denied') {
  return <PermissionBlockedMessage
    browserInstructions={getBrowserInstructions()}
  />
}
```

### API Unsupported
```typescript
// Always check support before using
if (!notificationManager.isSupported()) {
  return <UnsupportedBrowserMessage />
}
```

## Timing Guidelines

### Visit-Based Triggers
- Install prompt: 3+ visits
- Notifications: 5+ visits
- Premium features: After trial period

### Engagement-Based Triggers
- After completing first lesson
- After setting study goals
- After streak achievement

### Time-Based Delays
- Page load → First prompt: 3-5 seconds minimum
- Dismissal → Re-prompt: 7-14 days
- Install → Notification request: 24 hours

## Visual Design Patterns

### Prompt Components
```css
/* Consistent styling across all permission prompts */
.permission-prompt {
  background: theme('colors.soft-white');
  border-radius: 1rem;
  shadow: theme('shadows.2xl');
  animation: slide-in 0.3s ease-out;
}
```

### Animation Patterns
- **Entry:** Slide in from edge or fade in
- **Exit:** Fade out or slide away
- **Attention:** Subtle pulse on important actions

### Icon Usage
- ✅ Check marks for granted permissions
- ⚠️ Warning icons for blocked permissions
- 🔔 Bell for notifications
- 📱 Phone for install prompts

## Analytics & Tracking

### Events to Track
```typescript
// Track all permission interactions
gtag('event', 'permission_requested', { type: 'notification' })
gtag('event', 'permission_granted', { type: 'notification' })
gtag('event', 'permission_denied', { type: 'notification' })
gtag('event', 'permission_dismissed', { type: 'notification' })
```

### Metrics to Monitor
- Grant rate by trigger type
- Time to permission request
- Re-engagement after denial
- Feature usage after granting

## Testing Checklist

### Permission States
- [ ] First-time user (no permissions)
- [ ] Returning user (some permissions)
- [ ] Power user (all permissions)
- [ ] Blocked permissions recovery

### Browser Support
- [ ] Chrome/Edge (full support)
- [ ] Safari/iOS (limited support)
- [ ] Firefox (partial support)
- [ ] Samsung Internet

### User Journeys
- [ ] Guest → Free → Premium flow
- [ ] Install → Setup → Engage flow
- [ ] Permission denial → Recovery flow

## Implementation Examples

### Custom Hook Pattern
```typescript
export function usePermissionRequest(type: PermissionType) {
  const [status, setStatus] = useState<PermissionState>('prompt')
  const [showCustomUI, setShowCustomUI] = useState(false)

  const request = async () => {
    // Show custom UI first
    setShowCustomUI(true)
    // Wait for user interaction
    // Then request actual permission
  }

  return { status, showCustomUI, request }
}
```

### Entitlement Integration
```typescript
// Always check entitlements before showing permission UI
if (!canCurrentUser('push')) {
  return <UpgradePrompt feature="notifications" />
}
```

## Best Practices Summary

### ✅ DO
- Explain value before requesting
- Provide graceful fallbacks
- Respect user dismissals
- Track and optimize grant rates
- Test across all browsers

### ❌ DON'T
- Request on first page load
- Request multiple permissions at once
- Re-prompt too frequently
- Ignore browser differences
- Force permissions for core features

## Component Library

### Available Components
- `<A2HSPrompt />` - Install prompt with smart timing
- `<NotificationPermissionFlow />` - Notification request flow
- `<BadgeFallback />` - Visual badge for unsupported browsers
- `<ShareHandler />` - Share target content handler

### Usage Example
```tsx
function App() {
  return (
    <>
      <A2HSPrompt />
      <NotificationPermissionFlow />
      <BadgeFallback position="top-right" />
    </>
  )
}
```

## Troubleshooting

### Common Issues

**Issue:** Low permission grant rates
**Solution:** Improve context, delay request timing

**Issue:** iOS install instructions unclear
**Solution:** Use visual guide with screenshots

**Issue:** Notifications blocked by browser
**Solution:** Provide clear unblock instructions

**Issue:** Badge not updating
**Solution:** Check entitlements and API support

## Resources

- [Web App Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
- [Badging API](https://developer.mozilla.org/en-US/docs/Web/API/Badging_API)

---

Last Updated: 2025-01-26
Author: Agent 2 - UX & Web APIs