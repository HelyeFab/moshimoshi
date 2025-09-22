#!/usr/bin/env node

/**
 * Firebase Branding Configuration Script
 *
 * This script helps configure all user-facing Firebase branding elements:
 * - Project display name
 * - Support email
 * - Email templates
 * - Custom domains
 * - OAuth consent screen
 *
 * Usage: node scripts/configure-firebase-branding.js
 */

const admin = require('firebase-admin');
require('dotenv').config();

// Configuration for your branding
const BRANDING_CONFIG = {
  // Basic Information
  projectName: 'Moshimoshi',
  projectUrl: 'https://moshimoshi.app', // Update with your actual domain
  supportEmail: 'support@moshimoshi.app', // Update with your support email
  noReplyEmail: 'noreply@moshimoshi.app',

  // Brand Colors
  primaryColor: '#ec4899', // Pink
  secondaryColor: '#8b5cf6', // Purple

  // Company Information
  companyName: 'Moshimoshi',
  companyAddress: 'Your Company Address', // Update this
  privacyPolicyUrl: 'https://moshimoshi.app/privacy',
  termsOfServiceUrl: 'https://moshimoshi.app/terms',

  // Social Media (optional)
  twitterHandle: '@moshimoshi',
  facebookPage: 'moshimoshi',
};

console.log(`
========================================
🎨 Firebase Branding Configuration Guide
========================================

This guide will help you configure all user-facing Firebase elements
to show "Moshimoshi" instead of technical project IDs.

`);

console.log(`📋 STEP 1: Firebase Console Settings
=====================================
1. Go to: https://console.firebase.google.com/project/moshimoshi-de237/settings/general
2. Update these settings:
   - Project name: ${BRANDING_CONFIG.projectName}
   - Support email: ${BRANDING_CONFIG.supportEmail}
   - Public-facing name: ${BRANDING_CONFIG.projectName}

`);

console.log(`📧 STEP 2: Firebase Auth Email Templates
=========================================
1. Go to: https://console.firebase.google.com/project/moshimoshi-de237/authentication/emails
2. Customize each template:

   a) Email Address Verification:
      - Sender name: ${BRANDING_CONFIG.projectName}
      - From: ${BRANDING_CONFIG.noReplyEmail}
      - Reply to: ${BRANDING_CONFIG.supportEmail}
      - Subject: Verify your email for ${BRANDING_CONFIG.projectName}
      - Action URL: ${BRANDING_CONFIG.projectUrl}/auth/action

   b) Password Reset:
      - Sender name: ${BRANDING_CONFIG.projectName}
      - Subject: Reset your ${BRANDING_CONFIG.projectName} password

   c) Email Address Change:
      - Sender name: ${BRANDING_CONFIG.projectName}
      - Subject: Your ${BRANDING_CONFIG.projectName} email address has been changed

3. In the message body, replace all instances of:
   - %APP_NAME% with: ${BRANDING_CONFIG.projectName}
   - Project ID references with: ${BRANDING_CONFIG.projectName}

`);

console.log(`🌐 STEP 3: Custom Domain Configuration
=======================================
To use your own domain (${BRANDING_CONFIG.projectUrl}) instead of Firebase URLs:

1. Firebase Hosting Custom Domain:
   - Go to: https://console.firebase.google.com/project/moshimoshi-de237/hosting
   - Click "Add custom domain"
   - Follow the DNS verification steps

2. Dynamic Links (if using):
   - Go to: https://console.firebase.google.com/project/moshimoshi-de237/durablelinks
   - Set up a custom domain for links

`);

console.log(`🔐 STEP 4: OAuth Consent Screen (for Google Sign-in)
=====================================================
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Select your project: moshimoshi-de237
3. Configure:
   - App name: ${BRANDING_CONFIG.projectName}
   - User support email: ${BRANDING_CONFIG.supportEmail}
   - App logo: Upload your Moshimoshi logo
   - Application home page: ${BRANDING_CONFIG.projectUrl}
   - Privacy policy: ${BRANDING_CONFIG.privacyPolicyUrl}
   - Terms of service: ${BRANDING_CONFIG.termsOfServiceUrl}

`);

