#!/usr/bin/env node
/**
 * Seed Email Templates to Firestore
 *
 * Saves all starter templates to the email_templates collection
 *
 * Usage: node scripts/seed-email-templates.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize Firebase Admin
function initFirebase() {
  if (getApps().length > 0) {
    return getFirestore()
  }

  // Try to load service account from environment or file
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    join(__dirname, '..', 'serviceAccountKey.json')

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({
      credential: cert(serviceAccount),
    })
    console.log('✅ Firebase Admin initialized with service account')
  } catch (error) {
    console.error('❌ Failed to load service account:', error.message)
    console.log('Make sure GOOGLE_APPLICATION_CREDENTIALS is set or serviceAccountKey.json exists')
    process.exit(1)
  }

  return getFirestore()
}

// Email template base configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'

const EMAIL_ASSETS = {
  logo: `${BASE_URL}/logo-mo-generated.png`,
  logoWithText: `${BASE_URL}/logo-mo-with-text.svg`,
  doshi: `${BASE_URL}/doshi.png`,
  doshiEmma: `${BASE_URL}/doshi-emma.JPG`,
  social: {
    twitter: 'https://twitter.com/moshimoshiapp',
    discord: 'https://discord.gg/moshimoshi',
    youtube: 'https://youtube.com/@moshimoshi',
  },
  appUrl: BASE_URL,
}

const EMAIL_COLORS = {
  primary: '#ec4899',
  primaryDark: '#db2777',
  secondary: '#8b5cf6',
  accent: '#f97316',
  text: '#111827',
  textLight: '#6b7280',
  textMuted: '#9ca3af',
  background: '#f5f5f5',
  cardBg: '#ffffff',
  border: '#e5e7eb',
  success: '#10b981',
  error: '#ef4444',
}

const EMAIL_STYLES = {
  body: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${EMAIL_COLORS.text}; background-color: ${EMAIL_COLORS.background}; margin: 0; padding: 0;`,
  container: `max-width: 600px; margin: 0 auto; padding: 20px;`,
  card: `background: ${EMAIL_COLORS.cardBg}; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);`,
  heading1: `margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.text};`,
  heading2: `margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: ${EMAIL_COLORS.text};`,
  paragraph: `margin: 0 0 16px 0; font-size: 16px; color: ${EMAIL_COLORS.text};`,
  smallText: `font-size: 14px; color: ${EMAIL_COLORS.textLight};`,
  mutedText: `font-size: 12px; color: ${EMAIL_COLORS.textMuted};`,
  primaryButton: `display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, ${EMAIL_COLORS.primary}, ${EMAIL_COLORS.secondary}); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;`,
  logoStyle: `width: 60px; height: 60px; border-radius: 12px;`,
  characterImage: `width: 80px; height: 80px; border-radius: 50%; object-fit: cover;`,
  divider: `border: none; border-top: 1px solid ${EMAIL_COLORS.border}; margin: 24px 0;`,
}

// Helper functions
function emailHeader(options = {}) {
  const { showLogo = true, greeting, recipientName } = options

  const logoHtml = showLogo
    ? `<div style="margin-bottom: 20px;"><img src="${EMAIL_ASSETS.logo}" alt="Moshimoshi" style="${EMAIL_STYLES.logoStyle}" /></div>`
    : ''

  const greetingHtml = greeting
    ? `<h2 style="${EMAIL_STYLES.heading2}">${greeting}${recipientName ? `, ${recipientName}` : ''}!</h2>`
    : ''

  return `<div style="text-align: center; margin-bottom: 24px;">${logoHtml}${greetingHtml}</div>`
}

function emailFooter(options = {}) {
  const { unsubscribeUrl, showSocial = true, showDoshi = false } = options

  const doshiHtml = showDoshi
    ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${EMAIL_ASSETS.doshi}" alt="Doshi" style="width: 60px; height: 60px;" /></div>`
    : ''

  const socialHtml = showSocial
    ? `<div style="text-align: center; margin-bottom: 16px;">
        <a href="${EMAIL_ASSETS.social.twitter}" style="margin: 0 8px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">Twitter</a>
        <span style="color: ${EMAIL_COLORS.border};">|</span>
        <a href="${EMAIL_ASSETS.social.discord}" style="margin: 0 8px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">Discord</a>
        <span style="color: ${EMAIL_COLORS.border};">|</span>
        <a href="${EMAIL_ASSETS.social.youtube}" style="margin: 0 8px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">YouTube</a>
      </div>`
    : ''

  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="${EMAIL_STYLES.mutedText}"><a href="${unsubscribeUrl}" style="color: ${EMAIL_COLORS.textMuted}; text-decoration: underline;">Unsubscribe</a> from marketing emails</p>`
    : ''

  return `<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid ${EMAIL_COLORS.border}; text-align: center;">
    ${doshiHtml}${socialHtml}
    <p style="${EMAIL_STYLES.mutedText}">You're receiving this email because you signed up for Moshimoshi.</p>
    ${unsubscribeHtml}
    <p style="${EMAIL_STYLES.mutedText}; margin-top: 12px;">&copy; ${new Date().getFullYear()} Moshimoshi. All rights reserved.</p>
  </div>`
}

function characterMessage(options) {
  const { character, message, name } = options
  const imageSrc = character === 'doshi' ? EMAIL_ASSETS.doshi : EMAIL_ASSETS.doshiEmma
  const characterName = name || (character === 'doshi' ? 'Doshi' : 'Emma')

  return `<div style="display: flex; align-items: flex-start; gap: 16px; margin: 24px 0; padding: 20px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
    <img src="${imageSrc}" alt="${characterName}" style="${EMAIL_STYLES.characterImage}" />
    <div style="flex: 1;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: ${EMAIL_COLORS.text};">${characterName}</p>
      <p style="margin: 0; color: ${EMAIL_COLORS.textLight};">${message}</p>
    </div>
  </div>`
}

function ctaButton(options) {
  const { text, url } = options
  return `<div style="text-align: center; margin: 24px 0;"><a href="${url}" style="${EMAIL_STYLES.primaryButton}">${text}</a></div>`
}

function featureList(features) {
  const items = features.map(feature =>
    `<li style="margin-bottom: 8px; padding-left: 8px;"><span style="color: ${EMAIL_COLORS.success}; margin-right: 8px;">✓</span>${feature}</li>`
  ).join('')
  return `<ul style="list-style: none; padding: 0; margin: 16px 0;">${items}</ul>`
}

function highlightBox(options) {
  const { content, type = 'info', title } = options
  const colors = {
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
  }
  const c = colors[type]
  return `<div style="padding: 16px; background: ${c.bg}; border-left: 4px solid ${c.border}; border-radius: 8px; margin: 16px 0;">
    ${title ? `<p style="margin: 0 0 8px 0; font-weight: 600; color: ${c.text};">${title}</p>` : ''}
    <p style="margin: 0; color: ${c.text};">${content}</p>
  </div>`
}

function wrapEmailHtml(content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Moshimoshi</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="${EMAIL_STYLES.body}">
  <div style="${EMAIL_STYLES.container}">
    <div style="${EMAIL_STYLES.card}">
      ${content}
    </div>
  </div>
</body>
</html>`
}

// Template definitions
const templates = [
  {
    name: 'Welcome Email',
    slug: 'welcome',
    description: 'A friendly welcome email with Doshi greeting new users',
    category: 'transactional',
    subject: 'Welcome to Moshimoshi, {{name}}!',
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true, greeting: 'Welcome to Moshimoshi', recipientName: '{{name}}' })}
      <p style="${EMAIL_STYLES.paragraph}">We're so excited to have you join our community of Japanese learners!</p>
      ${characterMessage({ character: 'doshi', message: "Hi there! I'm Doshi, your learning companion. I'll be here to help you on your Japanese journey. Let's make learning fun together!" })}
      <p style="${EMAIL_STYLES.paragraph}"><strong>Here's what you can do with Moshimoshi:</strong></p>
      ${featureList([
        'Practice with YouTube shadowing exercises',
        'Learn kanji through visual connections',
        'Import your Anki decks for seamless study',
        'Track your progress with detailed stats',
        'Earn XP and maintain your streak',
      ])}
      ${ctaButton({ text: 'Start Learning Now', url: '{{appUrl}}' })}
      ${highlightBox({ type: 'info', title: 'Pro tip', content: 'Start with just 5 minutes a day. Consistency beats intensity when learning a language!' })}
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
    `),
    textContent: `Welcome to Moshimoshi, {{name}}!

We're so excited to have you join our community of Japanese learners!

Doshi says: "Hi there! I'm Doshi, your learning companion. I'll be here to help you on your Japanese journey. Let's make learning fun together!"

Here's what you can do with Moshimoshi:
- Practice with YouTube shadowing exercises
- Learn kanji through visual connections
- Import your Anki decks for seamless study
- Track your progress with detailed stats
- Earn XP and maintain your streak

Start learning: {{appUrl}}

Pro tip: Start with just 5 minutes a day. Consistency beats intensity when learning a language!

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'appUrl', label: 'App URL', type: 'url', defaultValue: 'https://moshimoshi.app', required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
  {
    name: 'Feature Announcement',
    slug: 'feature-announcement',
    description: 'Announce new features with Emma (developer) message',
    category: 'marketing',
    subject: 'New in Moshimoshi: {{featureTitle}}',
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true })}
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.primary}, ${EMAIL_COLORS.secondary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">NEW FEATURE</span>
      </div>
      <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">{{featureTitle}}</h1>
      <p style="${EMAIL_STYLES.paragraph}">Hey {{name}},</p>
      <p style="${EMAIL_STYLES.paragraph}">We've been working hard on something special, and we're thrilled to share it with you!</p>
      ${characterMessage({ character: 'emma', message: "I've been working on this feature for a while now. I really hope you'll love it as much as I enjoyed building it!", name: 'Emma (Developer)' })}
      <p style="${EMAIL_STYLES.paragraph}">{{featureDescription}}</p>
      ${ctaButton({ text: 'Try It Now', url: '{{featureUrl}}' })}
      <p style="${EMAIL_STYLES.smallText}; text-align: center;">We'd love to hear your feedback! Reply to this email anytime.</p>
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}' })}
    `),
    textContent: `NEW FEATURE: {{featureTitle}}

Hey {{name}},

We've been working hard on something special, and we're thrilled to share it with you!

Emma (Developer) says: "I've been working on this feature for a while now. I really hope you'll love it as much as I enjoyed building it!"

{{featureDescription}}

Try it now: {{featureUrl}}

We'd love to hear your feedback! Reply to this email anytime.

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'featureTitle', label: 'Feature Title', type: 'string', defaultValue: 'Amazing New Feature', required: true },
      { name: 'featureDescription', label: 'Feature Description', type: 'string', defaultValue: 'This feature will help you learn Japanese even faster!', required: true },
      { name: 'featureUrl', label: 'Feature URL', type: 'url', defaultValue: 'https://moshimoshi.app', required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
  {
    name: 'New Content Release',
    slug: 'new-content-release',
    description: 'Announce new lessons, videos, or content with customizable type',
    category: 'marketing',
    subject: 'New {{contentType}}: {{contentTitle}}',
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true })}
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.accent}, ${EMAIL_COLORS.primary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">{{contentType}}</span>
      </div>
      <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">{{contentTitle}}</h1>
      <p style="${EMAIL_STYLES.paragraph}">Hey {{name}},</p>
      <p style="${EMAIL_STYLES.paragraph}">We just released something new that we think you'll love!</p>
      ${characterMessage({ character: 'doshi', message: '{{doshiMessage}}' })}
      <div style="background: ${EMAIL_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
        <h3 style="${EMAIL_STYLES.heading2}; margin-bottom: 16px;">{{contentTitle}}</h3>
        <p style="${EMAIL_STYLES.paragraph}; margin-bottom: 0;">{{contentDescription}}</p>
      </div>
      ${ctaButton({ text: 'Check It Out', url: '{{contentUrl}}' })}
      <p style="${EMAIL_STYLES.smallText}; text-align: center;">We're constantly working to bring you more content to help your Japanese journey!</p>
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}' })}
    `),
    textContent: `{{contentType}}: {{contentTitle}}

Hey {{name}},

We just released something new that we think you'll love!

Doshi says: "{{doshiMessage}}"

{{contentTitle}}
{{contentDescription}}

Check it out: {{contentUrl}}

We're constantly working to bring you more content to help your Japanese journey!

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'contentType', label: 'Content Type', type: 'string', defaultValue: 'NEW LESSON', required: true },
      { name: 'contentTitle', label: 'Content Title', type: 'string', defaultValue: 'Learn JLPT N5 Vocabulary', required: true },
      { name: 'contentDescription', label: 'Content Description', type: 'string', defaultValue: 'Master the essential vocabulary for JLPT N5 with interactive exercises and spaced repetition.', required: true },
      { name: 'contentUrl', label: 'Content URL', type: 'url', defaultValue: 'https://moshimoshi.app', required: true },
      { name: 'doshiMessage', label: 'Doshi Message', type: 'string', defaultValue: "I'm so excited to share this with you! This new content is perfect for taking your Japanese to the next level!", required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
  {
    name: 'Thank You Note',
    slug: 'thank-you-note',
    description: 'Express gratitude to subscribers with heartfelt message',
    category: 'marketing',
    subject: 'A Heartfelt Thank You from Moshimoshi 💖',
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true })}
      <div style="text-align: center; margin-bottom: 24px;"><span style="font-size: 48px;">💖</span></div>
      <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">Thank You, {{name}}!</h1>
      <p style="${EMAIL_STYLES.paragraph}">We wanted to take a moment to express our heartfelt gratitude for being part of the Moshimoshi family.</p>
      ${characterMessage({ character: 'doshi', message: "You're amazing! Every day you spend learning Japanese brings you one step closer to your goals. I'm so proud to be on this journey with you!" })}
      <p style="${EMAIL_STYLES.paragraph}">{{personalMessage}}</p>
      ${highlightBox({ type: 'info', title: 'Your Impact', content: '{{impactMessage}}' })}
      ${characterMessage({ character: 'emma', message: "Building Moshimoshi has been a labor of love, and knowing you're using it to learn Japanese makes it all worthwhile. Thank you for believing in us!", name: 'Emma (Developer)' })}
      <p style="${EMAIL_STYLES.paragraph}; text-align: center;">With gratitude,<br/><strong>The Moshimoshi Team</strong></p>
      ${ctaButton({ text: 'Continue Learning', url: '{{appUrl}}' })}
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
    `),
    textContent: `Thank You, {{name}}!

We wanted to take a moment to express our heartfelt gratitude for being part of the Moshimoshi family.

Doshi says: "You're amazing! Every day you spend learning Japanese brings you one step closer to your goals. I'm so proud to be on this journey with you!"

{{personalMessage}}

Your Impact: {{impactMessage}}

Emma (Developer) says: "Building Moshimoshi has been a labor of love, and knowing you're using it to learn Japanese makes it all worthwhile. Thank you for believing in us!"

With gratitude,
The Moshimoshi Team

Continue Learning: {{appUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'personalMessage', label: 'Personal Message', type: 'string', defaultValue: 'Your dedication to learning Japanese inspires us to keep improving Moshimoshi every day.', required: true },
      { name: 'impactMessage', label: 'Impact Message', type: 'string', defaultValue: 'Together with learners like you, we\'ve helped thousands of people on their Japanese learning journey.', required: true },
      { name: 'appUrl', label: 'App URL', type: 'url', defaultValue: 'https://moshimoshi.app', required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
  {
    name: 'Streak Reminder',
    slug: 'streak-reminder',
    description: 'Gentle nudge to maintain learning streak',
    category: 'notification',
    subject: "Your {{streakDays}}-day streak is waiting!",
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true })}
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">🔥</span>
        <h2 style="${EMAIL_STYLES.heading2}; margin-top: 12px;">Don't let your streak end!</h2>
      </div>
      <p style="${EMAIL_STYLES.paragraph}">Hey {{name}},</p>
      <p style="${EMAIL_STYLES.paragraph}">You've been on a <strong>{{streakDays}}-day streak</strong>! That's amazing dedication.</p>
      ${characterMessage({ character: 'doshi', message: "You're doing great! Just a quick 5-minute session today will keep your streak alive. I believe in you!" })}
      <div style="text-align: center; padding: 20px; background: ${EMAIL_COLORS.background}; border-radius: 12px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: ${EMAIL_COLORS.textLight};">Current Streak</p>
        <p style="margin: 0; font-size: 36px; font-weight: 700; color: ${EMAIL_COLORS.primary};">{{streakDays}} days</p>
      </div>
      ${ctaButton({ text: 'Keep My Streak', url: '{{appUrl}}' })}
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
    `),
    textContent: `Don't let your streak end!

Hey {{name}},

You've been on a {{streakDays}}-day streak! That's amazing dedication.

Doshi says: "You're doing great! Just a quick 5-minute session today will keep your streak alive. I believe in you!"

Current Streak: {{streakDays}} days

Keep your streak: {{appUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'streakDays', label: 'Streak Days', type: 'number', defaultValue: '7', required: true },
      { name: 'appUrl', label: 'App URL', type: 'url', defaultValue: 'https://moshimoshi.app', required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
  {
    name: 'Weekly Progress',
    slug: 'weekly-progress',
    description: 'Summary of weekly learning stats',
    category: 'notification',
    subject: 'Your Week in Review: {{xpEarned}} XP earned!',
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true })}
      <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">Your Weekly Progress</h1>
      <p style="${EMAIL_STYLES.paragraph}; text-align: center; color: ${EMAIL_COLORS.textLight};">Week of {{weekDate}}</p>
      <p style="${EMAIL_STYLES.paragraph}">Hey {{name}}, here's what you accomplished this week:</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.primary};">{{xpEarned}}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">XP Earned</p>
        </div>
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.secondary};">{{wordsLearned}}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Words Learned</p>
        </div>
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.success};">{{minutesPracticed}}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Minutes</p>
        </div>
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.accent};">{{currentStreak}}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Day Streak</p>
        </div>
      </div>
      ${characterMessage({ character: 'doshi', message: '{{personalMessage}}' })}
      ${ctaButton({ text: 'Continue Learning', url: '{{appUrl}}' })}
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}' })}
    `),
    textContent: `Your Weekly Progress - Week of {{weekDate}}

Hey {{name}}, here's what you accomplished this week:

- XP Earned: {{xpEarned}}
- Words Learned: {{wordsLearned}}
- Minutes Practiced: {{minutesPracticed}}
- Current Streak: {{currentStreak}} days

Doshi says: "{{personalMessage}}"

Continue learning: {{appUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'weekDate', label: 'Week Date', type: 'date', defaultValue: 'January 20, 2025', required: true },
      { name: 'xpEarned', label: 'XP Earned', type: 'number', defaultValue: '450', required: true },
      { name: 'wordsLearned', label: 'Words Learned', type: 'number', defaultValue: '32', required: true },
      { name: 'minutesPracticed', label: 'Minutes Practiced', type: 'number', defaultValue: '120', required: true },
      { name: 'currentStreak', label: 'Current Streak', type: 'number', defaultValue: '14', required: true },
      { name: 'personalMessage', label: 'Personal Message', type: 'string', defaultValue: "Wow, what a week! You're making incredible progress. Keep up the amazing work!", required: true },
      { name: 'appUrl', label: 'App URL', type: 'url', defaultValue: 'https://moshimoshi.app', required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
  {
    name: 'Adjectives 100 Master Deck',
    slug: 'adjectives-100-master-deck',
    description: 'Announce the new 100 Japanese Adjectives Master Deck in the Deck Market',
    category: 'marketing',
    subject: 'New Deck: 100 Japanese Adjectives Master Deck',
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true })}
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.accent}, ${EMAIL_COLORS.primary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">NEW DECK</span>
      </div>
      <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">100 Japanese Adjectives<br/>Master Deck</h1>
      <p style="text-align: center; margin: 0 0 24px 0; font-size: 16px; color: ${EMAIL_COLORS.textLight};">50 い-adjectives + 50 な-adjectives &mdash; 300 flashcards</p>
      <p style="${EMAIL_STYLES.paragraph}">Hey {{name}},</p>
      <p style="${EMAIL_STYLES.paragraph}">Adjectives are what make your Japanese expressive and natural. We just dropped a brand new deck in the Deck Market designed to take you from basic descriptions to confident, natural-sounding sentences.</p>
      ${characterMessage({ character: 'doshi', message: "Adjectives bring your Japanese to life! This deck covers 100 essential い and な adjectives with negation drills and noun-pairing practice. Trust me, your sentences are about to get a lot more 楽しい!" })}
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 24px 0;">
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.primary};">100</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Adjectives</p>
        </div>
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.secondary};">300</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Flashcards</p>
        </div>
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.accent};">3</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Card Types</p>
        </div>
      </div>
      <p style="${EMAIL_STYLES.paragraph}"><strong>Each adjective is drilled 3 ways:</strong></p>
      ${featureList([
        'Meaning & reading with furigana',
        'Negative conjugation (否定形) practice',
        'Noun modification — build real phrases',
      ])}
      ${highlightBox({ type: 'info', title: 'Sample from the deck', content: '<strong>大きい</strong> (おおきい) — Big / large<br/>Negative: 大きくないです<br/>Noun mod: 大きい家 — A big house' })}
      ${ctaButton({ text: 'Get the Deck', url: 'https://moshimoshi.app/deckmarket?utm_source=email&utm_medium=campaign&utm_campaign=adjectives-100-deck' })}
      <p style="${EMAIL_STYLES.smallText}; text-align: center;">Available now in the Deck Market. Powered by our SRS engine for optimal retention.</p>
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
    `),
    textContent: `NEW DECK: 100 Japanese Adjectives Master Deck
50 い-adjectives + 50 な-adjectives — 300 flashcards

Hey {{name}},

Adjectives are what make your Japanese expressive and natural. We just dropped a brand new deck in the Deck Market designed to take you from basic descriptions to confident, natural-sounding sentences.

Doshi says: "Adjectives bring your Japanese to life! This deck covers 100 essential い and な adjectives with negation drills and noun-pairing practice. Trust me, your sentences are about to get a lot more 楽しい!"

100 Adjectives | 300 Flashcards | 3 Card Types

Each adjective is drilled 3 ways:
- Meaning & reading with furigana
- Negative conjugation (否定形) practice
- Noun modification — build real phrases

Sample: 大きい (おおきい) — Big / large
Negative: 大きくないです
Noun mod: 大きい家 — A big house

Get the deck: https://moshimoshi.app/deckmarket?utm_source=email&utm_medium=campaign&utm_campaign=adjectives-100-deck

Available now in the Deck Market. Powered by our SRS engine for optimal retention.

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
  {
    name: 'Lonely Castle in the Mirror - Library',
    slug: 'lonely-castle-mirror-library',
    description: 'Announce かがみの孤城 (Lonely Castle in the Mirror) book added to Library',
    category: 'marketing',
    subject: 'New Book: かがみの孤城 — Lonely Castle in the Mirror',
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true })}
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.accent}, ${EMAIL_COLORS.primary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">NEW BOOK</span>
      </div>
      <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">かがみの孤城<br/><span style="font-size: 22px; font-weight: 600; color: ${EMAIL_COLORS.textLight};">Lonely Castle in the Mirror</span></h1>
      <p style="text-align: center; margin: 0 0 24px 0; font-size: 16px; color: ${EMAIL_COLORS.textLight};">By Mizuki Tsujimura (辻村深月) • 2017</p>
      <p style="${EMAIL_STYLES.paragraph}">Hey {{name}},</p>
      <p style="${EMAIL_STYLES.paragraph}">We just added a beautiful new story to the Library — a touching tale about friendship, courage, and overcoming adversity.</p>
      ${characterMessage({ character: 'doshi', message: "This is one of my favorite modern Japanese novels! かがみの孤城 is perfect for intermediate learners — the story pulls you in and the vocabulary feels natural. You'll learn so much while getting lost in this touching story!" })}
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 24px 0;">
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.primary};">805</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Words</p>
        </div>
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.secondary};">~5</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Min Read</p>
        </div>
        <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: ${EMAIL_COLORS.accent};">N3-N2</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">JLPT Level</p>
        </div>
      </div>
      <p style="${EMAIL_STYLES.paragraph}"><strong>Reading features:</strong></p>
      ${featureList([
        'Carefully segmented chapters for easier reading',
        'Built-in dictionary support for lookups',
        'Progress tracking as you read',
        'Natural, modern Japanese vocabulary',
        'Engaging story that motivates you to continue',
      ])}
      ${highlightBox({ type: 'info', title: 'Story Summary', content: '<strong>本作では、いじめに苦しむ中学生の心が、鏡の中の不思議な城に導かれ、同じような境遇の仲間たちと出会う物語です。彼女たちは共に試練を乗り越え、友情を育んでいきます。</strong><br/><br/><em>A middle school student suffering from bullying finds her way to a mysterious castle in a mirror, where she meets companions facing similar struggles. Together, they overcome trials and build lasting friendships.</em>' })}
      ${ctaButton({ text: 'Start Reading Now', url: 'https://moshimoshi.app/library?utm_source=email&utm_medium=campaign&utm_campaign=lonely-castle-mirror' })}
      <p style="${EMAIL_STYLES.smallText}; text-align: center;">Perfect for intermediate learners looking to read authentic Japanese literature.</p>
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
    `),
    textContent: `NEW BOOK: かがみの孤城 — Lonely Castle in the Mirror
By Mizuki Tsujimura (辻村深月) • 2017

Hey {{name}},

We just added a beautiful new story to the Library — a touching tale about friendship, courage, and overcoming adversity.

Doshi says: "This is one of my favorite modern Japanese novels! かがみの孤城 is perfect for intermediate learners — the story pulls you in and the vocabulary feels natural. You'll learn so much while getting lost in this touching story!"

805 Words | ~5 Min Read | N3-N2 JLPT Level

Reading features:
- Carefully segmented chapters for easier reading
- Built-in dictionary support for lookups
- Progress tracking as you read
- Natural, modern Japanese vocabulary
- Engaging story that motivates you to continue

Story Summary:
本作では、いじめに苦しむ中学生の心が、鏡の中の不思議な城に導かれ、同じような境遇の仲間たちと出会う物語です。彼女たちは共に試練を乗り越え、友情を育んでいきます。

A middle school student suffering from bullying finds her way to a mysterious castle in a mirror, where she meets companions facing similar struggles. Together, they overcome trials and build lasting friendships.

Start reading: https://moshimoshi.app/library?utm_source=email&utm_medium=campaign&utm_campaign=lonely-castle-mirror

Perfect for intermediate learners looking to read authentic Japanese literature.

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
  {
    name: 'Newsletter',
    slug: 'newsletter',
    description: 'Clean template for general announcements',
    category: 'marketing',
    subject: '{{subject}}',
    htmlContent: wrapEmailHtml(`
      ${emailHeader({ showLogo: true })}
      <h1 style="${EMAIL_STYLES.heading1}">{{headline}}</h1>
      <p style="${EMAIL_STYLES.paragraph}">Hey {{name}},</p>
      <p style="${EMAIL_STYLES.paragraph}">{{introText}}</p>
      <hr style="${EMAIL_STYLES.divider}" />
      {{mainContent}}
      <hr style="${EMAIL_STYLES.divider}" />
      <p style="${EMAIL_STYLES.paragraph}">{{closingText}}</p>
      ${ctaButton({ text: '{{ctaText}}', url: '{{ctaUrl}}' })}
      ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
    `),
    textContent: `{{headline}}

Hey {{name}},

{{introText}}

---

{{mainContent}}

---

{{closingText}}

{{ctaText}}: {{ctaUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`,
    variables: [
      { name: 'name', label: 'User Name', type: 'string', defaultValue: 'Learner', required: true },
      { name: 'subject', label: 'Email Subject', type: 'string', defaultValue: 'Moshimoshi Newsletter', required: true },
      { name: 'headline', label: 'Headline', type: 'string', defaultValue: 'This Month at Moshimoshi', required: true },
      { name: 'introText', label: 'Intro Text', type: 'string', defaultValue: "Here's what's been happening and what's coming next!", required: true },
      { name: 'mainContent', label: 'Main Content', type: 'string', defaultValue: 'Your main newsletter content goes here...', required: true },
      { name: 'closingText', label: 'Closing Text', type: 'string', defaultValue: "Thanks for being part of our community. We can't wait to see what you'll learn next!", required: true },
      { name: 'ctaText', label: 'CTA Button Text', type: 'string', defaultValue: 'Start Learning', required: true },
      { name: 'ctaUrl', label: 'CTA URL', type: 'url', defaultValue: 'https://moshimoshi.app', required: true },
      { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
    ],
  },
]

async function seedTemplates() {
  console.log('🚀 Starting email template seeding...\n')

  const db = initFirebase()
  const collection = db.collection('email_templates')
  const now = Timestamp.now()

  let created = 0
  let skipped = 0

  for (const template of templates) {
    // Check if template already exists by slug
    const existing = await collection.where('slug', '==', template.slug).get()

    if (!existing.empty) {
      console.log(`⏭️  Skipping "${template.name}" (slug: ${template.slug}) - already exists`)
      skipped++
      continue
    }

    const docData = {
      ...template,
      status: 'active',
      createdBy: 'system',
      createdAt: now,
      updatedBy: 'system',
      updatedAt: now,
    }

    const docRef = await collection.add(docData)
    console.log(`✅ Created "${template.name}" (id: ${docRef.id})`)
    created++
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Created: ${created}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Total: ${templates.length}`)
  console.log('\n✨ Done!')
}

// Run the seeding
seedTemplates().catch(console.error)
