# Announcement Analytics - Quick Start Guide

## Admin Dashboard: `/en/admin/announcements`

### View Metrics on Cards

Every published or archived announcement now shows inline analytics:

```
┌─────────────────────────────────────────┐
│ 🎉 New Kanji Mastery Mode          [✓] │
│                                         │
│ Learn kanji with interactive...        │
│                                         │
│ Feature: kanji-mastery-v2               │
│ Created: Jan 28, 2026                   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ 👁️  Views           1,234       │   │
│ │ ✅  Dismissed        892        │   │
│ │ 📊  Engagement Rate  72.3%      │   │
│ │                                 │   │
│ │    [View Details]               │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [Preview]  [Unpublish]  [Archive]      │
└─────────────────────────────────────────┘
```

### View Detailed Analytics

Click "View Details" to open the analytics modal:

```
╔════════════════════════════════════════════╗
║ Analytics                              [X] ║
║ New Kanji Mastery Mode                     ║
╠════════════════════════════════════════════╣
║                                            ║
║ ┌──────────────┐  ┌──────────────┐       ║
║ │ 👁️ Total Views│  │ ✅ Dismissals │       ║
║ │                │  │              │       ║
║ │    1,234       │  │     892      │       ║
║ │                │  │              │       ║
║ │ 1,234 unique   │  │  72.3% rate  │       ║
║ └──────────────┘  └──────────────┘       ║
║                                            ║
║ Engagement Rate: 72.3%                     ║
║ ████████████████████░░░░░░░░ 72.3%        ║
║                                            ║
║ Breakdown by User Type                     ║
║                                            ║
║ ┌─ Views ─────────────────────────┐       ║
║ │ 🔐 Authenticated    980  (79%)  │       ║
║ │ 👤 Guest            254  (21%)  │       ║
║ └──────────────────────────────────┘       ║
║                                            ║
║ ┌─ Dismissals ────────────────────┐       ║
║ │ 🔐 Authenticated    720  (81%)  │       ║
║ │ 👤 Guest            172  (19%)  │       ║
║ └──────────────────────────────────┘       ║
║                                            ║
║ ℹ️  Analytics tracked in real-time         ║
║                                            ║
║            [Close]                         ║
╚════════════════════════════════════════════╝
```

---

## How It Works

### For Users

1. User loads app → Announcement shows
2. View automatically tracked (once per user)
3. User clicks "Got it" → Dismissal tracked
4. User won't see that announcement again

### For Admins

1. Publish announcement
2. Wait for users to see it
3. Check metrics on announcement card
4. Click "View Details" for breakdown
5. See engagement rate and user types

---

## Metrics Explained

### Views
- How many times announcement was shown
- Each user counted once (deduplication)

### Dismissals
- How many users clicked "Got it"
- Means they saw and acknowledged it

### Engagement Rate
```
(Dismissals ÷ Views) × 100 = Engagement Rate
```

**Example**: 1,000 views, 800 dismissals = 80%

**What's good?**
- 80%+ = Excellent (users engaged)
- 60-80% = Good (most users saw it)
- 40-60% = Fair (some missed it)
- <40% = Low (review content/timing)

### User Types

**🔐 Authenticated**: Logged-in users
**👤 Guest**: Users without accounts

---

## Testing Your First Announcement

### 1. Create Draft
```
Title: Test Announcement
Content: This is a test announcement for analytics
Feature ID: test-001
Status: Draft
```

### 2. Publish It
Click "Publish" button

### 3. View It (as user)
- Open app in incognito window
- Log in
- Announcement should appear
- Click "Got it"

### 4. Check Analytics (as admin)
- Go to `/en/admin/announcements`
- See your announcement card
- Should show: 1 view, 1 dismissal, 100% rate

### 5. Test Again (same user)
- Reload app
- Announcement should NOT appear (already dismissed)
- Analytics still show: 1 view, 1 dismissal

---

## API Endpoints

### Track View (Auto-called by overlay)
```bash
POST /api/announcements/track-view
Content-Type: application/json

{
  "announcementId": "abc123"
}
```

### Get Analytics (Admin only)
```bash
GET /api/admin/announcements/analytics/{id}
Authorization: Bearer {admin-token}
```

Response:
```json
{
  "success": true,
  "analytics": {
    "announcementId": "abc123",
    "totalViews": 1234,
    "uniqueViewers": 1234,
    "totalDismissals": 892,
    "dismissalRate": 72.29,
    "viewsByType": {
      "authenticated": 980,
      "guest": 254
    },
    "dismissalsByType": {
      "authenticated": 720,
      "guest": 172
    }
  }
}
```

---

## Firestore Collections

### `announcement_views`
Tracks when users see announcements

```
Document ID: {userId}_{announcementId}

{
  visitorId: "user123_abc456",
  visitorType: "user",
  visitorValue: "user123",
  announcementId: "abc456",
  viewedAt: Timestamp
}
```

### `announcement_dismissals`
Tracks when users dismiss announcements

```
Document ID: {userId}_{announcementId}

{
  visitorId: "user123_abc456",
  visitorType: "user",
  visitorValue: "user123",
  announcementId: "abc456",
  dismissedAt: Timestamp
}
```

---

## Troubleshooting

### No analytics showing

**Problem**: Card shows "Loading analytics..." forever

**Solutions**:
1. Check browser console for errors
2. Verify you're admin (analytics API requires admin auth)
3. Check if announcement is published (drafts don't show analytics)

### Analytics show 0 views

**Problem**: Published but shows 0 views

**Solutions**:
1. Announcement must be published first
2. User must actually see it (open app while logged in)
3. Check `announcement_views` collection in Firestore
4. Verify view tracking API is working (check Network tab)

### Engagement rate is 0%

**Problem**: Views tracked but no dismissals

**Solutions**:
1. Users must click "Got it" (not just close tab)
2. Check `announcement_dismissals` collection
3. Verify dismiss API is working
4. Make sure announcement is visible to users

### Rate limit errors

**Problem**: 429 Too Many Requests

**Solution**: Analytics API is rate-limited to 60 requests/minute per admin
- Wait a minute before retrying
- Don't refresh the page repeatedly
- Rate limit resets every minute

---

## Best Practices

### Writing Announcements
1. **Clear title**: Users should know what's new immediately
2. **Concise content**: 2-3 sentences max
3. **Call to action**: Tell users what to do next
4. **Test first**: Create as draft, preview, then publish

### Monitoring Performance
1. **Check weekly**: Review metrics every week
2. **Compare**: Look at trends across announcements
3. **Adjust**: If engagement is low, improve content
4. **Archive**: Archive old announcements after 2 weeks

### Interpreting Metrics
- **High views, low dismissals**: Users seeing but not engaging
  - Content might be too long
  - Unclear what action to take
  - Not interesting to users

- **High engagement rate**: Good sign!
  - Content is clear and valuable
  - Users understand and acknowledge

- **Few views**: Announcement not shown much
  - Check if published during low-traffic time
  - Verify overlay is working
  - Most users may have already dismissed

---

## Next Steps

1. ✅ Create your first announcement
2. ✅ Publish it and test
3. ✅ Check analytics after 24 hours
4. ✅ Compare with future announcements
5. ✅ Optimize based on engagement rates

---

**Need Help?**
- See full implementation docs: `ANALYTICS_IMPLEMENTATION.md`
- Check API docs: `/api/admin/announcements/analytics/[id]`
- Inspect code: `src/app/[locale]/admin/announcements/page.tsx`
