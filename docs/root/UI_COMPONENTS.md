# UI Components Documentation

## Overview
Moshimoshi includes a comprehensive set of mobile-first UI components designed for modern PWAs. All components support the theme system (light/dark modes) and feature Doshi, our red panda mascot, for a friendly user experience.

## Components List

### Core Layout Components
1. **PageContainer** - Page wrapper with gradients and patterns
2. **Section** - Content sections with consistent styling
3. **PageHeader** - Page titles with Doshi mascot support
4. **Navbar** - Unified navigation bar used across all pages
5. **LearningPageHeader** - Special header for learning pages with mode controls

### Data Display
5. **StatCard** - Statistics and metrics display cards
6. **Loading Components** - Spinners, skeletons, and overlays
7. **Alert** - Informational alerts and banners
8. **Tooltip** - Contextual help tooltips

### Interactive Components
9. **Modal** - Accessible modal dialogs
10. **Dialog** - Confirmation dialogs
11. **Drawer** - Mobile-friendly sliding panels
12. **Toast Notifications** - Transient messages

### Form Controls
13. **SettingToggle** - Toggle switches for settings

### Branding
14. **MoshimoshiLogo** - Brand logo with Doshi
15. **DoshiMascot** - Red panda mascot component

---

## Component Details

### 1. Toast Notifications (`/components/ui/Toast/`)
A flexible toast notification system with multiple positions and types.

#### Usage:
```tsx
// In your root layout or _app.tsx
import { ToastProvider } from '@/components/ui/Toast';

<ToastProvider defaultPosition="bottom" maxToasts={5}>
  {children}
</ToastProvider>

// In any component
import { useToast } from '@/components/ui/Toast';

const { showToast } = useToast();

// Show different types of toasts
showToast('Success!', 'success');
showToast('Error occurred', 'error', 5000);
showToast('Warning message', 'warning', 4000, {
  label: 'Undo',
  onClick: () => console.log('Undo clicked')
});
```

#### Props:
- `message`: string - Toast message
- `type`: 'success' | 'error' | 'warning' | 'info' - Toast type
- `duration`: number - Auto-dismiss duration (ms)
- `action`: object - Optional action button
- `position`: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

---

### 2. Modal (`/components/ui/Modal.tsx`)
A fully accessible modal component with customizable sizes and behaviors.

#### Usage:
```tsx
import Modal from '@/components/ui/Modal';

<Modal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Confirm Action"
  size="md"
>
  <p>Are you sure you want to proceed?</p>
</Modal>
```

#### Props:
- `isOpen`: boolean - Control modal visibility
- `onClose`: () => void - Close handler
- `title`: string - Modal title
- `size`: 'sm' | 'md' | 'lg' | 'xl' | 'full' - Modal size
- `closeOnOverlayClick`: boolean - Close when clicking overlay
- `closeOnEsc`: boolean - Close on ESC key
- `showCloseButton`: boolean - Show close button

---

### 3. Dialog (`/components/ui/Dialog.tsx`)
A confirmation dialog component built on top of Modal.

#### Usage:
```tsx
import Dialog from '@/components/ui/Dialog';

<Dialog
  isOpen={showDialog}
  onClose={() => setShowDialog(false)}
  onConfirm={handleDelete}
  title="Delete Item"
  message="This action cannot be undone."
  type="danger"
  confirmText="Delete"
  cancelText="Cancel"
/>
```

#### Props:
- `type`: 'info' | 'warning' | 'danger' | 'success' - Dialog type
- `confirmText`: string - Confirm button text
- `cancelText`: string - Cancel button text
- `isLoading`: boolean - Show loading state
- `showIcon`: boolean - Show type icon

---

### 4. Drawer (`/components/ui/Drawer.tsx`)
A mobile-friendly drawer/sheet component with swipe gestures.

#### Usage:
```tsx
import Drawer from '@/components/ui/Drawer';

<Drawer
  isOpen={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  position="bottom"
  title="Menu"
  showDoshi={true}
>
  <nav>
    {/* Navigation items */}
  </nav>
</Drawer>
```

