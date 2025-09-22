# In-App Notification System Integration Guide

## Agent 2 Deliverables Completed

### ✅ Components Created
1. **InAppNotificationProvider** - Main provider with toast and countdown management
2. **NotificationToast** - Theme-aware toast notifications
3. **ReviewCountdown** - Real-time countdown timers
4. **NotificationSettings** - User preference management UI
5. **NotificationCenter** - View all notifications

### ✅ Hooks Created
1. **useInAppNotifications** - Core notification management (exported from Provider)
2. **useNotificationPreferences** - Settings and preference management
3. **useNotificationIntegration** - Review Engine integration

### ✅ i18n Support
- All notification strings added to English locale
- Ready for translation to other languages

## Integration Instructions

### 1. Add Provider to App Layout

```tsx
// In your root layout or _app.tsx
import { InAppNotificationProvider } from '@/components/notifications/InAppNotificationProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <InAppNotificationProvider>
          {children}
        </InAppNotificationProvider>
      </body>
    </html>
  )
}
```

### 2. Use in Review Components

```tsx
import { useNotificationIntegration } from '@/hooks/useNotificationIntegration'

export function ReviewSession() {
  const { requestBrowserPermission } = useNotificationIntegration()

  useEffect(() => {
    // Request permission on first use
    requestBrowserPermission()
  }, [])

  // Notifications will automatically trigger based on Review Engine events
  return <div>...</div>
}
```

### 3. Add Settings Page

```tsx
import { NotificationSettings } from '@/components/notifications/NotificationSettings'

export function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <NotificationSettings />
    </div>
  )
}
```

### 4. Add Notification Center (optional dropdown)

```tsx
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { Bell } from 'lucide-react'

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}>
        <Bell className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2">
          <NotificationCenter />
        </div>
      )}
    </div>
  )
}
```

## Review Engine Event Integration

The system automatically listens for these Review Engine events:

- `ITEM_ANSWERED` - Schedules notifications for next review
- `SESSION_COMPLETED` - Shows session summary
- `ACHIEVEMENT_UNLOCKED` - Celebrates achievements
- `STREAK_UPDATED` - Announces new streak records

## Features Implemented

### Real-time Countdown Timers
- Shows countdown for reviews due in < 1 hour
- Persists across page refreshes (localStorage)
- Auto-converts to "Due now!" notification

### Browser Notifications
- Permission request flow
- Desktop notifications with actions
- Click to navigate to review

### In-App Toast Notifications
- Theme-aware styling
- Auto-dismiss with progress bar
- Persistent notifications for important alerts

### User Preferences
- Per-channel enable/disable
- Quiet hours support
- Notification batching settings
- Timezone-aware scheduling

### Sound Support
- Plays notification sound for due reviews
- Volume control at 50%
- Graceful fallback if audio not supported

## Testing

### Manual Testing
```tsx
import { useInAppNotifications } from '@/components/notifications/InAppNotificationProvider'

function TestButton() {
  const { addNotification, addCountdown } = useInAppNotifications()

  const testNotification = () => {
    addNotification({
      title: 'Test Notification',
      body: 'This is a test',
      type: 'info',
      persistent: false
    })
  }

  const testCountdown = () => {
    const future = new Date(Date.now() + 30000) // 30 seconds
    addCountdown('test-item', future)
  }

  return (
    <>
      <button onClick={testNotification}>Test Toast</button>
      <button onClick={testCountdown}>Test Countdown</button>
    </>
  )
}
```

## Notes for Other Agents

### Agent 1 (Core Service)
- InAppNotificationProvider expects orchestrator events on `window`
- Uses custom event: `window.dispatchEvent(new CustomEvent('review:event', { detail: eventData }))`

### Agent 3 (Service Worker)
- Notification sound file needed at `/public/sounds/notification.mp3`
- Service worker can communicate with provider via postMessage

### Agent 4 (Testing)
- All components are fully typed with TypeScript
- Components use existing Toast context for consistency
- Review Engine integration via custom events

## File Locations
```
src/
├── components/notifications/
│   ├── InAppNotificationProvider.tsx
│   ├── NotificationToast.tsx
│   ├── ReviewCountdown.tsx
│   ├── NotificationCenter.tsx
│   └── NotificationSettings.tsx
├── hooks/
│   ├── useNotificationPreferences.ts
│   └── useNotificationIntegration.ts
└── i18n/locales/en/strings.ts (updated with notification strings)

public/
└── sounds/
    └── README.md (instructions for adding notification.mp3)
```

## Status
✅ Agent 2 implementation complete
✅ Ready for integration with other agents
✅ All UI components theme-aware
✅ Full i18n support
✅ TypeScript typed