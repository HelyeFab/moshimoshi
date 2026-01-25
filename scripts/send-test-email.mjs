#!/usr/bin/env node
/**
 * Send a test email with unsubscribe link
 * Usage: node scripts/send-test-email.mjs <email>
 */

import { Resend } from 'resend'
import * as crypto from 'crypto'

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/send-test-email.mjs <email>')
  process.exit(1)
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
if (!RESEND_API_KEY) {
  console.error('RESEND_API_KEY environment variable is required')
  process.exit(1)
}

const SECRET = process.env.UNSUBSCRIBE_TOKEN_SECRET
if (!SECRET) {
  console.error('UNSUBSCRIBE_TOKEN_SECRET environment variable is required')
  process.exit(1)
}

const BASE_URL = 'https://moshimoshi.app'

// Generate unsubscribe token (must match tokens.ts format)
function createUnsubscribeToken(email) {
  const normalizedEmail = email.toLowerCase().trim()
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (7 * 24 * 60 * 60) // 7 days

  const payload = { email: normalizedEmail, exp, iat: now }

  // IMPORTANT: Signature format must be "email:exp:iat" (not JSON)
  const signatureData = `${normalizedEmail}:${exp}:${now}`
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(signatureData)
    .digest('hex')

  const tokenData = { ...payload, sig: signature }
  const token = Buffer.from(JSON.stringify(tokenData))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return token
}

const token = createUnsubscribeToken(email)
const unsubscribeUrl = `${BASE_URL}/api/email/unsubscribe?token=${token}`
const oneClickUrl = `${BASE_URL}/api/email/unsubscribe/one-click?token=${token}`

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${BASE_URL}/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px;" />
    </div>

    <h1 style="margin: 0 0 16px; font-size: 24px; color: #111827; text-align: center;">
      🧪 Email Suppression Test
    </h1>

    <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
      Hey there!
    </p>

    <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
      This is a test email to verify the unsubscribe system is working correctly.
    </p>

    <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">
      <strong>To test:</strong> Click the unsubscribe link below. After that, you should NOT receive any more test emails.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${BASE_URL}/en/tools/kanji-mastery" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; text-decoration: none; border-radius: 10px; font-weight: 700;">
        Visit Kanji Mastery
      </a>
    </div>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
      <p>You're receiving this email because you signed up for Moshimoshi.</p>
      <p>
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
        from marketing emails
      </p>
    </div>
  </div>
</body>
</html>
`

const text = `
Email Suppression Test

Hey there!

This is a test email to verify the unsubscribe system is working correctly.

To test: Click the unsubscribe link below. After that, you should NOT receive any more test emails.

Visit Kanji Mastery: ${BASE_URL}/en/tools/kanji-mastery

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: ${unsubscribeUrl}
`

const resend = new Resend(RESEND_API_KEY)

console.log(`Sending test email to: ${email}`)
console.log(`Unsubscribe URL: ${unsubscribeUrl}`)

try {
  const { data, error } = await resend.emails.send({
    from: 'Moshimoshi <noreply@moshimoshi.app>',
    to: email,
    subject: '🧪 Test Email - Unsubscribe Flow Test',
    html,
    text,
    headers: {
      'List-Unsubscribe': `<mailto:unsubscribe@moshimoshi.app?subject=unsubscribe>, <${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  if (error) {
    console.error('Failed to send:', error)
    process.exit(1)
  }

  console.log(`✅ Email sent successfully! ID: ${data.id}`)
  console.log('')
  console.log('Next steps:')
  console.log('1. Check your inbox for the test email')
  console.log('2. Click the "Unsubscribe" link at the bottom')
  console.log('3. You should see a success page')
  console.log('4. Run this script again - the email should be skipped')
} catch (err) {
  console.error('Error:', err)
  process.exit(1)
}