#### Props:
- `position`: 'left' | 'right' | 'top' | 'bottom' - Drawer position
- `size`: 'small' | 'medium' | 'large' | 'full' - Drawer size
- `showDoshi`: boolean - Show Doshi mascot in header
- `title`: string - Drawer title

#### Mobile Features:
- Swipe to close gesture
- Touch-optimized handle for bottom drawer
- Smooth animations

---

### 5. Loading Components (`/components/ui/Loading.tsx`)
Various loading states and spinners.

#### Components:
```tsx
import { 
  LoadingSpinner, 
  LoadingDots, 
  LoadingSkeleton,
  LoadingPage,
  LoadingOverlay,
  LoadingButton 
} from '@/components/ui/Loading';

// Simple spinner
<LoadingSpinner size="medium" />

// Animated dots
<LoadingDots size="small" />

// Skeleton loader
<LoadingSkeleton lines={3} showAvatar={true} />

// Full page loading
<LoadingPage message="Loading your content..." showDoshi={true} />

// Loading overlay
<LoadingOverlay isLoading={isLoading} message="Processing..." />

// Button with loading state
<LoadingButton 
  isLoading={isSubmitting}
  loadingText="Saving..."
  onClick={handleSubmit}
>
  Save Changes
</LoadingButton>
```

---

### 6. Alert (`/components/ui/Alert.tsx`)
Informational alert components with optional Doshi mascot.

#### Usage:
```tsx
import Alert, { BannerAlert } from '@/components/ui/Alert';

// Standard alert
<Alert
  type="success"
  title="Success!"
  message="Your changes have been saved."
  dismissible={true}
  showDoshi={true}
  action={{
    label: 'View Details',
    onClick: () => console.log('View')
  }}
/>

// Banner alert (full-width)
<BannerAlert
  type="warning"
  message="System maintenance scheduled"
  fixed={true}
  position="top"
  dismissible={true}
/>
```

#### Props:
- `type`: 'info' | 'success' | 'warning' | 'error' - Alert type
- `showDoshi`: boolean - Show Doshi with appropriate mood
- `doshiMood`: Doshi's mood expression
- `dismissible`: boolean - Can be dismissed
- `action`: object - Optional action button

---

### 7. Tooltip (`/components/ui/Tooltip.tsx`)
Accessible tooltip component with smart positioning.

#### Usage:
```tsx
import Tooltip from '@/components/ui/Tooltip';

<Tooltip content="This is helpful information" position="top">
  <button>Hover me</button>
</Tooltip>

// With custom content
<Tooltip 
  content={
    <div>
      <strong>Pro tip:</strong>
      <p>Use keyboard shortcuts for faster navigation</p>
    </div>
  }
  delay={500}
>
  <span>ℹ️</span>
</Tooltip>
```

#### Props:
- `content`: React.ReactNode - Tooltip content
- `position`: 'top' | 'bottom' | 'left' | 'right' - Position
- `delay`: number - Show delay in ms
- `disabled`: boolean - Disable tooltip

#### Features:
- Auto-repositioning when near screen edges
- Touch support for mobile devices
- Keyboard accessible

---

### 8. Navbar (`/components/layout/Navbar.tsx`)
A reusable navigation bar component with Japanese branding and user menu.

#### Usage:
```tsx
import Navbar from '@/components/layout/Navbar';

// With user menu
<Navbar 
  user={{
    email: 'user@example.com',
    displayName: 'John Doe',
    photoURL: '/profile.jpg'
  }}
  showUserMenu={true}
/>

// With back link (for settings/account pages)
<Navbar 
  user={user}
  backLink={{
    href: '/dashboard',
    label: '← Back to Dashboard'
  }}
/>
```

#### Props:
- `user`: object - User data (email, displayName, photoURL)
- `showUserMenu`: boolean - Show user dropdown menu
- `backLink`: object - Optional back navigation link

