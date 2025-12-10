# PWA API Reference

> Complete API documentation for all Moshimoshi PWA utilities

**Last Updated**: 2025-01-26
**Location**: `/src/lib/pwa/`

---

## Table of Contents

1. [a2hsManager](#a2hsmanager) - Add to Home Screen
2. [entitlements](#entitlements) - Feature gates
3. [badgeManager](#badgemanager) - App badge API
4. [registerServiceWorker](#registerserviceworker) - SW lifecycle
5. [ServiceWorkerProvider](#serviceworkerprovider) - React context
6. [PWAInstallPrompt](#pwainstallprompt) - Install UI component
7. [Document Events](#document-events) - Custom events
8. [Type Definitions](#type-definitions) - TypeScript types

---

## a2hsManager

**Location**: `/src/lib/pwa/a2hs.ts` (244 lines)
**Export**: `a2hsManager` (singleton instance)

Manages Add to Home Screen functionality with engagement-based timing.

### Class: A2HSManager

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `canPrompt()` | `() => boolean` | `boolean` | Check if install prompt available |
| `prompt()` | `() => Promise<Outcome>` | `Promise<'accepted' \| 'dismissed' \| 'not-available'>` | Trigger native install prompt |
| `dismissPrompt()` | `() => void` | `void` | Dismiss and record timestamp |
| `shouldShowPrompt()` | `() => boolean` | `boolean` | Smart timing logic (visits, cooldown) |
| `markPromptShown()` | `() => void` | `void` | Record prompt was displayed |
| `getInstallInstructions()` | `() => Instructions` | `object` | Platform-specific steps |
| `isAppInstalled()` | `() => boolean` | `boolean` | Check if running standalone |
| `onAvailabilityChange()` | `(cb: (available: boolean) => void) => () => void` | Unsubscribe function | Listen for prompt availability |

#### Usage Examples

```typescript
import { a2hsManager } from '@/lib/pwa/a2hs';

// Check if we can show install prompt
if (a2hsManager.canPrompt()) {
  // Use smart timing logic
  if (a2hsManager.shouldShowPrompt()) {
    a2hsManager.markPromptShown();
    // Show your custom install UI
  }
}

// Trigger native install prompt
const result = await a2hsManager.prompt();
if (result === 'accepted') {
  console.log('App installed!');
} else if (result === 'dismissed') {
  console.log('User dismissed, try again in 7 days');
}

// Get platform-specific instructions
const instructions = a2hsManager.getInstallInstructions();
// { platform: 'ios', steps: ['Tap Share button', 'Add to Home Screen', 'Tap Add'] }

// Listen for availability changes
const unsubscribe = a2hsManager.onAvailabilityChange((available) => {
  console.log('Install prompt available:', available);
});
// Later: unsubscribe();
```

#### Timing Logic

| Condition | Threshold | Purpose |
|-----------|-----------|---------|
| Visit count | >= 3 visits | Ensure engagement |
| Last prompt | >= 48 hours | Prevent spam |
| Dismissal cooldown | 7 days | Respect user choice |

#### Platform Detection

```typescript
// Internal methods (not exported)
private isIOS(): boolean     // Detects iPhone/iPad/iPod
private isAndroid(): boolean // Detects Android
private isInStandaloneMode(): boolean // Detects installed PWA
```

---

## entitlements

**Location**: `/src/lib/pwa/entitlements.ts` (77 lines)
**Export**: Named functions

Controls PWA feature access based on user tier.

### Types

```typescript
type UserTier = 'guest' | 'free' | 'premium';
type PlanType = 'guest' | 'free' | 'premium_monthly' | 'premium_yearly';

type FeatureId =
  | 'push'
  | 'bgSync'
  | 'periodicSync'
  | 'shareTarget'
  | 'fsAccess'
  | 'badging'
  | 'mediaSession';
```

### Functions

#### `can(feature, userTier)`

Check if a feature is allowed for a given tier.

```typescript
function can(feature: FeatureId, userTier: UserTier = 'guest'): boolean
```

**Parameters**:
- `feature` - The PWA feature to check
- `userTier` - The user's subscription tier (default: 'guest')

**Returns**: `boolean` - Whether feature is allowed

**Example**:
```typescript
import { can } from '@/lib/pwa/entitlements';

if (can('push', 'free')) {
  // Show notification settings
}

if (can('periodicSync', 'premium')) {
  // Enable daily reminders
}
```

#### `canCurrentUser(feature)`

Check if current user can use a feature.

```typescript
function canCurrentUser(feature: FeatureId): boolean
```

**Example**:
```typescript
import { canCurrentUser } from '@/lib/pwa/entitlements';

if (canCurrentUser('badging')) {
  badgeManager.setBadge(dueCount);
}
```

#### `getCurrentUserTier()`

Get the current user's tier from storage.

```typescript
function getCurrentUserTier(): UserTier
```

**Note**: Reads from `localStorage.getItem('userTier')`.

### Entitlements Matrix

| Feature | Guest | Free | Premium |
|---------|:-----:|:----:|:-------:|
| `push` | - | Yes | Yes |
| `bgSync` | - | Yes | Yes |
| `periodicSync` | - | - | Yes |
| `shareTarget` | - | Yes | Yes |
| `fsAccess` | - | - | Yes |
| `badging` | - | Yes | Yes |
| `mediaSession` | - | Yes | Yes |

---

## badgeManager

**Location**: `/src/lib/pwa/badging.ts` (180 lines)
**Export**: `badgeManager` (singleton instance)

Manages app badge with graceful fallback for unsupported browsers.

### Class: BadgeManager

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `setBadge(count)` | `(count: number) => Promise<boolean>` | `Promise<boolean>` | Set badge count |
| `clearBadge()` | `() => Promise<boolean>` | `Promise<boolean>` | Clear badge (sets to 0) |
| `getBadgeCount()` | `() => number` | `number` | Get current count |
| `getLastUpdated()` | `() => Date` | `Date` | Get last update time |
| `isBadgingSupported()` | `() => boolean` | `boolean` | Check API support |
| `onBadgeChange(cb)` | `(cb: (count: number) => void) => () => void` | Unsubscribe | Listen for changes |
| `updateBadgeFromReviews(due, urgent)` | `(due: number, urgent?: number) => Promise<boolean>` | `Promise<boolean>` | Update from review data |
| `syncWithReviewQueue()` | `() => Promise<void>` | `Promise<void>` | Sync with review engine |

#### Usage Examples

```typescript
import { badgeManager } from '@/lib/pwa/badging';

// Set badge count
await badgeManager.setBadge(5);

// Clear badge
await badgeManager.clearBadge();

// Check support and fallback
if (!badgeManager.isBadgingSupported()) {
  // Use BadgeFallback component instead
}

// Listen for changes (for fallback UI)
const unsubscribe = badgeManager.onBadgeChange((count) => {
  setLocalBadgeCount(count);
});

// Update from review data
await badgeManager.updateBadgeFromReviews(dueCount, urgentCount);
```

#### Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome 81+ | Yes |
| Edge 81+ | Yes |
| Safari 17+ | Yes |
| Firefox | No |
| Samsung Internet | Yes |

#### State Persistence

Badge state is persisted to `localStorage`:
```javascript
// Key: 'badge_state'
// Value: { count: number, lastUpdated: string }
```

---

## registerServiceWorker

**Location**: `/src/lib/pwa/registerServiceWorker.ts` (217 lines)
**Export**: Named functions

Handles service worker registration and lifecycle.

### Functions

#### `registerServiceWorker()`

Register the main service worker.

```typescript
async function registerServiceWorker(): Promise<ServiceWorkerRegistration>
```

**Returns**: Registration result object
```typescript
interface ServiceWorkerRegistration {
  registration: ServiceWorkerRegistration | null;
  isSupported: boolean;
  isRegistered: boolean;
  error: Error | null;
}
```

**Behavior**:
- Only registers in production (or with `NEXT_PUBLIC_ENABLE_SW_DEV`)
- Waits for window load to avoid performance impact
- Checks for updates hourly
- Dispatches `sw-update-available` event on new version

**Example**:
```typescript
import { registerServiceWorker } from '@/lib/pwa/registerServiceWorker';

const result = await registerServiceWorker();
if (result.isRegistered) {
  console.log('SW registered:', result.registration);
}
```

#### `unregisterServiceWorker()`

Unregister all service workers.

```typescript
async function unregisterServiceWorker(): Promise<boolean>
```

**Example**:
```typescript
// Useful for debugging or forced reset
await unregisterServiceWorker();
```

#### `skipWaiting(registration?)`

Activate a waiting service worker.

```typescript
async function skipWaiting(
  providedRegistration?: ServiceWorkerRegistration
): Promise<boolean>
```

**Behavior**:
- Sends `SKIP_WAITING` message to waiting SW
- Reloads page on `controllerchange`
- Falls back to page reload if no waiting SW

**Example**:
```typescript
import { skipWaiting } from '@/lib/pwa/registerServiceWorker';

// From update banner
const handleUpdate = async () => {
  await skipWaiting(registrationFromEvent);
};
```

#### `isStandalone()`

Check if app is running as installed PWA.

```typescript
function isStandalone(): boolean
```

**Detection Methods**:
- `display-mode: standalone` media query
- `navigator.standalone` (iOS Safari)
- `android-app://` referrer
- `?mode=standalone` URL param

**Example**:
```typescript
import { isStandalone } from '@/lib/pwa/registerServiceWorker';

if (isStandalone()) {
  // Hide install prompt, show app-specific UI
}
```

#### `getRegistrationStatus()`

Get current SW registration status.

```typescript
async function getRegistrationStatus(): Promise<{
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isInstalling: boolean;
}>
```

---

## ServiceWorkerProvider

**Location**: `/src/components/pwa/ServiceWorkerProvider.tsx` (152 lines)
**Export**: `ServiceWorkerProvider` (React component)

React context provider for service worker state.

### Component Props

```typescript
interface Props {
  children: React.ReactNode;
}
```

### Provided State

The provider manages:
- Update availability detection
- Critical vs. non-critical updates
- Version checking via `/version.json`
- Update banner visibility

### Usage

```tsx
// In app/layout.tsx
import { ServiceWorkerProvider } from '@/components/pwa/ServiceWorkerProvider';

export default function RootLayout({ children }) {
  return (
    <ServiceWorkerProvider>
      {children}
    </ServiceWorkerProvider>
  );
}
```

### Version Checking

Fetches `/version.json` to detect updates:
```json
{
  "version": "1.0.3",
  "critical": false,
  "message": "Bug fixes and improvements"
}
```

---

## PWAInstallPrompt

**Location**: `/src/components/pwa/PWAInstallPrompt.tsx` (334 lines)
**Export**: `PWAInstallPrompt` (React component)

Custom install prompt with iOS support.

### Features

- Engagement-based timing (3+ visits, 15-30s delay)
- Platform-specific UI (iOS instructions, native prompt)
- Dismissal persistence (7 days)
- Analytics tracking

### Usage

```tsx
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';

// Include in layout
<PWAInstallPrompt />
```

### Timing Logic

| Platform | Trigger |
|----------|---------|
| iOS Safari | After 30 seconds engagement |
| Chrome/Edge | After `beforeinstallprompt` + 15 seconds |
| Already installed | Never shown |

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `pwa_install_dismissed` | Dismissal timestamp |
| `pwa_visit_count` | Visit counter |
| `pwa_installed` | Installation flag |

---

## Document Events

Custom events for PWA coordination.

### `sw-update-available`

Fired when a new service worker version is detected.

```typescript
interface UpdateEvent extends CustomEvent {
  detail: {
    registration: ServiceWorkerRegistration;
  };
}
```

**Listener Example**:
```typescript
window.addEventListener('sw-update-available', (event) => {
  const { registration } = event.detail;
  // Show update banner
});
```

### `dueCountChanged`

Fired when review due count changes (for badge sync).

```typescript
interface DueCountEvent extends CustomEvent {
  detail: {
    count: number;
  };
}
```

**Emitter Example**:
```typescript
document.dispatchEvent(new CustomEvent('dueCountChanged', {
  detail: { count: 5 }
}));
```

---

## Type Definitions

### BeforeInstallPromptEvent

```typescript
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
```

### ServiceWorkerRegistration (Extended)

```typescript
interface ServiceWorkerRegistration {
  registration: ServiceWorkerRegistration | null;
  isSupported: boolean;
  isRegistered: boolean;
  error: Error | null;
}
```

### FeatureId

```typescript
type FeatureId =
  | 'push'
  | 'bgSync'
  | 'periodicSync'
  | 'shareTarget'
  | 'fsAccess'
  | 'badging'
  | 'mediaSession';
```

### UserTier

```typescript
type UserTier = 'guest' | 'free' | 'premium';
```

### BadgeState

```typescript
interface BadgeState {
  count: number;
  lastUpdated: Date;
}
```

### InstallInstructions

```typescript
interface InstallInstructions {
  platform: 'ios' | 'android' | 'desktop';
  steps: string[];
}
```

---

## IndexedDB Client (idbClient)

**Location**: `/src/lib/idb/client.ts`
**Export**: `idbClient` (singleton instance)

PWA data storage wrapper.

### ListsApi Interface

```typescript
interface ListsApi {
  addList(input: {
    title: string;
    type: 'words' | 'sentences' | 'verbs' | 'adjectives';
  }): Promise<string>;

  addItems(
    listId: string,
    items: Array<{ payload: any; tags?: string[] }>
  ): Promise<void>;

  getDueItems(limit?: number): Promise<Array<any>>;

  getDueCount(): Promise<number>;
}
```

### Usage

```typescript
import { idbClient } from '@/lib/idb';

// Get due review count
const dueCount = await idbClient.getDueCount();

// Get due items
const dueItems = await idbClient.getDueItems(10);

// Add a list
const listId = await idbClient.addList({
  title: 'JLPT N5 Vocabulary',
  type: 'words'
});

// Add items to list
await idbClient.addItems(listId, [
  { payload: { word: '日本語', meaning: 'Japanese' }, tags: ['noun'] }
]);
```

---

## Related Documents

- [Architecture Overview](./00-architecture-overview.md) - System design
- [Service Worker Deep Dive](./01-service-worker-deep-dive.md) - SW internals
- [Best Practices 2025](./03-best-practices-2025.md) - Usage patterns
- [Troubleshooting Guide](./04-troubleshooting-guide.md) - Common issues

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-26 | Initial API reference documentation |
