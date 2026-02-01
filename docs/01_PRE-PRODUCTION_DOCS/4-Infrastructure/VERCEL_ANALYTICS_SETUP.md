# Vercel Analytics Setup

This guide explains how to set up Vercel Analytics to track landing page visitors and display the count in your admin dashboard.

## What's Already Done

✅ `@vercel/analytics` package installed
✅ Analytics component added to root layout (automatic tracking)
✅ Admin API endpoint created at `/api/admin/analytics`
✅ Admin dashboard updated with visitor count card

## Setup Required

### 1. Create Vercel Access Token

You need a Vercel Access Token to fetch analytics data via the API.

**Steps:**

1. Go to [Vercel Account Settings - Tokens](https://vercel.com/account/tokens)
2. Click **Create Token**
3. Name it: `Moshimoshi Analytics API`
4. Set expiration: `No expiration` (or your preference)
5. Click **Create**
6. **Copy the token immediately** (you won't see it again!)

### 2. Find Your Vercel Project ID

**Option A: From Vercel Dashboard**
1. Go to your project settings: `https://vercel.com/<your-team>/moshimoshi/settings`
2. Scroll to **Project ID**
3. Copy the ID (e.g., `prj_abc123xyz`)

**Option B: From CLI**
```bash
# In your project directory
vercel project ls
```

### 3. Find Your Vercel Team ID (if applicable)

If you're using a Vercel team account:

```bash
# List your teams
vercel teams ls

# Or check project info
vercel project
```

### 4. Add Environment Variables

Add these to your environment variables:

**For Local Development** (`.env.local`):
```bash
VERCEL_ACCESS_TOKEN="your_token_here"
VERCEL_PROJECT_ID="prj_abc123xyz"
VERCEL_TEAM_ID="team_abc123xyz"  # Optional, only if using team account
```

**For Production** (Vercel Dashboard or CLI):

Using Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add the following:
   - `VERCEL_ACCESS_TOKEN` → `your_token_here`
   - `VERCEL_PROJECT_ID` → `prj_abc123xyz`
   - `VERCEL_TEAM_ID` → `team_abc123xyz` (if applicable)

Using Vercel CLI:
```bash
# Add access token
vercel env add VERCEL_ACCESS_TOKEN production
# Paste your token when prompted

# Add project ID
vercel env add VERCEL_PROJECT_ID production
# Paste your project ID when prompted

# Add team ID (if applicable)
vercel env add VERCEL_TEAM_ID production
# Paste your team ID when prompted
```

Or use the prelaunch-lock script:
```bash
# Set all env vars at once (interactive)
vercel env add VERCEL_ACCESS_TOKEN production
vercel env add VERCEL_PROJECT_ID production
vercel env add VERCEL_TEAM_ID production
```

### 5. Redeploy (if in production)

After adding production environment variables:

```bash
vercel --prod
```

Or use the prelaunch script:
```bash
./scripts/prelaunch-lock.sh --deploy
```

## How It Works

### Automatic Tracking

The `<Analytics />` component in `src/app/layout.tsx` automatically tracks:
- Page views
- Unique visitors
- Geographic data
- Device/browser data
- Referrers

**No configuration needed** - it just works once deployed to Vercel!

### Admin Dashboard Display

The admin page (`/admin/user-lookup`) displays:

1. **Landing Page Visitors** - Total unique visitors to `/waitlist` (last 30 days)
2. **Waitlist Signups** - Total email signups
3. **Conversion Rate** - Automatically calculated: `(signups / visitors) × 100`

### API Endpoint

**Endpoint:** `GET /api/admin/analytics`

**Query Parameters:**
- `path` - Page path to track (default: `/waitlist`)
  - Example: `/waitlist`, `/en/waitlist`, `/pricing`
- `since` - Time period (default: `7d`)
  - Valid values: `1h`, `24h`, `7d`, `30d`, `90d`, `all`

**Example Requests:**

```bash
# Get waitlist visitors (last 30 days)
GET /api/admin/analytics?path=/waitlist&since=30d

# Get pricing page visitors (last 7 days)
GET /api/admin/analytics?path=/pricing&since=7d

# Get all visitors across all time
GET /api/admin/analytics?path=/&since=all
```

**Response:**
```json
{
  "success": true,
  "path": "/waitlist",
  "since": "30d",
  "visitors": 1234,
  "data": {
    "total": 1234,
    "// ... full Vercel Analytics response"
  }
}
```

## Viewing Analytics in Vercel Dashboard

You can also view analytics directly in Vercel:

1. Go to your project: `https://vercel.com/<your-team>/moshimoshi`
2. Click **Analytics** tab
3. View:
   - Top pages
   - Unique visitors
   - Page views
   - Devices
   - Locations
   - Referrers

## Troubleshooting

### Error: "Vercel Analytics not configured"

**Solution:** Add `VERCEL_ACCESS_TOKEN` and `VERCEL_PROJECT_ID` environment variables (see step 4).

### Error: "Vercel API returned 401"

**Causes:**
1. Invalid access token
2. Token expired
3. Token doesn't have permissions for the project

**Solution:** Create a new access token and update the environment variable.

### Error: "Vercel API returned 403"

**Causes:**
1. Token doesn't have access to the team/project
2. Team ID is incorrect or missing

**Solution:**
- Verify your `VERCEL_TEAM_ID` is correct
- Create a new token with proper permissions

### Visitor count shows 0

**Possible causes:**
1. Analytics just set up (no data collected yet)
2. Path doesn't match (check if visitors are going to `/en/waitlist` vs `/waitlist`)
3. Time period is too narrow (`since=1h` might show 0 for low traffic)

**Solutions:**
- Wait 24-48 hours for data to accumulate
- Try a broader time period: `since=30d` or `since=all`
- Check Vercel Analytics dashboard to see which paths have traffic

### Admin page shows error message

If the visitor count card shows an error, check:
1. Browser console for error details
2. API response at `/api/admin/analytics`
3. Vercel function logs for backend errors

## Security Notes

- ✅ API endpoint requires admin authentication
- ✅ Access token is server-side only (never exposed to client)
- ✅ Analytics data is only accessible to admin users
- ⚠️ Keep your access token secret - never commit to git
- ⚠️ Rotate token if compromised

## Cost

Vercel Analytics Free Tier:
- ✅ Unlimited page views
- ✅ Unlimited unique visitors
- ✅ 30-day data retention
- ✅ Real-time dashboard

**No additional cost for this implementation!**

## Related Files

- `src/app/layout.tsx` - Analytics component
- `src/app/api/admin/analytics/route.ts` - API endpoint
- `src/app/[locale]/admin/user-lookup/page.tsx` - Admin dashboard
- `package.json` - @vercel/analytics dependency

## Next Steps

After setup, you can:
1. Track more pages by changing the `path` parameter
2. Add graphs and charts to visualize trends
3. Set up alerts for conversion rate drops
4. Export analytics data for reporting

---

Last Updated: 2025-12-24