#### Features:
- Japanese character "も" (mo) logo with bounce animation
- MoshimoshiLogo with animated Doshi mascot
- Theme toggle integration
- User dropdown with:
  - Profile link
  - Settings link
  - Admin dashboard (for admin users)
  - Sign out option
- Mobile-responsive design
- Sticky positioning with backdrop blur

---

### 9. MoshimoshiLogo (`/components/ui/MoshimoshiLogo.tsx`)
Brand logo component featuring Doshi as the letter 'o'.

#### Usage:
```tsx
import MoshimoshiLogo, { MoshimoshiLogoHero } from '@/components/ui/MoshimoshiLogo';

// Standard logo
<MoshimoshiLogo 
  size="medium"
  animated={true}
  variant="inline"
/>

// Hero version for landing pages
<MoshimoshiLogoHero animated={true} />

// Stacked variant
<MoshimoshiLogo 
  size="large"
  variant="stacked"
/>
```

#### Props:
- `size`: 'small' | 'medium' | 'large' | 'xlarge' - Logo size
- `animated`: boolean - Use animated Doshi (Lottie animation)
- `variant`: 'inline' | 'stacked' - Layout variant
- `className`: string - Additional CSS classes

#### Features:
- Replaces 'o' letters with Doshi mascot
- Lottie animation support for animated variant
- Multiple size presets
- Stacked variant for vertical layouts

---

### 10. Doshi Mascot (`/components/ui/DoshiMascot.tsx`)
Our friendly red panda mascot component.

#### Usage:
```tsx
import DoshiMascot, { DoshiLoading } from '@/components/ui/DoshiMascot';

// Interactive Doshi
<DoshiMascot 
  size="medium"
  mood="happy"
  variant="animated"
  onClick={() => console.log('Doshi clicked!')}
/>

// Loading state with Doshi
<DoshiLoading size="large" />
```

#### Props:
- `size`: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'
- `mood`: 'happy' | 'sad' | 'excited' | 'thinking' | 'sleeping' | 'waving'
- `variant`: 'static' | 'animated' | 'auto'
- `onClick`: () => void - Click handler

#### Moods:
- 😊 Happy - Default friendly state
- 😢 Sad - Error states
- 🎉 Excited - Success states
- 🤔 Thinking - Loading/processing
- 😴 Sleeping - Idle states
- 👋 Waving - Greetings

---

### 11. PageContainer (`/components/ui/PageContainer.tsx`)
A consistent page wrapper with gradient backgrounds and optional patterns.

#### Usage:
```tsx
import PageContainer from '@/components/ui/PageContainer';

<PageContainer 
  gradient="sakura"
  showPattern={true}
  className="custom-class"
>
  {/* Page content */}
</PageContainer>
```

#### Props:
- `gradient`: 'default' | 'sakura' | 'mizu' | 'matcha' | 'custom' - Gradient theme
- `showPattern`: boolean - Show decorative background pattern
- `customGradient`: string - Custom gradient classes
- `className`: string - Additional CSS classes

---

### 12. Section (`/components/ui/Section.tsx`)
A consistent section wrapper with various styling options.

#### Usage:
```tsx
import Section, { SectionGrid } from '@/components/ui/Section';

// Single section
<Section
  title="Profile Settings"
  description="Manage your account preferences"
  variant="glass"
  icon={<DoshiMascot size="xsmall" />}
>
  {/* Section content */}
</Section>

// Multiple sections in grid
<SectionGrid columns={2} gap="medium">
  <Section title="Stats">...</Section>
  <Section title="Activity">...</Section>
</SectionGrid>
```

#### Props:
- `title`: string - Section title
- `description`: string - Section description
- `variant`: 'default' | 'glass' | 'solid' | 'bordered' - Visual style
- `padding`: 'none' | 'small' | 'medium' | 'large' - Content padding
- `icon`: React.ReactNode - Optional icon for header

---

