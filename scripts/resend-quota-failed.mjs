#!/usr/bin/env node

/**
 * Resend to Quota-Failed Emails
 *
 * Reads emails from not-delivered-emails.txt and sends only to those.
 * Run this after your Resend daily quota resets.
 *
 * Usage: node scripts/resend-quota-failed.mjs <campaignId>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { readFileSync, existsSync, writeFileSync } from 'fs'
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

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
  initializeApp({ credential: cert(serviceAccount) })
  console.log('Firebase Admin initialized')
  return getFirestore()
}

function generateUnsubscribeUrl(email) {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET
  if (!secret) throw new Error('UNSUBSCRIBE_TOKEN_SECRET not set')

  const payload = {
    email: email.toLowerCase().trim(),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    iat: Math.floor(Date.now() / 1000),
  }
  const payloadStr = JSON.stringify(payload)
  const payloadB64 = Buffer.from(payloadStr).toString('base64url')
  const signature = createHmac('sha256', secret).update(payloadStr).digest('base64url')
  return `https://moshimoshi.app/api/email/unsubscribe?token=${payloadB64}.${signature}`
}

const EMAILS_PER_SECOND = 2
const DELAY_MS = 1000
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function resendQuotaFailed(campaignId) {
  const db = initFirebase()
  const resend = new Resend(process.env.RESEND_API_KEY)

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set')
    process.exit(1)
  }

  // Read not-delivered emails
  const filePath = join(__dirname, '..', 'not-delivered-emails.txt')
  if (!existsSync(filePath)) {
    console.error('not-delivered-emails.txt not found')
    console.log('Run the analysis first to generate this file')
    process.exit(1)
  }

  const emailsToSend = readFileSync(filePath, 'utf8')
    .split('\n')
    .map(e => e.trim())
    .filter(e => e.length > 0)

  console.log(`\nEmails to resend: ${emailsToSend.length}`)

  // Get campaign and template
  const campaignDoc = await db.collection('email_campaigns').doc(campaignId).get()
  if (!campaignDoc.exists) {
    console.error('Campaign not found:', campaignId)
    process.exit(1)
  }
  const campaign = campaignDoc.data()
  console.log(`Campaign: ${campaign.name}`)

  const templateDoc = await db.collection('email_templates').doc(campaign.templateId).get()
  if (!templateDoc.exists) {
    console.error('Template not found:', campaign.templateId)
    process.exit(1)
  }
  const template = templateDoc.data()
  console.log(`Template: ${template.name}`)

  // Check quota first
  console.log('\nChecking current quota...')
  try {
    const testResult = await resend.emails.send({
      from: 'Moshimoshi <hello@moshimoshi.app>',
      to: 'quota-check@test.invalid',
      subject: 'Quota Check',
      text: 'test',
    })

    if (testResult.error?.name === 'daily_quota_exceeded') {
      console.error('❌ Daily quota still exceeded. Wait for reset.')
      process.exit(1)
    }
  } catch (err) {
    // Expected to fail, just checking quota
  }

  const estimatedMinutes = Math.ceil(emailsToSend.length / EMAILS_PER_SECOND / 60)
  console.log(`\n⚠️  About to send ${emailsToSend.length} emails`)
  console.log(`Estimated time: ${estimatedMinutes} minutes`)
  console.log('\nPress Ctrl+C within 5 seconds to cancel...')
  await sleep(5000)

  let sent = 0
  let failed = 0
  const errors = []
  const successfulEmails = []

  console.log('\n🚀 Starting resend...\n')
  const startTime = Date.now()

  for (let i = 0; i < emailsToSend.length; i += EMAILS_PER_SECOND) {
    const batch = emailsToSend.slice(i, i + EMAILS_PER_SECOND)

    if (i % 20 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`Progress: ${i}/${emailsToSend.length} | Sent: ${sent} | Failed: ${failed} | ${elapsed}s`)
    }

    const results = await Promise.allSettled(
      batch.map(async (email) => {
        const unsubscribeUrl = generateUnsubscribeUrl(email)

        let html = template.htmlContent
          .replace(/\{\{name\}\}/g, 'Learner')
          .replace(/\{\{email\}\}/g, email)
          .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl)

        let text = template.textContent
          .replace(/\{\{name\}\}/g, 'Learner')
          .replace(/\{\{email\}\}/g, email)
          .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl)

        const result = await resend.emails.send({
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

        if (result.error) {
          throw new Error(result.error.message)
        }

        return { email, result }
      })
    )

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        sent++
        successfulEmails.push(batch[j])
      } else {
        failed++
        const errorMsg = results[j].reason?.message || 'Unknown error'
        errors.push({ email: batch[j], error: errorMsg })
        console.error(`❌ ${batch[j]}: ${errorMsg}`)

        // Stop if quota exceeded
        if (errorMsg.includes('quota')) {
          console.error('\n⚠️  Quota exceeded again! Stopping.')
          console.log(`Sent ${sent} before quota hit.`)

          // Save remaining emails
          const remaining = emailsToSend.slice(i + j + 1)
          writeFileSync(filePath, remaining.join('\n'))
          console.log(`Updated not-delivered-emails.txt with ${remaining.length} remaining`)
          process.exit(1)
        }
      }
    }

    if (i + EMAILS_PER_SECOND < emailsToSend.length) {
      await sleep(DELAY_MS)
    }
  }

  // Update the file - remove successfully sent
  const remainingEmails = emailsToSend.filter(e => !successfulEmails.includes(e))
  if (remainingEmails.length > 0) {
    writeFileSync(filePath, remainingEmails.join('\n'))
    console.log(`\nUpdated not-delivered-emails.txt with ${remainingEmails.length} remaining`)
  } else {
    writeFileSync(filePath, '')
    console.log('\n✅ All emails sent! not-delivered-emails.txt is now empty.')
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ Resend complete!')
  console.log('='.repeat(50))
  console.log(`Sent: ${sent}`)
  console.log(`Failed: ${failed}`)
  console.log(`Time: ${Math.round((Date.now() - startTime) / 1000)} seconds`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(e => console.log(` - ${e.email}: ${e.error}`))
  }
}

const campaignId = process.argv[2]
if (!campaignId) {
  console.log('Usage: node scripts/resend-quota-failed.mjs <campaignId>')
  console.log('\nExample:')
  console.log('  node scripts/resend-quota-failed.mjs 3YotwgP8c5RK3a1n3JBp')
  process.exit(1)
}

resendQuotaFailed(campaignId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
