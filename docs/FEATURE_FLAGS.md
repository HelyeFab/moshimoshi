# Feature Flags

This document explains how to enable or disable features across the Moshimoshi application.

## Quick Reference

| Feature | Environment Variable | Default | Affects |
|---------|---------------------|---------|---------|
| Games | `NEXT_PUBLIC_FEATURE_GAMES` | `false` | Games page, Bottom Nav, Command Palette, Learning Village |
| Review Hub | `NEXT_PUBLIC_FEATURE_REVIEW_HUB` | `false` | Review Dashboard, Bottom Nav, Command Palette, Learning Village |
| Achievements | `NEXT_PUBLIC_FEATURE_ACHIEVEMENTS` | `false` | Achievements page, Command Palette, Learning Village |
| Leaderboard | `NEXT_PUBLIC_FEATURE_LEADERBOARD` | `false` | Leaderboard page, Command Palette, Learning Village |
| Task Manager | `NEXT_PUBLIC_FEATURE_TODOS` | `false` | Todos page, Command Palette, Learning Village |

> **Note:** Features are DISABLED by default for security. You must explicitly set `=true` to enable them.

## Quick Toggle

To enable or disable any feature, update the environment variable in `.env.local`:

```bash
# To DISABLE a feature (hide from all locations)
NEXT_PUBLIC_FEATURE_GAMES=false
NEXT_PUBLIC_FEATURE_REVIEW_HUB=false
NEXT_PUBLIC_FEATURE_ACHIEVEMENTS=false
NEXT_PUBLIC_FEATURE_LEADERBOARD=false
NEXT_PUBLIC_FEATURE_TODOS=false

# To ENABLE a feature (show in all locations) - this is the default
NEXT_PUBLIC_FEATURE_GAMES=true
NEXT_PUBLIC_FEATURE_REVIEW_HUB=true
NEXT_PUBLIC_FEATURE_ACHIEVEMENTS=true
NEXT_PUBLIC_FEATURE_LEADERBOARD=true
NEXT_PUBLIC_FEATURE_TODOS=true
```

After changing any value, **restart the development server** for changes to take effect.

## Feature Details

### Games (`NEXT_PUBLIC_FEATURE_GAMES`)

**Affected Locations:**

| Location | File | What's Hidden |
|----------|------|---------------|
| Bottom Navigation | `src/components/layout/BottomNav.tsx` | Games icon/tab |
| Learning Village | `src/components/dashboard/LearningVillage.tsx` | Games stall card |
| Command Palette | `src/components/ui/CommandPalette.tsx` | "Games" command (Cmd+K) |
| Games Page | `src/app/games/page.tsx` | Redirects to `/dashboard` |

**Available Games:**
1. Kana Drop - Catch falling kana characters
2. Word Assembly - Build kana readings from audio
3. Stroke Order - Practice kanji stroke order
4. Kanji Simon - Memory game with kanji
5. Reading Routes - Reading practice game
6. Sentence Scramble - Unscramble Japanese sentences
7. Matching Game - Match vocabulary pairs
8. Kanji Quest - Pokemon-style kanji battles

---

### Review Hub (`NEXT_PUBLIC_FEATURE_REVIEW_HUB`)

**Affected Locations:**

| Location | File | What's Hidden |
|----------|------|---------------|
| Bottom Navigation | `src/components/layout/BottomNav.tsx` | Review icon/tab |
| Learning Village | `src/components/dashboard/LearningVillage.tsx` | Review Hub stall card |
| Command Palette | `src/components/ui/CommandPalette.tsx` | "Review Hub" command |
| Review Dashboard | `src/app/review-dashboard/page.tsx` | Redirects to `/dashboard` |

---

### Achievements (`NEXT_PUBLIC_FEATURE_ACHIEVEMENTS`)

**Affected Locations:**

| Location | File | What's Hidden |
|----------|------|---------------|
| Learning Village | `src/components/dashboard/LearningVillage.tsx` | Achievements stall card |
| Command Palette | `src/components/ui/CommandPalette.tsx` | "Achievements" command |
| Achievements Page | `src/app/achievements/page.tsx` | Redirects to `/dashboard` |

---

### Leaderboard (`NEXT_PUBLIC_FEATURE_LEADERBOARD`)

**Affected Locations:**

| Location | File | What's Hidden |
|----------|------|---------------|
| Learning Village | `src/components/dashboard/LearningVillage.tsx` | Leaderboard stall card |
| Command Palette | `src/components/ui/CommandPalette.tsx` | "Leaderboard" command |
| Leaderboard Page | `src/app/leaderboard/page.tsx` | Redirects to `/dashboard` |

---

