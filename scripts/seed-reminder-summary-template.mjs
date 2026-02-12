#!/usr/bin/env node
/**
 * Seed Reminder Summary email template into Firestore `email_templates`.
 *
 * Usage:
 *   node scripts/seed-reminder-summary-template.mjs
 *
 * Environment:
 *   GOOGLE_APPLICATION_CREDENTIALS (optional)
 *   NEXT_PUBLIC_APP_URL (optional, defaults to https://moshimoshi.app)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'
const TEMPLATE_SLUG = 'reminder-summary-daily'

function initFirebase() {
  if (getApps().length > 0) {
    return getFirestore()
  }

  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    join(__dirname, '..', 'serviceAccountKey.json')

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({ credential: cert(serviceAccount) })
  } catch (error) {
    console.error('Failed to load Firebase service account:', error.message)
    process.exit(1)
  }

  return getFirestore()
}

function buildTemplate() {
  const now = Timestamp.now()

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your daily reminder summary</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#ffffff;border-radius:12px;padding:28px;box-shadow:0 2px 4px rgba(0,0,0,0.08);">
      <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.25;">Keep your Japanese momentum, {{userName}}</h1>
      <p style="margin:0 0 16px 0;font-size:15px;color:#4b5563;">
        Here are your most recent learning areas from {{summaryDate}} that are waiting for you:
      </p>

      <div style="margin:16px 0 24px 0;">
        {{topFeaturesHtml}}
      </div>

      <div style="text-align:center;margin:24px 0 8px 0;">
        <a href="{{ctaUrl}}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:#ffffff;text-decoration:none;font-weight:700;">
          Continue learning
        </a>
      </div>

      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
        <p style="margin:0 0 8px 0;">You're receiving this email because you signed up for Moshimoshi.</p>
        <p style="margin:0;">
          <a href="{{unsubscribeUrl}}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
          from marketing emails
        </p>
        <p style="margin:8px 0 0 0;">&copy; ${new Date().getFullYear()} Moshimoshi</p>
      </div>
    </div>
  </div>
</body>
</html>`

  const textContent = `Keep your Japanese momentum, {{userName}}

Here are your most recent learning areas from {{summaryDate}} that are waiting for you:

{{topFeaturesText}}

Continue learning: {{ctaUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}`

  return {
    name: 'Reminder Summary Daily',
    slug: TEMPLATE_SLUG,
    description: 'Daily reminder summary for users who were active yesterday but inactive today.',
    subject: 'Continue your Japanese learning today',
    htmlContent,
    textContent,
    variables: [
      {
        name: 'userName',
        label: 'User Name',
        type: 'string',
        defaultValue: 'Learner',
        required: true,
      },
      {
        name: 'topFeatures',
        label: 'Top Features JSON',
        type: 'string',
        defaultValue:
          '[{"name":"Kana Practice","url":"https://moshimoshi.app/learn/hiragana"},{"name":"Flashcards & SRS","url":"https://moshimoshi.app/review"}]',
        required: true,
      },
      {
        name: 'topFeaturesHtml',
        label: 'Top Features HTML',
        type: 'string',
        defaultValue:
          '<ul><li><a href="https://moshimoshi.app/learn/hiragana">Kana Practice</a></li><li><a href="https://moshimoshi.app/review">Flashcards & SRS</a></li></ul>',
        required: false,
      },
      {
        name: 'topFeaturesText',
        label: 'Top Features Text',
        type: 'string',
        defaultValue:
          '- Kana Practice: https://moshimoshi.app/learn/hiragana\\n- Flashcards & SRS: https://moshimoshi.app/review',
        required: false,
      },
      {
        name: 'ctaUrl',
        label: 'Continue Learning URL',
        type: 'url',
        defaultValue: `${BASE_URL}/review`,
        required: true,
      },
      {
        name: 'summaryDate',
        label: 'Summary Date',
        type: 'date',
        defaultValue: '2026-02-12',
        required: false,
      },
      {
        name: 'unsubscribeUrl',
        label: 'Unsubscribe URL',
        type: 'url',
        defaultValue: `${BASE_URL}/api/email/unsubscribe?token=preview-token`,
        required: false,
      },
    ],
    category: 'notification',
    status: 'active',
    createdBy: 'system:seed-reminder-summary-template',
    createdAt: now,
    updatedBy: 'system:seed-reminder-summary-template',
    updatedAt: now,
  }
}

async function seed() {
  const db = initFirebase()
  const template = buildTemplate()

  const existing = await db
    .collection('email_templates')
    .where('slug', '==', TEMPLATE_SLUG)
    .limit(1)
    .get()

  if (!existing.empty) {
    const docRef = existing.docs[0].ref
    await docRef.update({
      ...template,
      createdAt: existing.docs[0].data().createdAt || template.createdAt,
      createdBy: existing.docs[0].data().createdBy || template.createdBy,
      updatedAt: Timestamp.now(),
    })
    console.log(`Updated template: ${docRef.id} (${TEMPLATE_SLUG})`)
    return
  }

  const docRef = await db.collection('email_templates').add(template)
  console.log(`Created template: ${docRef.id} (${TEMPLATE_SLUG})`)
}

seed().catch((error) => {
  console.error('Failed to seed reminder summary template:', error)
  process.exit(1)
})