### 13. StatCard (`/components/ui/StatCard.tsx`)
A reusable card component for displaying statistics and metrics.

#### Usage:
```tsx
import StatCard, { StatCardGrid } from '@/components/ui/StatCard';

// Single stat card
<StatCard
  label="Total Users"
  value={1234}
  icon="👥"
  color="primary"
  change={{ value: 12.5, label: "vs last week" }}
  tooltip="Active users in the last 30 days"
/>

// Multiple cards in grid
<StatCardGrid columns={4}>
  <StatCard label="Sessions" value="5.2k" icon="📊" />
  <StatCard label="Success Rate" value="98.5%" icon="✅" color="green" />
  <StatCard label="Errors" value={23} icon="🚫" color="red" />
  <StatCard label="Revenue" value="$12.3k" icon="💰" gradient="from-green-400 to-blue-500" />
</StatCardGrid>
```

#### Props:
- `label`: string - Metric label
- `value`: string | number - Metric value
- `unit`: string - Optional unit text
- `icon`: string | React.ReactNode - Display icon
- `color`: string - Icon color (uses palette colors)
- `gradient`: string - Gradient classes for icon
- `change`: object - Change indicator with value and label
- `tooltip`: string - Hover tooltip text
- `size`: 'small' | 'medium' | 'large' - Card size
- `onClick`: () => void - Click handler

---

### 14. PageHeader (`/components/ui/PageHeader.tsx`)
A consistent page header component with optional Doshi mascot.

#### Usage:
```tsx
import PageHeader, { Breadcrumb } from '@/components/ui/PageHeader';

<PageHeader
  title="Account Settings"
  description="Manage your profile and preferences"
  showDoshi={true}
  doshiMood="happy"
  breadcrumb={
    <Breadcrumb items={[
      { label: 'Home', href: '/' },
      { label: 'Settings', href: '/settings' },
      { label: 'Account' }
    ]} />
  }
  actions={
    <>
      <button className="btn-secondary">Cancel</button>
      <button className="btn-primary">Save</button>
    </>
  }
/>
```

#### Props:
- `title`: string - Page title
- `description`: string - Page description
- `showDoshi`: boolean - Show Doshi mascot
- `doshiMood`: 'happy' | 'sad' | 'excited' | 'thinking' | 'sleeping' | 'waving'
- `doshiSize`: 'xsmall' | 'small' | 'medium' | 'large'
- `actions`: React.ReactNode - Action buttons
- `breadcrumb`: React.ReactNode - Breadcrumb navigation

---

### 15. SettingToggle (`/components/ui/SettingToggle.tsx`)
A reusable toggle switch component for settings pages.

#### Usage:
```tsx
import SettingToggle, { SettingToggleGroup } from '@/components/ui/SettingToggle';

// Single toggle
<SettingToggle
  label="Enable Notifications"
  description="Receive alerts for new content"
  enabled={notifications}
  onChange={setNotifications}
  icon="🔔"
  tooltip="Control notification preferences"
/>

// Grouped toggles
<SettingToggleGroup title="Privacy Settings">
  <SettingToggle
    label="Public Profile"
    description="Allow others to see your profile"
    enabled={publicProfile}
    onChange={setPublicProfile}
    icon="👤"
  />
  <SettingToggle
    label="Share Progress"
    description="Display your learning stats"
    enabled={shareProgress}
    onChange={setShareProgress}
    icon="📊"
    disabled={!publicProfile}
  />
</SettingToggleGroup>
```

#### Props:
- `label`: string - Toggle label
- `description`: string - Toggle description
- `enabled`: boolean - Current state
- `onChange`: (value: boolean) => void - Change handler
- `icon`: string | React.ReactNode - Optional icon
- `disabled`: boolean - Disable interaction
- `tooltip`: string - Hover tooltip

---

## Mobile-First Design Principles

All components follow these mobile-first principles:

1. **Touch-Optimized**: Minimum 44x44px touch targets
2. **Gesture Support**: Swipe, pinch, and touch gestures where appropriate
3. **Responsive**: Adapt to screen size automatically
4. **Performance**: Optimized for mobile devices
5. **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Theme Integration

