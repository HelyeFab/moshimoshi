# Village Layout Personalization Test Page

**URL**: `/test-village-personalization`

## Purpose

This page allows you to test and visualize how different learning goals affect the Learning Village dashboard layout.

## Features

### 1. **Interactive Goal Selection**
- Choose from 4 learning goals:
  - 📚 **JLPT Study** - Pass the Japanese Language Proficiency Test
  - ✈️ **Travel Japanese** - Learn Japanese for travel
  - 🎌 **Anime & Manga** - Understand anime without subtitles
  - 💬 **Conversation** - Have everyday conversations

### 2. **Live District Order Preview**
- See exactly how districts will be ordered on your dashboard
- Priority district is highlighted with ⭐ and special styling
- Each district shows:
  - Emoji icon
  - Name
  - Description of content

### 3. **Personalization Explanation**
- Understand **why** each goal prioritizes certain districts
- See which district is prioritized for your selected goal

### 4. **User Account Integration**
- If logged in, see your current learning goal
- Update your goal directly from the test page
- Changes will regenerate your dashboard layout

### 5. **Comparison Table**
- View all 4 goals side-by-side
- Compare district orders
- See priority districts for each goal

### 6. **Technical Details**
- View the computed district order as JSON
- See storage locations in Firestore
- Understand the algorithm logic

## How to Use

### As a Visitor (Not Logged In)
1. Navigate to `/test-village-personalization`
2. Select different goals to see how they affect layout
3. Compare all goals in the comparison table

### As a Logged-In User
1. Navigate to `/test-village-personalization`
2. Your current goal will be displayed (if you've completed onboarding)
3. Select a different goal to preview the new layout
4. Click "Update Goal" to apply changes
5. Visit `/dashboard` to see the new layout

## Goal → District Mapping

| Goal | Priority District | First District | Why? |
|------|------------------|----------------|------|
| **JLPT** | Study | 📚 Study | Structured practice needed for tests |
| **Travel** | Immersion | 🎬 Immersion | Real-world conversations |
| **Anime** | Immersion | 🎬 Immersion | Authentic Japanese content |
| **Conversation** | Immersion | 🎬 Immersion | Native speech patterns |

## District Descriptions

### 🏛️ Foundation
Core learning materials: Textbooks, Basics, Grammar

### 📚 Study
Structured practice: Flashcards, Drills, Tests

### 🎬 Immersion
Real content: Stories, News, YouTube Shadowing

### 🎮 Play
Fun learning: Games, Quizzes, Challenges

### 👥 Community
Social features: Forums, Sharing, Collaboration

## Testing Scenarios

### Scenario 1: New User Flow
1. Open page (not logged in)
2. Select "Anime & Manga"
3. Observe: Immersion district is first
4. Select "JLPT Study"
5. Observe: Study district is now first

### Scenario 2: Change User Goal
1. Log in as existing user
2. Navigate to test page
3. Current goal displays at top
4. Select a different goal
5. Click "Update Goal"
6. Visit dashboard to see changes

### Scenario 3: Compare All Goals
1. Scroll to comparison table
2. See all 4 goals side-by-side
3. Notice JLPT is the only one with Study first
4. Anime, Travel, Conversation all show Immersion first

## What Happens When You Update?

When you click "Update Goal to [Goal]":

1. **API Call**: `PATCH /api/user/onboarding`
   - Updates `users/{uid}/onboarding.learningGoal`
   - Updates `onboarding/{uid}/learningGoal`

2. **Cascade Invalidation**:
   - Deletes `users/{uid}/villageLayout/data`
   - Forces layout regeneration

3. **Router Refresh**:
   - Invalidates Next.js cache
   - Ensures fresh data on navigation

4. **Success Message with Action**:
   - Shows confirmation message
   - Displays "Go to Dashboard Now →" button
   - Button navigates to dashboard with fresh cache

5. **Next Dashboard Visit**:
   - No saved layout found
   - Fetches new goal
   - Builds new district order
   - Saves new layout
   - Displays personalized dashboard

**Important**: After updating your goal, use the "Go to Dashboard Now →" button in the success message to ensure the dashboard refreshes properly. This triggers a fresh load that will regenerate your layout based on the new goal.

## Code Reference

**Algorithm**: `buildDistrictOrder(goal)`
```typescript
function buildDistrictOrder(goal: LearningGoal | null): DistrictId[] {
  if (!goal) return DEFAULT_DISTRICT_ORDER

  const priority = GOAL_TO_PRIORITY[goal]
  const rest = DEFAULT_DISTRICT_ORDER.filter(d => d !== priority)
  return [priority, ...rest]
}
```

**Mapping**:
```typescript
GOAL_TO_PRIORITY = {
  jlpt: 'study',
  anime: 'immersion',
  travel: 'immersion',
  conversation: 'immersion',
}
```

## Related Files

- **Component**: `/src/components/dashboard/LearningVillage.tsx:45-60`
- **API**: `/src/app/api/user/onboarding/route.ts:153-234`
- **Tests**: `/tests/village-layout-personalization.test.js`
- **Docs**: `/01_PRODUCTION_DOCS/village-layout-personalization-fix.md`

## Troubleshooting

### "Update Goal" button doesn't appear
- Make sure you're logged in (not guest mode)
- Ensure you've completed onboarding first

### Changes don't reflect on dashboard
- **Make sure you use the "Go to Dashboard Now →" button** after updating (this ensures proper cache invalidation)
- If using the top navigation link instead, try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache if needed
- Log out and log back in as a last resort
- Check browser console for errors

### Layout looks wrong
- Verify your goal in `/account` settings
- Check Firestore data with verification script
- Run test suite: `node tests/village-layout-personalization.test.js`

## Development Notes

This test page is safe to use in production as:
- It only affects the logged-in user's data
- Changes are reversible (just select a different goal)
- It uses the same APIs as the onboarding flow
- No test data is created

## Future Enhancements

- [ ] Add animation for district reordering
- [ ] Show before/after comparison
- [ ] Add "Reset to Default" button
- [ ] Export layout as image
- [ ] A/B testing integration
