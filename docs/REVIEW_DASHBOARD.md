# Review Dashboard Documentation

## Overview

The Review Dashboard is a comprehensive view of a user's learning progress and review schedule in the Moshimoshi app. It provides real-time visibility into what has been studied, what's been learned, current review queue, and upcoming review schedules based on the SRS (Spaced Repetition System) algorithm.

## Features

### 1. Overview Tab
- **Stats Cards**: Quick glance at total studied items, learned items, items due now, and upcoming reviews
- **Review Queue Summary**: Shows top 5 items that are due for review right now
- **Upcoming Reviews**: Timeline view of items scheduled for review soon
- **Learning Progress**: Visual progress bars showing percentage completion by content type

### 2. Studied Items Tab
- Complete list of all items the user has encountered
- Shows review count, accuracy percentage, and SRS level
- Last reviewed timestamp
- Color-coded status badges (new, learning, review, mastered)

### 3. Learned Items Tab
Split into two categories:
- **Mastered Items** (Purple): Items with 21+ days retention and 90%+ accuracy
- **In Review Items** (Green): Items actively being reviewed but not yet mastered

### 4. Review Queue Tab
- Items that are due NOW or overdue
- Highlighted in orange for urgency
- Shows overdue duration (e.g., "2 hours overdue")
- Direct link to start review session
- Success rate and source information

### 5. Schedule Tab
Timeline organized by:
- **Today**: Reviews due in the next 24 hours with specific times
- **Tomorrow**: Next day's scheduled reviews
- **This Week**: Upcoming reviews for the current week
- **Later**: Future reviews beyond the current week

## Technical Implementation

### Page Location
```
/src/app/review-dashboard/page.tsx
```

### API Endpoints

#### GET /api/review/progress/studied
Returns all studied items for the authenticated user
```typescript
Response: {
  items: ReviewItem[]
  total: number
  timestamp: string
}
```

#### GET /api/review/queue
Returns items currently due for review
```typescript
Response: {
  items: ReviewItem[]
  timestamp: string
}
```

#### GET /api/review/stats
Returns aggregated statistics
```typescript
Response: {
  totalStudied: number
  totalLearned: number
  totalMastered: number
  dueNow: number
  dueToday: number
  dueTomorrow: number
  dueThisWeek: number
}
```

### Data Types

```typescript
interface ReviewItem {
  id: string
  contentType: 'kana' | 'kanji' | 'vocabulary' | 'sentence'
  primaryDisplay: string        // The item itself (あ, 水, etc.)
  secondaryDisplay?: string      // Meaning or reading
  status: 'new' | 'learning' | 'review' | 'mastered'
  lastReviewedAt?: Date
  nextReviewAt?: Date
  srsLevel?: number
  accuracy: number              // 0-1 percentage
  reviewCount: number
  correctCount: number
  tags?: string[]
  source?: string              // Where it came from (JLPT N5, etc.)
}
```

## User Interface

### Color Coding
- **New**: Gray - Never reviewed
- **Learning**: Blue - In initial learning phase (10min, 30min intervals)
- **Review**: Green - In regular review cycle
- **Mastered**: Purple - Achieved mastery (21+ days, 90%+ accuracy)
- **Overdue**: Red/Orange - Past due date

### Time Display Logic
- **Overdue**: Shows in red with "X overdue"
- **Due soon**: Orange for items due within 1 hour
- **Today**: Blue with specific time
- **Tomorrow**: Green with time
- **Future**: Gray with date

### Filter Options
Users can filter all views by content type:
- All (default)
- Kana
- Kanji
- Vocabulary
- Sentences

## Integration Points

### Review Engine Integration
The dashboard connects to the Universal Review Engine to:
- Fetch SRS calculation data
- Get next review times
- Track review statistics
- Monitor learning progress

### Progress Tracking
- Uses `UniversalProgressManager` for data persistence
- Three-tier storage: Guest (session), Free (IndexedDB), Premium (IndexedDB + Firebase)

### Internationalization
All text strings are internationalized and stored in:
```
/src/i18n/locales/[lang]/strings.ts
```

## Performance Considerations

1. **Data Loading**: Fetches are parallelized using `Promise.all()`
2. **Pagination**: Large lists are limited to 500 items with scrollable containers
3. **Caching**: Mock data is used as fallback when Firebase is unavailable
4. **Refresh**: Manual refresh button to reload latest data

## Future Enhancements

1. **Export Feature**: Download progress data as CSV/PDF
2. **Study Calendar**: Visual calendar showing review density
3. **Performance Analytics**: Charts showing accuracy trends over time
4. **Custom Scheduling**: Allow users to reschedule items
5. **Batch Operations**: Select multiple items for bulk actions
6. **Search**: Find specific items across all categories
7. **Study Goals**: Set and track daily/weekly targets

## Accessibility

- All interactive elements have proper ARIA labels
- Keyboard navigation fully supported
- Color coding is supplemented with text labels
- Responsive design works on all screen sizes

## Testing

### Manual Testing Checklist
- [ ] All tabs load without errors
- [ ] Filter buttons work correctly
- [ ] Time calculations are accurate
- [ ] Status badges display correctly
- [ ] Links to review sessions work
- [ ] Dark mode displays properly
- [ ] Mobile responsive layout works
- [ ] Refresh button updates data

### Development Testing
```bash
# Start development server
npm run dev

# Navigate to
http://localhost:3000/review-dashboard

# API endpoints can be tested directly:
curl http://localhost:3000/api/review/progress/studied
curl http://localhost:3000/api/review/queue
curl http://localhost:3000/api/review/stats
```

## Troubleshooting

### Common Issues

**No data showing:**
- Check user is authenticated
- Verify API endpoints are returning data
- Check browser console for errors

**Incorrect times:**
- Verify timezone settings
- Check Date object parsing
- Ensure SRS calculations are correct

**Missing translations:**
- Add missing keys to all language files in `/src/i18n/locales/`

## Related Documentation

- [Review Engine Documentation](/docs/REVIEW_ENGINE_DEEP_DIVE.md)
- [SRS Algorithm Documentation](/src/lib/review-engine/srs/README.md)
- [Progress Tracking Documentation](/docs/universal-progress-tracking.md)