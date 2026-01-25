#!/usr/bin/env node

/**
 * Seed script for Kanji Mnemonics Feature Launch Email Template
 *
 * Usage: node scripts/seed-kanji-mnemonics-template.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Initialize Firebase Admin
function initFirebase() {
  if (getApps().length > 0) {
    return getFirestore()
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    join(__dirname, '..', 'moshimoshi-service-account.json')

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({
      credential: cert(serviceAccount),
    })
    console.log('Firebase Admin initialized')
  } catch (error) {
    console.error('Failed to load service account:', error.message)
    console.log('Make sure GOOGLE_APPLICATION_CREDENTIALS is set or serviceAccountKey.json exists')
    process.exit(1)
  }

  return getFirestore()
}

const db = initFirebase()

// Brand colors
const COLORS = {
  primary: '#ec4899',
  primaryDark: '#db2777',
  secondary: '#8b5cf6',
  text: '#111827',
  textLight: '#6b7280',
  textMuted: '#9ca3af',
  background: '#f5f5f5',
  cardBg: '#ffffff',
  border: '#e5e7eb',
  success: '#10b981',
}

const BASE_URL = 'https://moshimoshi.app'

// HTML Template
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Kanji Memory Aids Are Here</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    /* Prevent text inflation on Android */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    /* Remove spacing around tables on iOS */
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    /* Better image rendering */
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    /* Mobile responsive - smaller text for Android */
    @media only screen and (max-width: 620px) {
      .container {
        width: 100% !important;
        padding: 10px !important;
      }
      .card {
        padding: 16px !important;
      }
      /* Reduce all font sizes on mobile */
      .mobile-text {
        font-size: 14px !important;
        line-height: 1.5 !important;
      }
      .mobile-text-sm {
        font-size: 12px !important;
      }
      .mobile-heading {
        font-size: 16px !important;
      }
      .mobile-cta {
        font-size: 14px !important;
        padding: 12px 20px !important;
      }
    }
  </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${COLORS.text}; background-color: ${COLORS.background}; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div class="container" style="max-width: 600px; width: 100%; margin: 0 auto; padding: 20px;">
    <div class="card" style="background: ${COLORS.cardBg}; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">

      <!-- Logo -->
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="${BASE_URL}/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px;" />
      </div>

      <!-- Greeting -->
      <p class="mobile-text" style="margin: 0 0 16px 0; font-size: 16px; color: ${COLORS.text};">
        Hey {{name}},
      </p>

      <!-- Hook -->
      <p class="mobile-text" style="margin: 0 0 16px 0; font-size: 16px; color: ${COLORS.text};">
        Remember struggling to memorize <strong style="font-size: 18px;">日</strong>? Or mixing up <strong style="font-size: 18px;">待</strong> and <strong style="font-size: 18px;">持</strong> for the hundredth time?
      </p>

      <p class="mobile-text" style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: ${COLORS.text};">
        Those days are over.
      </p>

      <p class="mobile-text" style="margin: 0 0 24px 0; font-size: 16px; color: ${COLORS.text};">
        We just launched <strong>Kanji Memory Aids</strong> — and they're a game-changer for your learning.
      </p>

      <!-- Section: What's New -->
      <div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #fdf4ff, #f3e8ff); border-radius: 12px;">
        <h2 class="mobile-heading" style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: ${COLORS.text};">
          🧠 What's New?
        </h2>
        <p class="mobile-text" style="margin: 0 0 16px 0; font-size: 15px; color: ${COLORS.text};">
          Every kanji now comes with a vivid memory story that connects its shape to its meaning. Open any kanji, and you'll find a clever mnemonic waiting for you.
        </p>
        <p class="mobile-text" style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: ${COLORS.text};">
          Two ways to remember:
        </p>
        <ul class="mobile-text" style="margin: 0; padding-left: 20px; color: ${COLORS.text};">
          <li style="margin-bottom: 8px;">
            <strong>✨ AI-Generated Stories</strong> — Fresh, creative mnemonics crafted to make each kanji unforgettable. Don't like one? Regenerate it until it clicks.
          </li>
          <li style="margin-bottom: 0;">
            <strong>✏️ Your Own Mnemonics</strong> — Create personal memory aids that work for YOUR brain. The best mnemonic is the one you make yourself.
          </li>
        </ul>
      </div>

      <!-- Section: Examples -->
      <div style="margin: 24px 0;">
        <h2 class="mobile-heading" style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: ${COLORS.text};">
          💡 See It In Action
        </h2>

        <!-- Example 1 -->
        <div style="padding: 16px; background: ${COLORS.background}; border-radius: 8px; margin-bottom: 12px;">
          <p style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold;">
            山 <span class="mobile-text-sm" style="font-size: 14px; font-weight: normal; color: ${COLORS.textLight};">(mountain)</span>
          </p>
          <p class="mobile-text-sm" style="margin: 0; font-size: 14px; color: ${COLORS.textLight}; font-style: italic;">
            "Three peaks rising from the earth — the middle one reaches highest, just like a real mountain range."
          </p>
        </div>

        <!-- Example 2 -->
        <div style="padding: 16px; background: ${COLORS.background}; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold;">
            休 <span class="mobile-text-sm" style="font-size: 14px; font-weight: normal; color: ${COLORS.textLight};">(rest)</span>
          </p>
          <p class="mobile-text-sm" style="margin: 0; font-size: 14px; color: ${COLORS.textLight}; font-style: italic;">
            "A person (亻) leaning against a tree (木). Even trees need someone to rest against them."
          </p>
        </div>
      </div>

      <!-- Section: Why This Matters -->
      <div style="margin: 24px 0; padding: 16px; background: #f0fdf4; border-left: 4px solid ${COLORS.success}; border-radius: 8px;">
        <h2 class="mobile-heading" style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #166534;">
          🎯 Why This Matters
        </h2>
        <p class="mobile-text" style="margin: 0; font-size: 15px; color: #166534;">
          Research shows learners using mnemonics retain <strong>83% of kanji at 90 days</strong> compared to 61% with rote memorization. That's not a small difference — that's the difference between remembering and forgetting.
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a class="mobile-cta" href="${BASE_URL}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary}); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">
          Try Kanji Memory Aids Now
        </a>
      </div>

      <p class="mobile-text-sm" style="margin: 0 0 8px 0; font-size: 14px; color: ${COLORS.textLight}; text-align: center;">
        Open any kanji in your dashboard and look for the 💡 Memory Aid section.
      </p>

      <!-- Sign off -->
      <p class="mobile-text" style="margin: 24px 0 8px 0; font-size: 16px; color: ${COLORS.text};">
        Happy learning,<br>
        <strong>The Moshimoshi Team</strong>
      </p>

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid ${COLORS.border}; text-align: center;">
        <div style="margin-bottom: 16px;">
          <a href="https://x.com/AppMoshimoshi" style="margin: 0 6px; color: ${COLORS.textMuted}; text-decoration: none;">X</a>
          <span style="color: ${COLORS.border};">|</span>
          <a href="https://www.instagram.com/moshimoshi.app/" style="margin: 0 6px; color: ${COLORS.textMuted}; text-decoration: none;">Instagram</a>
          <span style="color: ${COLORS.border};">|</span>
          <a href="https://www.tiktok.com/@moshimoshiapp23" style="margin: 0 6px; color: ${COLORS.textMuted}; text-decoration: none;">TikTok</a>
          <span style="color: ${COLORS.border};">|</span>
          <a href="https://www.facebook.com/profile.php?id=61583293235389" style="margin: 0 6px; color: ${COLORS.textMuted}; text-decoration: none;">Facebook</a>
        </div>
        <p style="font-size: 12px; color: ${COLORS.textMuted};">
          You're receiving this email because you signed up for Moshimoshi.
        </p>
        <p style="font-size: 12px; color: ${COLORS.textMuted};">
          <a href="{{unsubscribeUrl}}" style="color: ${COLORS.textMuted}; text-decoration: underline;">Unsubscribe</a>
          from marketing emails
        </p>
        <p style="font-size: 12px; color: ${COLORS.textMuted}; margin-top: 12px;">
          &copy; ${new Date().getFullYear()} Moshimoshi. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
