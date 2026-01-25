#!/usr/bin/env node

/**
 * Resend Failed Campaign Emails
 *
 * Resends emails only to recipients who failed in a previous campaign.
 * Respects Resend's 2 emails/second rate limit.
 *
 * Usage: node scripts/resend-failed-campaign.mjs <campaignId>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHmac } from 'crypto'

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
    process.exit(1)
  }

  return getFirestore()
}

// Generate unsubscribe URL (same logic as the app)
function generateUnsubscribeUrl(email) {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET
  if (!secret) {
    throw new Error('UNSUBSCRIBE_TOKEN_SECRET not set')
  }

  const payload = {
    email: email.toLowerCase().trim(),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    iat: Math.floor(Date.now() / 1000),
  }

  const payloadStr = JSON.stringify(payload)
  const payloadB64 = Buffer.from(payloadStr).toString('base64url')
  const signature = createHmac('sha256', secret).update(payloadStr).digest('base64url')
  const token = `${payloadB64}.${signature}`

  return `https://moshimoshi.app/api/email/unsubscribe?token=${token}`
}

// Rate limiting: 2 emails per second
const EMAILS_PER_SECOND = 2
const DELAY_MS = 1000

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function resendFailedEmails(campaignId) {
  const db = initFirebase()
  const resend = new Resend(process.env.RESEND_API_KEY)

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set')
    process.exit(1)
  }

  // Get campaign
  const campaignDoc = await db.collection('email_campaigns').doc(campaignId).get()
  if (!campaignDoc.exists) {
    console.error(`Campaign not found: ${campaignId}`)
    process.exit(1)
  }

  const campaign = campaignDoc.data()
  console.log(`\nCampaign: ${campaign.name}`)
  console.log(`Subject: ${campaign.subject}`)
  console.log(`Status: ${campaign.status}`)
  console.log(`Stats: ${JSON.stringify(campaign.stats)}`)

  // Get failed emails
  const errors = campaign.errors || []
  if (errors.length === 0) {
    console.log('\nNo failed emails to resend!')
    process.exit(0)
  }

  const failedEmails = errors.map(e => e.email)
  console.log(`\nFailed emails to resend: ${failedEmails.length}`)

  // Get template content
  if (!campaign.templateId) {
    console.error('Campaign has no templateId - cannot resend')
    process.exit(1)
  }

  const templateDoc = await db.collection('email_templates').doc(campaign.templateId).get()
  if (!templateDoc.exists) {
    console.error(`Template not found: ${campaign.templateId}`)
    process.exit(1)
  }

  const template = templateDoc.data()
  console.log(`Template: ${template.name}`)

  // Confirm before sending
  console.log(`\n⚠️  About to resend ${failedEmails.length} emails`)
  console.log(`Estimated time: ${Math.ceil(failedEmails.length / EMAILS_PER_SECOND / 60)} minutes`)
  console.log('\nPress Ctrl+C within 5 seconds to cancel...')
  await sleep(5000)

  // Send emails
  let sent = 0
  let failed = 0
  const newErrors = []

  console.log('\n🚀 Starting resend...\n')

  for (let i = 0; i < failedEmails.length; i += EMAILS_PER_SECOND) {
    const batch = failedEmails.slice(i, i + EMAILS_PER_SECOND)

    // Log progress
    if (i % 20 === 0) {
      console.log(`Progress: ${i}/${failedEmails.length} (${Math.round((i / failedEmails.length) * 100)}%) - Sent: ${sent}, Failed: ${failed}`)
    }

    // Send batch
    const results = await Promise.allSettled(
      batch.map(async (email) => {
        const unsubscribeUrl = generateUnsubscribeUrl(email)

        // Replace variables in template
        let html = template.htmlContent
          .replace(/\{\{name\}\}/g, 'Learner')
          .replace(/\{\{email\}\}/g, email)
          .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl)

        let text = template.textContent
          .replace(/\{\{name\}\}/g, 'Learner')
          .replace(/\{\{email\}\}/g, email)
          .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl)

        return resend.emails.send({
          from: 'Moshimoshi <hello@moshimoshi.app>',
          to: email,
          subject: campaign.subject,
          html,
          text,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })
      })
    )

    // Count results
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        sent++
      } else {
        failed++
        newErrors.push({
          email: batch[j],
          error: results[j].reason?.message || 'Unknown error',
        })
        console.error(`Failed: ${batch[j]} - ${results[j].reason?.message}`)
      }
    }

    // Rate limit delay
    if (i + EMAILS_PER_SECOND < failedEmails.length) {
      await sleep(DELAY_MS)
    }
  }

  // Update campaign stats
  const originalSent = campaign.stats?.sentCount || 0
  const originalFailed = campaign.stats?.failedCount || 0

  await db.collection('email_campaigns').doc(campaignId).update({
    'stats.sentCount': originalSent + sent,
    'stats.failedCount': failed, // Replace with new failed count
    errors: newErrors.slice(0, 100),
    lastRetryAt: Timestamp.now(),
  })

  console.log('\n✅ Resend complete!')
  console.log(`Sent: ${sent}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total now sent: ${originalSent + sent}`)

  if (newErrors.length > 0) {
    console.log('\nRemaining failures:')
    newErrors.slice(0, 10).forEach(e => console.log(`  - ${e.email}: ${e.error}`))
    if (newErrors.length > 10) {
      console.log(`  ... and ${newErrors.length - 10} more`)
    }
  }
}

// Main
const campaignId = process.argv[2]
if (!campaignId) {
  console.log('Usage: node scripts/resend-failed-campaign.mjs <campaignId>')
  console.log('\nExample:')
  console.log('  node scripts/resend-failed-campaign.mjs 3YotwgP8c5RK3a1n3JBp')
  process.exit(1)
}

resendFailedEmails(campaignId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