console.log(`💳 STEP 5: Stripe Integration Branding
=======================================
Since you're using Stripe, update these in Stripe Dashboard:
1. Go to: https://dashboard.stripe.com/settings/branding
2. Configure:
   - Business name: ${BRANDING_CONFIG.companyName}
   - Customer emails from: ${BRANDING_CONFIG.noReplyEmail}
   - Statement descriptor: MOSHIMOSHI
   - Shortened descriptor: MOSHI

3. Customer Portal branding:
   - Go to: https://dashboard.stripe.com/settings/billing/portal
   - Upload logo
   - Set primary color: ${BRANDING_CONFIG.primaryColor}

`);

console.log(`📱 STEP 6: PWA & App Configuration
===================================
Update these files in your project:
`);

// Generate manifest.json content
const manifestContent = {
  name: BRANDING_CONFIG.projectName,
  short_name: "Moshimoshi",
  description: "Learn Japanese with Moshimoshi",
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: BRANDING_CONFIG.primaryColor,
  icons: [
    {
      src: "/icon-192x192.png",
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: "/icon-512x512.png",
      sizes: "512x512",
      type: "image/png"
    }
  ]
};

console.log(`
1. Update public/manifest.json:
${JSON.stringify(manifestContent, null, 2)}

`);

console.log(`🎯 STEP 7: SEO & Meta Tags
===========================
Update your layout metadata in app/layout.tsx:

export const metadata = {
  title: '${BRANDING_CONFIG.projectName} - Learn Japanese',
  description: 'Master Japanese with ${BRANDING_CONFIG.projectName}',
  applicationName: '${BRANDING_CONFIG.projectName}',
  authors: [{ name: '${BRANDING_CONFIG.companyName}' }],
  generator: 'Next.js',
  keywords: ['Japanese', 'learning', 'education', 'language'],
  creator: '${BRANDING_CONFIG.companyName}',
  publisher: '${BRANDING_CONFIG.companyName}',

  openGraph: {
    title: '${BRANDING_CONFIG.projectName}',
    description: 'Learn Japanese the fun way',
    url: '${BRANDING_CONFIG.projectUrl}',
    siteName: '${BRANDING_CONFIG.projectName}',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: '${BRANDING_CONFIG.projectName}',
    description: 'Learn Japanese the fun way',
    creator: '${BRANDING_CONFIG.twitterHandle}',
  },
}

`);

console.log(`✅ STEP 8: Environment Variables
=================================
Add these to your .env.local and Vercel environment variables:

NEXT_PUBLIC_APP_NAME=${BRANDING_CONFIG.projectName}
NEXT_PUBLIC_APP_URL=${BRANDING_CONFIG.projectUrl}
NEXT_PUBLIC_SUPPORT_EMAIL=${BRANDING_CONFIG.supportEmail}
NEXT_PUBLIC_COMPANY_NAME=${BRANDING_CONFIG.companyName}

`);

console.log(`🚀 STEP 9: Deploy & Test
========================
After making all changes:

1. Test locally:
   - Sign up flow
   - Password reset
   - Email verification
   - Google sign-in

2. Deploy to production:
   git add .
   git commit -m "Configure Moshimoshi branding"
   git push

3. Verify in production:
   - Check all email templates
   - Test OAuth flow
   - Verify custom domains

`);

console.log(`
========================================
📌 Quick Checklist
========================================
[ ] Firebase Console project settings updated
[ ] Email templates customized
[ ] OAuth consent screen configured
[ ] Stripe branding updated
[ ] manifest.json updated
[ ] Meta tags updated
[ ] Environment variables added
[ ] Deployed and tested

Need help? Check the Firebase docs:
https://firebase.google.com/docs/auth/admin/email-action-links

`);

// Create a branding configuration file
const brandingConfigFile = `
// Moshimoshi Branding Configuration
// This file contains all branding settings for reference

export const MOSHIMOSHI_BRANDING = ${JSON.stringify(BRANDING_CONFIG, null, 2)};
`;

const fs = require('fs');
const path = require('path');

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'config', 'branding.ts'),
  brandingConfigFile
);

console.log('✅ Created src/config/branding.ts with your branding configuration');