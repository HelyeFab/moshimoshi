#!/usr/bin/env node
/**
 * Seed Co-Journey Series Announcement Email Template to Firestore
 *
 * Creates the "Moshi's Minna no Nihongo Adventure" announcement template.
 *
 * Usage: node scripts/seed-co-journey-template.mjs
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
  doshi: `${BASE_URL}/doshi.png`,
  doshiEmma: `${BASE_URL}/doshi-emma.JPG`,
  social: {
    x: 'https://x.com/AppMoshimoshi',
    instagram: 'https://www.instagram.com/moshimoshi.app/',
    tiktok: 'https://www.tiktok.com/@moshimoshiapp23',
    facebook: 'https://www.facebook.com/profile.php?id=61583293235389',
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
  const { unsubscribeUrl, showDoshi = false } = options
  const doshiHtml = showDoshi
    ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${EMAIL_ASSETS.doshi}" alt="Doshi" style="width: 60px; height: 60px;" /></div>`
    : ''
  const socialHtml = `<div style="text-align: center; margin-bottom: 16px;">
    <a href="${EMAIL_ASSETS.social.x}" style="margin: 0 6px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">X</a>
    <span style="color: ${EMAIL_COLORS.border};">|</span>
    <a href="${EMAIL_ASSETS.social.instagram}" style="margin: 0 6px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">Instagram</a>
    <span style="color: ${EMAIL_COLORS.border};">|</span>
    <a href="${EMAIL_ASSETS.social.tiktok}" style="margin: 0 6px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">TikTok</a>
    <span style="color: ${EMAIL_COLORS.border};">|</span>
    <a href="${EMAIL_ASSETS.social.facebook}" style="margin: 0 6px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">Facebook</a>
  </div>`
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
    `<li style="margin-bottom: 8px; padding-left: 8px;"><span style="color: ${EMAIL_COLORS.success}; margin-right: 8px;">&#10003;</span>${feature}</li>`
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Moshimoshi</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        padding: 12px !important;
      }
      .email-card {
        padding: 20px !important;
      }
      .mobile-heading {
        font-size: 24px !important;
      }
      .mobile-subheading {
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body style="${EMAIL_STYLES.body} -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div class="email-container" style="${EMAIL_STYLES.container} width: 100%;">
    <div class="email-card" style="${EMAIL_STYLES.card}">
      ${content}
    </div>
  </div>
</body>
</html>`
}

// Co-Journey Announcement Template
const template = {
  name: 'Co-Journey Series Announcement',
  slug: 'co-journey-announcement',
  description: "Announce Moshi's Minna no Nihongo Adventure video series - a Co-Journey where Moshi learns all 50 lessons of Minna no Nihongo from scratch on TikTok.",
  category: 'marketing',
  subject: "Moshi's learning ALL of Minna no Nihongo - come join the adventure!",
  htmlContent: wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.accent}, ${EMAIL_COLORS.primary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
        NEW SERIES
      </span>
    </div>

    <h1 class="mobile-heading" style="${EMAIL_STYLES.heading1} text-align: center;">
      Moshi's Minna no Nihongo Adventure
    </h1>

    <p class="mobile-subheading" style="${EMAIL_STYLES.paragraph} text-align: center; color: ${EMAIL_COLORS.textLight}; font-size: 18px;">
      50 lessons. One red panda. Zero excuses.
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      Hey {{name}},
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      We've got something exciting to share &mdash; Moshi is taking on his biggest challenge yet!
    </p>

    ${characterMessage({
      character: 'doshi',
      message: "I looked at all 50 lessons of Minna no Nihongo and thought... FIFTY?! But then Pastel reminded me: you don't climb a mountain in one jump. You take it one step at a time. So that's what we're doing!",
    })}

    <!-- Series Card -->
    <div style="background: linear-gradient(135deg, #fff7ed, #fef3c7); border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #fed7aa;">
      <h3 style="${EMAIL_STYLES.heading2} margin-bottom: 8px; text-align: center;">
        Moshi's Co-Journey
      </h3>
      <p style="margin: 0 0 16px 0; text-align: center; color: ${EMAIL_COLORS.textLight}; font-size: 14px;">
        <strong>&#12415;&#12435;&#12394;&#12398;&#26085;&#26412;&#35486;</strong> &mdash; Minna no Nihongo
      </p>
      <p style="${EMAIL_STYLES.paragraph} margin-bottom: 0;">
        A brand new video series where Moshi learns every lesson of Minna no Nihongo from scratch. Short videos. Real grammar. Real vocabulary. One lesson at a time.
      </p>
    </div>

    ${featureList([
      'Follow along with Moshi lesson by lesson',
      'Short, focused videos you can watch anytime',
      'Real Minna no Nihongo grammar and vocabulary',
      'Start from zero &mdash; no prior Japanese needed',
      'New episodes dropping regularly on TikTok',
    ])}

    <div style="text-align: center; padding: 20px; background: ${EMAIL_COLORS.background}; border-radius: 12px; margin: 20px 0;">
      <p style="margin: 0 0 4px 0; font-size: 14px; color: ${EMAIL_COLORS.textLight};">Lesson 1 drops</p>
      <p style="margin: 0 0 4px 0; font-size: 32px; font-weight: 700; color: ${EMAIL_COLORS.primary};">{{launchDate}}</p>
      <p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.textLight};">on TikTok</p>
    </div>

    ${ctaButton({ text: 'Follow on TikTok', url: 'https://www.tiktok.com/@moshimoshiapp23' })}

    <div style="text-align: center; margin-top: 8px;">
      <a href="${BASE_URL}" style="${EMAIL_STYLES.smallText} color: ${EMAIL_COLORS.primary}; text-decoration: underline;">
        Or continue learning on moshimoshi.app
      </a>
    </div>

    ${characterMessage({
      character: 'emma',
      message: "I built Moshimoshi to help people learn Japanese in a fun, supportive way. This series is the next step &mdash; learning alongside Moshi, one lesson at a time. I hope you'll join us!",
      name: 'Emma (Developer)',
    })}

    ${highlightBox({
      type: 'info',
      title: 'Already studying Minna no Nihongo?',
      content: "Whether you're on lesson 1 or lesson 40, this series is for you. Follow along, review what you've learned, or get a fresh perspective on tricky grammar points!",
    })}

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
  `),
  textContent: `NEW SERIES: Moshi's Minna no Nihongo Adventure

50 lessons. One red panda. Zero excuses.

Hey {{name}},

We've got something exciting to share - Moshi is taking on his biggest challenge yet!

Doshi says: "I looked at all 50 lessons of Minna no Nihongo and thought... FIFTY?! But then Pastel reminded me: you don't climb a mountain in one jump. You take it one step at a time. So that's what we're doing!"

---

MOSHI'S CO-JOURNEY: Minna no Nihongo

A brand new video series where Moshi learns every lesson of Minna no Nihongo from scratch. Short videos. Real grammar. Real vocabulary. One lesson at a time.

What to expect:
- Follow along with Moshi lesson by lesson
- Short, focused videos you can watch anytime
- Real Minna no Nihongo grammar and vocabulary
- Start from zero - no prior Japanese needed
- New episodes dropping regularly on TikTok

Lesson 1 drops {{launchDate}} on TikTok!

Follow on TikTok: https://www.tiktok.com/@moshimoshiapp23
Or keep learning: https://moshimoshi.app

Emma (Developer) says: "I built Moshimoshi to help people learn Japanese in a fun, supportive way. This series is the next step - learning alongside Moshi, one lesson at a time. I hope you'll join us!"

Already studying Minna no Nihongo? Whether you're on lesson 1 or lesson 40, this series is for you. Follow along, review what you've learned, or get a fresh perspective on tricky grammar points!

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
(c) ${new Date().getFullYear()} Moshimoshi. All rights reserved.`,
  variables: [
    { name: 'name', label: 'Recipient Name', type: 'string', defaultValue: 'Learner', required: true },
    { name: 'launchDate', label: 'Launch Date', type: 'string', defaultValue: 'February 14th', required: true },
    { name: 'unsubscribeUrl', label: 'Unsubscribe URL', type: 'url', defaultValue: 'https://moshimoshi.app/api/email/unsubscribe?token=PREVIEW', required: true },
  ],
}

async function seedTemplate() {
  console.log('🚀 Seeding Co-Journey Announcement template...\n')

  const db = initFirebase()
  const collection = db.collection('email_templates')
  const now = Timestamp.now()

  // Check if template already exists
  const existing = await collection.where('slug', '==', template.slug).get()

  if (!existing.empty) {
    const docId = existing.docs[0].id
    console.log(`📝 Template already exists (id: ${docId}). Updating...`)

    await collection.doc(docId).update({
      ...template,
      status: 'active',
      updatedBy: 'system',
      updatedAt: now,
    })

    console.log(`✅ Updated "${template.name}" (id: ${docId})`)
  } else {
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
  }

  console.log('\n✨ Done!')
}

seedTemplate().catch(console.error)