`.trim()

// Plain text version
const textContent = `
Hey {{name}},

Remember struggling to memorize 日? Or mixing up 待 and 持 for the hundredth time?

Those days are over.

We just launched Kanji Memory Aids — and they're a game-changer for your learning.

---

🧠 WHAT'S NEW?

Every kanji now comes with a vivid memory story that connects its shape to its meaning. Open any kanji, and you'll find a clever mnemonic waiting for you.

Two ways to remember:

✨ AI-Generated Stories — Fresh, creative mnemonics crafted to make each kanji unforgettable. Don't like one? Regenerate it until it clicks.

✏️ Your Own Mnemonics — Create personal memory aids that work for YOUR brain. The best mnemonic is the one you make yourself.

---

💡 SEE IT IN ACTION

山 (mountain)
"Three peaks rising from the earth — the middle one reaches highest, just like a real mountain range."

休 (rest)
"A person (亻) leaning against a tree (木). Even trees need someone to rest against them."

---

🎯 WHY THIS MATTERS

Research shows learners using mnemonics retain 83% of kanji at 90 days compared to 61% with rote memorization. That's not a small difference — that's the difference between remembering and forgetting.

---

Try it now: Open any kanji in your dashboard and look for the 💡 Memory Aid section.

${BASE_URL}

