# Collaborator Access Setup

> **Purpose**: Allow external collaborators (e.g., YouTube creators, testers) to access the full app while production remains locked during pre-launch.
>
> **Created**: December 25, 2025
> **Status**: ✅ ACTIVE & WORKING

---

## Overview

This document explains how to give collaborators access to test the Moshimoshi app while keeping the production site locked until the official launch date (January 23, 2026).

**Solution**: Use Vercel Preview Deployments with branch-specific environment variables.

---

## Quick Summary

| Item | Value |
|------|-------|
| **Branch** | `collaborator-access` |
| **Platform** | Vercel Preview Deployment |
| **Git URL** | `https://moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app` |
| **Lock Status** | Disabled (unlocked) |
| **Production** | Still locked (unaffected) |
| **Firebase Domain** | Added to authorized domains |

---

## Architecture

### How It Works

1. **Separate Branch**: `collaborator-access` branch is identical to `main` but deployed as a Preview
2. **Environment Override**: Vercel Preview environment has `PRELAUNCH_LOCK_ENABLED=false`
3. **Vercel Protection**: Preview deployments are protected by Vercel Authentication
4. **Shareable Links**: Vercel generates unique shareable links that bypass protection
5. **Firebase Auth**: Preview domain authorized in Firebase for login/signup

### Environment Configuration

| Environment | PRELAUNCH_LOCK_ENABLED | Effect |
|-------------|------------------------|--------|
| **Production** (Vercel) | `true` | App locked, shows waitlist |
| **Preview** (Vercel) | `false` | App unlocked, full access |
| **Development** (Local) | `false` | App unlocked for testing |

---

## Setup Guide

### Initial Setup (Already Complete)

1. **Created `collaborator-access` branch**
   ```bash
   git checkout -b collaborator-access
   git push -u origin collaborator-access
   ```

2. **Set Vercel environment variables for Preview**
   ```bash
   vercel env add PRELAUNCH_LOCK_ENABLED preview
   # Enter: false

   vercel env add NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED preview
   # Enter: false
   ```

3. **Added Firebase authorized domain**
   - Go to: https://console.firebase.google.com/project/moshimoshi-de237/authentication/settings
   - Scroll to "Authorized domains"
   - Click "Add domain"
   - Add: `moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app`

4. **Configured Netlify (backup)**
   - Created `netlify.toml` with memory optimization
   - Added `.nvmrc` with Node 20 for stability
   - Set branch-specific env vars (though Vercel is primary)

---

## How to Share Access with Collaborators

### Step-by-Step Walkthrough

#### **Step 1: Access Vercel Dashboard**

1. Go to: **https://vercel.com/helyefabs-projects/moshimoshi**
2. Click on the **"Deployments"** tab at the top

#### **Step 2: Find the Collaborator Access Deployment**

1. Look for deployments with:
   - **Branch**: `collaborator-access`
   - **Status**: `● Ready` (green dot)
   - **Environment**: `Preview`