### Task Manager (`NEXT_PUBLIC_FEATURE_TODOS`)

**Affected Locations:**

| Location | File | What's Hidden |
|----------|------|---------------|
| Learning Village | `src/components/dashboard/LearningVillage.tsx` | Task Manager stall card |
| Command Palette | `src/components/ui/CommandPalette.tsx` | "Task Manager" command |
| Todos Page | `src/app/todos/page.tsx` | Redirects to `/dashboard` |

---

## How It Works

Each location checks the environment variable directly:

```typescript
// At module level (outside component)
// Features are DISABLED by default unless explicitly set to 'true'
const isFeatureEnabled = process.env.NEXT_PUBLIC_FEATURE_X === 'true'

// In page component - redirect if disabled
useEffect(() => {
  if (!isFeatureEnabled) {
    router.replace('/dashboard')
  }
}, [router])

// Early return to prevent flash
if (!isFeatureEnabled) {
  return null
}
```

**Why `=== 'true'` instead of `!== 'false'`?**

Using `=== 'true'` ensures features are disabled by default when:
- The environment variable is not set
- The environment variable is undefined at build time
- The environment variable has any value other than the string `'true'`

This is safer because features must be explicitly enabled, preventing accidental exposure.

This pattern is used because Next.js only inlines `NEXT_PUBLIC_*` variables when accessed statically (not via dynamic keys like `process.env[envKey]`).

## Feature Flag System

A more comprehensive feature flag system exists at:

```
src/lib/features/featureFlags.ts
```

This system provides:
- Type-safe feature flag definitions
- Default values per environment
- Metadata (name, description, category)
- `isFeatureEnabled()` utility function
- `useFeatureFlag()` React hook

### Available Flags in the System

```typescript
type FeatureFlag =
  | 'COMMAND_PALETTE'    // Command palette search (Cmd+K)
  | 'BOTTOM_NAV'         // Mobile bottom navigation
  | 'AUTO_HIDE_NAV'      // Auto-hiding top navbar
  | 'GLASSMORPHISM_NAV'  // Glassmorphism effect
  | 'LEARNING_VILLAGE'   // Learning village dashboard
  | 'ANIMATION_CONTROL'  // Animation pause/play
  | 'STREAK_SYSTEM'      // Streak tracking
  | 'LEADERBOARD'        // Leaderboard feature
  | 'ACHIEVEMENTS'       // Achievements system
  | 'YOUTUBE_SHADOWING'  // YouTube shadowing
  | 'AI_STORIES'         // AI-generated stories
  | 'BLOG'               // Blog section
  | 'NEWSLETTER'         // Newsletter subscription
  | 'NOTIFICATIONS'      // Push notifications
  | 'DRILL_PRACTICE'     // Drill practice mode
  | 'KANJI_BROWSER'      // Kanji browser
  | 'ANKI_IMPORT'        // Anki deck import
  | 'CUSTOM_LISTS'       // Custom study lists
  | 'REVIEW_ENGINE'      // Universal review engine
  | 'REVIEW_HUB'         // Review hub/dashboard
  | 'FLASHCARDS'         // Flashcard system
  | 'GAMES'              // Learning games
  | 'TODOS'              // Task manager
```

## Troubleshooting

### Feature still visible after disabling
1. Make sure you saved `.env.local`
2. Restart the development server (`npm run dev`)
3. Hard refresh the browser (Cmd+Shift+R / Ctrl+Shift+R)

### Feature not showing after enabling
1. Ensure the value is exactly `true` (not `TRUE` or `1`)
2. Restart the development server
3. Clear browser cache if needed

### Adding Feature Flag to New Locations

If you add feature links elsewhere, use this pattern:

```typescript
// At module level or inside component
// Features are DISABLED by default unless explicitly set to 'true'
const isFeatureEnabled = process.env.NEXT_PUBLIC_FEATURE_X === 'true'

// In JSX
{isFeatureEnabled && <FeatureLink />}

// Or filter arrays
const items = allItems.filter(item => {
  if (item.id === 'feature-id' && !isFeatureEnabled) return false
  return true
})
```

## Related Files

### Core Feature Flag Files
- `src/lib/features/featureFlags.ts` - Central feature flag definitions
- `.env.local` - Environment variable configuration

### Navigation Components
- `src/components/layout/BottomNav.tsx`
- `src/components/ui/CommandPalette.tsx`
- `src/components/dashboard/LearningVillage.tsx`

### Feature Pages
- `src/app/games/page.tsx`
- `src/app/review-dashboard/page.tsx`
- `src/app/achievements/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/app/todos/page.tsx`

---

Last Updated: 2025-12-03
