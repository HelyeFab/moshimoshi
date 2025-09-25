# OAuth Consent Screen Setup Guide for Moshimoshi

## Overview
This guide will help you configure the Google OAuth Consent Screen with proper Moshimoshi branding. Users will see your brand instead of technical project IDs when signing in with Google.

## Step 1: Generate Logo Files

1. Open `scripts/generate-oauth-logos.html` in your browser:
   ```bash
   open scripts/generate-oauth-logos.html
   ```

2. Download the **120x120 PNG** (recommended by Google)

## Step 2: Access OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Make sure your project is selected: `moshimoshi-de237`
3. Click **"EDIT APP"** button

## Step 3: OAuth Consent Screen Configuration

### Screen 1: OAuth consent screen

Fill in these fields:

#### App Information
- **App name**: `Moshimoshi`
- **User support email**: `support@moshimoshi.app`
- **App logo**: Upload the `moshimoshi-logo-120.png` you generated

#### App Domain
- **Application home page**: `https://moshimoshi.app`
- **Application privacy policy link**: `https://moshimoshi.app/privacy`
- **Application terms of service link**: `https://moshimoshi.app/terms`

#### Authorized domains
Add your domain:
- `moshimoshi.app`

#### Developer contact information
- **Email addresses**: `support@moshimoshi.app`

Click **"SAVE AND CONTINUE"**

### Screen 2: Scopes

The scopes should already be configured. These are typically:
- `email`
- `profile`
- `openid`

Click **"SAVE AND CONTINUE"**

### Screen 3: Test users (if in testing mode)

Add test emails if your app is still in testing mode:
- `emmanuelfabiani23@gmail.com`
- Any other test accounts

Click **"SAVE AND CONTINUE"**

### Screen 4: Summary

Review all settings and click **"BACK TO DASHBOARD"**

## Step 4: Publishing Status

### For Testing Mode:
- Your app will work for test users only
- No verification needed
- Good for development

### For Production:
1. Click **"PUBLISH APP"** button
2. For personal/internal use: Can publish immediately
3. For public use with sensitive scopes: May need verification

## Step 5: Test Your Configuration

1. Sign out of your app
2. Click "Sign in with Google"
3. You should see:
   - Moshimoshi logo
   - "Sign in to Moshimoshi" (not project ID)
   - Your privacy and terms links at the bottom

## What Users Will See

### Before Configuration:
```
Sign in to continue to moshimoshi-de237.firebaseapp.com
[Generic icon]
```

### After Configuration:
```
Sign in to Moshimoshi
[Your Moshimoshi logo]
By continuing, you agree to Moshimoshi's Terms of Service and Privacy Policy
```

## Verification Requirements (If Needed)

Google may require verification if you:
- Use sensitive scopes
- Have many users
- Are a public-facing app

Verification involves:
- Domain ownership verification
- Privacy policy review
- $15-75 fee (one-time)
- 3-5 business days review

## Troubleshooting

### Logo Not Showing:
- Ensure PNG format (not SVG)
- File size under 5MB
- Clear browser cache
- Wait 5-10 minutes for changes to propagate

### App Name Not Updating:
- Check you saved all changes
- Sign out completely and sign in again
- Try incognito/private browsing mode

### "Unverified App" Warning:
- Normal for apps in testing mode
- Publish app to remove for your test users
- Get verified for public users

## Additional Branding Locations

### 1. Firebase Auth Templates
Already configured in Firebase Console:
- Email verification
- Password reset
- Email change notifications

### 2. Google Account Settings
Users will see "Moshimoshi" in:
- https://myaccount.google.com/permissions
- Connected apps list
- Security checkup

### 3. Stripe Customer Portal
Configure at: https://dashboard.stripe.com/settings/branding
- Upload same logo
- Set brand colors

## Quick Checklist

- [ ] Generated logo PNG files (120x120 recommended)
- [ ] Uploaded logo to OAuth consent screen
- [ ] Set app name to "Moshimoshi"
- [ ] Added support email
- [ ] Added privacy policy URL
- [ ] Added terms of service URL
- [ ] Added authorized domain
- [ ] Tested sign-in flow
- [ ] Logo appears correctly
- [ ] App name shows "Moshimoshi" not project ID

## Next Steps

1. If you need custom email domain:
   - Set up custom SMTP with SendGrid/Mailgun
   - Configure in Firebase Auth settings

2. For production launch:
   - Publish OAuth consent screen
   - Consider verification if needed
   - Monitor user feedback

3. Brand consistency:
   - Use same logo everywhere
   - Consistent color scheme (#fd8686 pink)
   - Same support email across services

---

Last Updated: January 2025
For help: support@moshimoshi.app