2. The deployment URL will look like:
   ```
   https://moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app
   ```

   ![Finding the deployment](https://i.imgur.com/example1.png)

#### **Step 3: Create a Shareable Link**

1. **Click on the deployment** (the one from `collaborator-access` branch)

2. You'll see a **"Share"** button at the top right of the deployment page

3. **Click "Share"**

4. A modal will appear with:
   - **Shareable Link**: A unique URL with a secret token
   - **Expiration**: Optional (can set when link expires)

5. **Copy the shareable link**
   - It will look like:
     ```
     https://moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app?_vercel_share=abc123def456
     ```

   ![Share button location](https://i.imgur.com/example2.png)

#### **Step 4: Send to Collaborators**

**Email Template:**

```
Subject: Moshimoshi App - Early Access Link

Hi [Name],

Thanks for agreeing to test the Moshimoshi app!

Here's your exclusive access link:
https://moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app?_vercel_share=abc123def456

What you can do:
✅ Sign up for a free account
✅ Explore all features
✅ Test Premium features (if needed)
✅ Provide feedback

Notes:
- This is a preview version - your data is real but may be reset
- The production site (moshimoshi.app) is still locked until Jan 23, 2026
- This link is unique and should not be shared publicly

Questions? Just reply to this email.

Looking forward to your feedback!
```

**Slack/Discord Template:**

```
🎉 Moshimoshi Early Access

Hey @collaborator! Here's your test link:
https://moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app?_vercel_share=abc123def456

You can:
• Sign up & explore all features
• Test the app end-to-end
• Share feedback directly with me

Don't share this link publicly - it's for testing only! 🔒
```

#### **Step 5: Verify Access (Optional)**

Before sending to collaborators, test the link yourself:

1. **Open the link in an incognito/private browser window**
2. **Verify**:
   - ✅ Page loads (no 401 error)
   - ✅ Landing page shows "Get Started" (not "Join Waitlist")
   - ✅ Sign up/login works
   - ✅ Dashboard is accessible

---

## Managing Shareable Links

### Creating a New Link

If you need to regenerate the link (e.g., previous one expired or was compromised):

1. Go to Vercel dashboard → Deployments
2. Click on the `collaborator-access` deployment
3. Click "Share" button
4. Click "Generate New Link" or use the existing one

### Revoking Access

**Option 1: Revoke Shareable Link**
1. Go to deployment page
2. Click "Share"
3. Click "Revoke Link"
4. The old link will stop working

**Option 2: Redeploy Branch**
1. Make any commit to `collaborator-access` branch
2. Push to GitHub
3. Old shareable links will expire when new deployment goes live
4. Generate new shareable link for the latest deployment

**Option 3: Delete Branch (Nuclear Option)**
```bash
git branch -D collaborator-access
git push origin --delete collaborator-access
```

---

## Troubleshooting

### Issue: Collaborator Gets 401 Error

**Cause**: Shareable link not used or expired

**Solution**:
1. Generate a fresh shareable link from Vercel
2. Ensure the link includes the `?_vercel_share=xxx` parameter
3. Send the new link to collaborator

---

### Issue: Firebase Auth Error - "Unauthorized Domain"

**Cause**: Preview domain not added to Firebase

**Solution**:
1. Go to: https://console.firebase.google.com/project/moshimoshi-de237/authentication/settings
2. Add domain: `moshimoshi-git-collaborator-access-helyefabs-projects.vercel.app`
3. Wait 1-2 minutes for propagation

---

### Issue: Collaborator Still Sees Waitlist Page

**Cause**: Environment variable not set correctly

**Solution**:
1. Verify Vercel env vars:
   ```bash
   vercel env pull .env.preview-check --environment=preview
   grep PRELAUNCH_LOCK_ENABLED .env.preview-check
   ```
   Should show: `PRELAUNCH_LOCK_ENABLED="false"`

2. If incorrect, reset:
   ```bash
   vercel env rm PRELAUNCH_LOCK_ENABLED preview
   vercel env add PRELAUNCH_LOCK_ENABLED preview
   # Enter: false

   vercel env rm NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED preview
   vercel env add NEXT_PUBLIC_PRELAUNCH_LOCK_ENABLED preview
   # Enter: false
   ```

3. Trigger new deployment:
   ```bash
   git commit --allow-empty -m "chore: trigger preview redeploy"
   git push origin collaborator-access
   ```

---

### Issue: Changes Not Reflected in Preview

**Cause**: Need to update the `collaborator-access` branch

**Solution**:
```bash
git checkout collaborator-access
git merge main
git push origin collaborator-access
```

---

## Maintenance

### Updating the Preview with Latest Changes

When you make changes to `main` and want them in the preview:

```bash
# 1. Switch to collaborator-access branch
git checkout collaborator-access

# 2. Merge latest changes from main
git merge main

# 3. Push to trigger new deployment
git push origin collaborator-access

# 4. Wait for Vercel to deploy (~5 minutes)

# 5. Generate new shareable link if needed
```

### Syncing Environment Variables

If you add new env vars to production, add them to preview too:

```bash
# Example: Adding a new API key
vercel env add NEW_API_KEY preview
# Enter the value when prompted
```

---

## Security Considerations

### ✅ Good Practices

- ✅ Use shareable links (they can be revoked)
- ✅ Set expiration dates on links if possible
- ✅ Only share with trusted collaborators
- ✅ Monitor Vercel analytics for unexpected traffic
- ✅ Revoke links after testing is complete

### ⚠️ Warnings

- ⚠️ **Don't** share the link publicly on social media
- ⚠️ **Don't** commit shareable link tokens to git
- ⚠️ **Don't** use the same link for multiple external parties (create individual links)
- ⚠️ **Don't** give collaborators access to Vercel dashboard (use shareable links only)

---

## Alternative: Adding Team Members

If you have frequent collaborators, consider adding them to your Vercel team:

1. Go to: https://vercel.com/teams/helyefabs-projects/settings/members
2. Click "Invite Member"
3. Enter their email
4. They'll get an invite and can access all preview deployments

**Cost**: Free for personal accounts (up to 10 members on Pro plan)

---

## Files Modified

| File | Purpose |
|------|---------|
| `.nvmrc` | Set Node 20 for Netlify stability |
| `netlify.toml` | Netlify config with memory optimization |
| `package.json` | Added `@netlify/plugin-nextjs` |
| `01_PRODUCTION_DOCS/COLLABORATOR_ACCESS_SETUP.md` | This documentation |

---

## Related Documentation

- [Pre-Launch Waitlist Implementation](./2-Payment-Monetization/PRELAUNCH_WAITLIST_IMPLEMENTATION.md)
- [Vercel Documentation - Deployment Protection](https://vercel.com/docs/security/deployment-protection)
- [Vercel Documentation - Shareable Links](https://vercel.com/docs/security/deployment-protection#shareable-links)
- [Firebase - Authorized Domains](https://firebase.google.com/docs/auth/web/redirect-best-practices#customize-trusted-domains)

---

## Quick Reference Commands

```bash
# Create shareable link (via dashboard - no CLI command)
# Go to: https://vercel.com/helyefabs-projects/moshimoshi/deployments
# Click deployment → Click "Share" → Copy link

# Update preview with latest changes
git checkout collaborator-access
git merge main
git push origin collaborator-access

# Check preview env vars
vercel env pull .env.preview --environment=preview
cat .env.preview | grep PRELAUNCH

# Trigger manual preview deploy
git checkout collaborator-access
git commit --allow-empty -m "chore: redeploy preview"
git push origin collaborator-access

# Delete shareable link (via dashboard only)
# Go to deployment → Click "Share" → Click "Revoke"
```

---

## Support

If collaborators encounter issues:

1. **First**, verify the shareable link is correct and not expired
2. **Check** Firebase authorized domains include preview URL
3. **Test** in incognito mode to rule out browser cache issues
4. **Regenerate** shareable link if necessary
5. **Contact** Vercel support if deployment protection issues persist

---

*Last Updated: December 25, 2025*
*Maintained by: HelyeFab*
*Platform: Vercel Preview Deployments*