All components automatically adapt to the current theme:
- Light mode: Clean, bright colors using standard grays
- Dark mode: Blue-grey tones using `dark-*` colors (not pure black)
- Palette colors: Dynamic `primary-*` colors that change with selected palette
- Smooth transitions between themes with `transition-colors`
- Respects system preferences

### Theme-Aware Color Usage
Components use the proper theme system colors:
- **Dark backgrounds**: `dark:bg-dark-800`, `dark:bg-dark-850`, `dark:bg-dark-900`
- **Dark text**: `dark:text-dark-50`, `dark:text-dark-100`, `dark:text-dark-400`
- **Primary colors**: `bg-primary-500`, `text-primary-500` with dark variants
- **Japanese colors**: `japanese-sakura`, `japanese-mizu`, `japanese-matcha` for accents

## Best Practices

### Layout Structure
- Use `PageContainer` as the root wrapper for all pages
- Use `Section` components instead of custom divs for content areas
- Use `PageHeader` for consistent page titles across the app
- Use `StatCard` for all metrics and statistics displays

### Performance
- Use `LoadingSkeleton` for content placeholders
- Implement `LoadingButton` for async actions
- Show `LoadingOverlay` for blocking operations
- Use `StatCardGrid` for responsive metric layouts

### User Feedback
- Use `Toast` for transient messages
- Use `Alert` for persistent information
- Use `Dialog` for confirmations
- Use `Tooltip` for contextual help

### Mobile UX
- Use `Drawer` for mobile navigation
- Position toasts at bottom for thumb reach
- Implement swipe gestures for dismissible content
- Ensure touch targets are large enough (44x44px minimum)

### Accessibility
- Always provide ARIA labels
- Support keyboard navigation
- Include focus indicators
- Test with screen readers
- Use `SettingToggle` with proper ARIA attributes

## Component Composition

Components can be composed together:

```tsx
// Example: Form with loading state and feedback
function ContactForm() {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitForm();
      showToast('Message sent successfully!', 'success');
    } catch (error) {
      showToast('Failed to send message', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form>
        {/* Form fields */}
        <LoadingButton
          isLoading={isSubmitting}
          onClick={() => setShowConfirm(true)}
        >
          Send Message
        </LoadingButton>
      </form>

      <Dialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Send Message?"
        message="Are you ready to send this message?"
        type="info"
      />
    </>
  );
}
```

## PWA Considerations

### Offline Support
- Components gracefully handle offline states
- Loading states persist during reconnection
- Cached assets for core components

### Installation
- Components work in standalone PWA mode
- Touch gestures optimized for app-like experience
- Native-like animations and transitions

### Updates
- Components handle PWA updates smoothly
- Toast notifications for update prompts
- Non-breaking UI during updates

## Testing Components

### Unit Testing
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '@/components/ui/Modal';

test('Modal closes on ESC key', () => {
  const handleClose = jest.fn();
  render(
    <Modal isOpen={true} onClose={handleClose}>
      Content
    </Modal>
  );
  
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(handleClose).toHaveBeenCalled();
});
```

### Mobile Testing
- Test on real devices
- Verify touch gestures
- Check landscape/portrait modes
- Test with slow network

## Future Enhancements

Planned component additions:
- [ ] Bottom Sheet with snap points
- [ ] Pull-to-refresh component
- [ ] Carousel/Slider with touch support
- [ ] Date/Time picker (mobile-optimized)
- [ ] Virtual keyboard aware inputs
- [ ] Offline indicator component
- [ ] PWA install prompt component
- [ ] Biometric authentication component

---

## Support

For issues or questions about components:
1. Check this documentation
2. Review component source code
3. Test in development environment
4. Report issues with reproducible examples

Remember: All components are designed to work seamlessly with the Moshimoshi learning platform's Japanese aesthetic and mobile-first approach.