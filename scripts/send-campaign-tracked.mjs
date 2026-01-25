#!/usr/bin/env node

/**
 * Send Campaign with Tracking
 *
 * Sends campaign emails and tracks each successful send in a subcollection.
 * Can be re-run safely - will skip already-sent emails.
 *
 * Usage: node scripts/send-campaign-tracked.mjs <campaignId>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { Resend } from 'resend'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHmac } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Initialize Firebase Admin
let db, auth
function initFirebase() {
  if (getApps().length > 0) {
    db = getFirestore()
    auth = getAuth()
    return
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    join(__dirname, '..', 'moshimoshi-service-account.json')

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({
      credential: cert(serviceAccount),
    })
    db = getFirestore()
    auth = getAuth()
    console.log('Firebase Admin initialized')
  } catch (error) {
    console.error('Failed to load service account:', error.message)
    process.exit(1)
  }
}

// Generate unsubscribe URL
function generateUnsubscribeUrl(email) {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET
  if (!secret) {
    throw new Error('UNSUBSCRIBE_TOKEN_SECRET not set')
  }

  const payload = {
    email: email.toLowerCase().trim(),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    iat: Math.floor(Date.now() / 1000),
  }

  const payloadStr = JSON.stringify(payload)
  const payloadB64 = Buffer.from(payloadStr).toString('base64url')
  const signature = createHmac('sha256', secret).update(payloadStr).digest('base64url')
  const token = `${payloadB64}.${signature}`

  return `https://moshimoshi.app/api/email/unsubscribe?token=${token}`
}

// Rate limiting
const EMAILS_PER_SECOND = 2
const DELAY_MS = 1000

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Get all eligible users for the segment
async function getEligibleUsers(segment) {
  console.log(`\nQuerying users for segment: ${segment.type}`)

  let query = db.collection('users')

  if (segment.type === 'premium_monthly') {
    query = query
      .where('subscription.plan', '==', 'premium_monthly')
      .where('subscription.status', 'in', ['active', 'trialing'])
  } else if (segment.type === 'premium_yearly') {
    query = query
      .where('subscription.plan', '==', 'premium_yearly')
      .where('subscription.status', 'in', ['active', 'trialing'])
  }

  const snapshot = await query.get()
  console.log(`Found ${snapshot.size} users in Firestore`)

  // Filter for free users if needed
  let docs = snapshot.docs
  if (segment.type === 'free') {
    docs = docs.filter(doc => {
      const data = doc.data()
      const isPremium = data.subscription &&
        (data.subscription.plan === 'premium_monthly' || data.subscription.plan === 'premium_yearly') &&
        (data.subscription.status === 'active' || data.subscription.status === 'trialing')
      return !isPremium
    })
    console.log(`After free filter: ${docs.length} users`)
  }

  // Batch fetch user emails from Auth
  const uids = docs.map(d => d.id)
  const users = []

  console.log(`Fetching emails from Firebase Auth...`)
  for (let i = 0; i < uids.length; i += 100) {
    const batch = uids.slice(i, i + 100)
    const identifiers = batch.map(uid => ({ uid }))

    try {
      const response = await auth.getUsers(identifiers)
      for (const user of response.users) {
        if (user.email) {
          // Check email verified if required
          if (segment.emailVerifiedOnly && !user.emailVerified) {
            continue
          }
          users.push({ uid: user.uid, email: user.email })
        }
      }
    } catch (err) {
      console.error(`Error fetching batch:`, err.message)
    }
  }

  console.log(`Got ${users.length} users with emails`)

  // Check marketing preferences if required
  if (segment.respectMarketingPrefs) {
    console.log(`Checking marketing preferences...`)
    const filtered = []

    // Batch fetch preferences
    for (let i = 0; i < users.length; i += 500) {
      const batch = users.slice(i, i + 500)
      const refs = batch.map(u =>
        db.collection('users').doc(u.uid).collection('preferences').doc('settings')
      )

      try {
        const snapshots = await db.getAll(...refs)
        for (let j = 0; j < snapshots.length; j++) {
          const snap = snapshots[j]
          const prefs = snap.exists ? snap.data() : null
          // Only skip if explicitly opted out
          if (prefs?.notifications?.marketingEmails !== false) {
            filtered.push(batch[j])
          }
        }
      } catch (err) {
        console.error(`Error fetching preferences:`, err.message)
        // Include users if we can't check
        filtered.push(...batch)
      }
    }

    console.log(`After marketing prefs filter: ${filtered.length} users`)
    return filtered
  }

  return users
}

// Get already sent emails for this campaign
async function getAlreadySent(campaignId) {
  const sentRef = db.collection('email_campaigns').doc(campaignId).collection('sent_emails')
  const snapshot = await sentRef.get()

  const sent = new Set()
  snapshot.forEach(doc => sent.add(doc.id)) // doc.id is the email

  return sent
}

// Track a sent email
async function trackSentEmail(campaignId, email) {
  const docRef = db
    .collection('email_campaigns')
    .doc(campaignId)
    .collection('sent_emails')
    .doc(email.toLowerCase().replace(/[.#$[\]]/g, '_')) // Firestore-safe doc ID

  await docRef.set({
    email: email.toLowerCase(),
    sentAt: Timestamp.now(),
  })
}

async function sendCampaignTracked(campaignId) {
  initFirebase()

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
  console.log(`\n📧 Campaign: ${campaign.name}`)
  console.log(`Subject: ${campaign.subject}`)
  console.log(`Template ID: ${campaign.templateId}`)

  // Get template
  if (!campaign.templateId) {
    console.error('Campaign has no templateId')
    process.exit(1)
  }

  const templateDoc = await db.collection('email_templates').doc(campaign.templateId).get()
  if (!templateDoc.exists) {
    console.error(`Template not found: ${campaign.templateId}`)
    process.exit(1)
  }
  const template = templateDoc.data()
  console.log(`Template: ${template.name}`)

  // Get eligible users
  const allUsers = await getEligibleUsers(campaign.segment)

  // Get already sent
  console.log(`\nChecking already sent emails...`)
  const alreadySent = await getAlreadySent(campaignId)
  console.log(`Already sent: ${alreadySent.size}`)

  // Filter to unsent only
  const usersToSend = allUsers.filter(u => !alreadySent.has(u.email.toLowerCase().replace(/[.#$[\]]/g, '_')))
  console.log(`To send: ${usersToSend.length}`)

  if (usersToSend.length === 0) {
    console.log('\n✅ All emails already sent!')
    process.exit(0)
  }

  const estimatedMinutes = Math.ceil(usersToSend.length / EMAILS_PER_SECOND / 60)
  console.log(`\n⚠️  About to send ${usersToSend.length} emails`)
  console.log(`Estimated time: ${estimatedMinutes} minutes`)
  console.log('\nPress Ctrl+C within 5 seconds to cancel...')
  await sleep(5000)

  // Update campaign status
  await db.collection('email_campaigns').doc(campaignId).update({
    status: 'sending',
    'stats.totalRecipients': allUsers.length,
  })

  // Send emails
  let sent = 0
  let failed = 0
  const errors = []

  console.log('\n🚀 Starting send...\n')
  const startTime = Date.now()

  for (let i = 0; i < usersToSend.length; i += EMAILS_PER_SECOND) {
    const batch = usersToSend.slice(i, i + EMAILS_PER_SECOND)

    // Log progress every 20 emails
    if (i % 20 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      const remaining = Math.round((usersToSend.length - i) / EMAILS_PER_SECOND)
      console.log(
        `Progress: ${i}/${usersToSend.length} (${Math.round((i / usersToSend.length) * 100)}%) | ` +
        `Sent: ${sent} | Failed: ${failed} | ` +
        `Elapsed: ${elapsed}s | Remaining: ~${remaining}s`
      )
    }

    // Send batch
    const results = await Promise.allSettled(
      batch.map(async (user) => {
        const unsubscribeUrl = generateUnsubscribeUrl(user.email)

        let html = template.htmlContent
          .replace(/\{\{name\}\}/g, 'Learner')
          .replace(/\{\{email\}\}/g, user.email)
          .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl)

        let text = template.textContent
          .replace(/\{\{name\}\}/g, 'Learner')
          .replace(/\{\{email\}\}/g, user.email)
          .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl)

        const result = await resend.emails.send({
          from: 'Moshimoshi <hello@moshimoshi.app>',
          to: user.email,
          subject: campaign.subject,
          html,
          text,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })

        // Track successful send
        await trackSentEmail(campaignId, user.email)

        return result
      })
    )

    // Count results
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        sent++
      } else {
        failed++
        errors.push({
          email: batch[j].email,
          error: results[j].reason?.message || 'Unknown error',
        })
        console.error(`❌ Failed: ${batch[j].email} - ${results[j].reason?.message}`)
      }
    }

    // Update stats every 50 emails
    if (i % 50 === 0 || i + EMAILS_PER_SECOND >= usersToSend.length) {
      await db.collection('email_campaigns').doc(campaignId).update({
        'stats.sentCount': alreadySent.size + sent,
        'stats.failedCount': failed,
        errors: errors.slice(-100), // Keep last 100 errors
      })
    }

    // Rate limit
    if (i + EMAILS_PER_SECOND < usersToSend.length) {
      await sleep(DELAY_MS)
    }
  }

  // Final update
  await db.collection('email_campaigns').doc(campaignId).update({
    status: 'sent',
    'stats.sentCount': alreadySent.size + sent,
    'stats.failedCount': failed,
    errors: errors.slice(-100),
    sentAt: Timestamp.now(),
  })

  const totalTime = Math.round((Date.now() - startTime) / 1000)
  console.log('\n' + '='.repeat(50))
  console.log('✅ Campaign send complete!')
  console.log('='.repeat(50))
  console.log(`Total sent this run: ${sent}`)
  console.log(`Total sent overall: ${alreadySent.size + sent}`)
  console.log(`Failed: ${failed}`)
  console.log(`Time: ${totalTime} seconds`)

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} failures. Run again to retry.`)
  }
}

// Main
const campaignId = process.argv[2]
if (!campaignId) {
  console.log('Usage: node scripts/send-campaign-tracked.mjs <campaignId>')
  process.exit(1)
}

sendCampaignTracked(campaignId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