Happy learning,
The Moshimoshi Team

---

You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}

© ${new Date().getFullYear()} Moshimoshi. All rights reserved.
`.trim()

// Template document
const template = {
  name: 'Kanji Mnemonics Feature Launch',
  slug: 'kanji-mnemonics-launch',
  description: 'Marketing email announcing the new Kanji Memory Aids feature with AI-generated and custom mnemonics.',
  subject: 'Never Forget a Kanji Again: AI Memory Aids Are Here',
  htmlContent,
  textContent,
  variables: [
    {
      name: 'name',
      label: 'Recipient Name',
      type: 'string',
      defaultValue: 'Learner',
      required: false,
    },
  ],
  category: 'marketing',
  status: 'active',
  createdBy: 'system',
  createdAt: Timestamp.now(),
  updatedBy: 'system',
  updatedAt: Timestamp.now(),
}

async function seedTemplate() {
  console.log('🌱 Seeding Kanji Mnemonics email template...\n')

  try {
    // Check if template already exists
    const existingQuery = await db
      .collection('email_templates')
      .where('slug', '==', template.slug)
      .get()

    if (!existingQuery.empty) {
      console.log('⚠️  Template with slug "kanji-mnemonics-launch" already exists.')
      console.log('   Updating existing template...\n')

      const docId = existingQuery.docs[0].id
      await db.collection('email_templates').doc(docId).update({
        ...template,
        createdAt: existingQuery.docs[0].data().createdAt, // Preserve original creation date
        updatedAt: Timestamp.now(),
      })

      console.log(`✅ Template updated: ${docId}`)
    } else {
      // Create new template
      const docRef = await db.collection('email_templates').add(template)
      console.log(`✅ Template created: ${docRef.id}`)
    }

    console.log('\n📧 Template Details:')
    console.log(`   Name: ${template.name}`)
    console.log(`   Slug: ${template.slug}`)
    console.log(`   Subject: ${template.subject}`)
    console.log(`   Category: ${template.category}`)
    console.log(`   Status: ${template.status}`)
    console.log('\n✨ Done! You can now use this template in Email Campaigns.')

  } catch (error) {
    console.error('❌ Error seeding template:', error)
    process.exit(1)
  }

  process.exit(0)
}

seedTemplate()
