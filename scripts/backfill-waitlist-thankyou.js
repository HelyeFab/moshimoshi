/**
 * Backfill thank-you emails for waitlist entries.
 *
 * Usage:
 *   node scripts/backfill-waitlist-thankyou.js --dry-run
 *   node scripts/backfill-waitlist-thankyou.js --limit=50
 *
 * Requirements:
 * - moshimoshi-service-account.json present at repo root
 * - RESEND_API_KEY set in environment
 */

const admin = require('firebase-admin')
const path = require('path')
const { Resend } = require('resend')

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()
const resendApiKey = process.env.RESEND_API_KEY
if (!resendApiKey) {
  console.error('RESEND_API_KEY is required to send emails.')
  process.exit(1)
}
const resend = new Resend(resendApiKey)

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 200

function getLaunchDate() {
  const iso = process.env.NEXT_PUBLIC_LAUNCH_DATE || process.env.LAUNCH_DATE
  if (!iso) return { iso: undefined, human: 'our launch day' }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return { iso, human: iso }

  const human = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  })

  return { iso, human }
}

function buildContent(email) {
  const nameFallback = email.split('@')[0]
  const { iso, human } = getLaunchDate()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thanks for joining the waitlist</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
          <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; border-radius: 12px; display: grid; place-items: center; font-weight: 700; font-size: 20px;">も</div>
            <div style="font-size: 22px; font-weight: 800; color: #111;">Moshimoshi</div>
          </div>

          <div style="display:inline-block; background:#f3e8ff; color:#6b21a8; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:600; margin:12px 0 18px 0;">Waitlist confirmed</div>

          <h2 style="margin: 0 0 10px 0;">Thanks for joining, ${nameFallback}!</h2>
          <p style="margin: 0 0 14px 0; font-size:13px; color:#374151;">We're excited to have you on board.</p>

          <p style="margin: 0 0 8px 0; font-size:13px; color:#374151;"><strong>Here's what you need to know:</strong></p>

          <div style="margin: 0 0 16px 0;">
            <div style="margin: 6px 0; padding-left: 4px; font-size:13px; color:#374151;">✓ Moshimoshi is <strong>100% free to use</strong>—no trial, no expiration, no strings attached</div>
            <div style="margin: 6px 0; padding-left: 4px; font-size:13px; color:#374151;">✓ You'll have full access to learn Japanese when we launch on <strong>${human || iso || 'launch day'}</strong></div>
            <div style="margin: 6px 0; padding-left: 4px; font-size:13px; color:#374151;">✓ Premium is completely optional (extra features if you want them)</div>
            <div style="margin: 6px 0; padding-left: 4px; font-size:13px; color:#374151;">✓ As an early supporter, you get <strong>25% off Premium</strong> if you ever choose to upgrade</div>
          </div>

          <p style="margin: 16px 0; padding: 12px; background: #f9fafb; border-left: 3px solid #8b5cf6; border-radius: 4px; font-size:13px; color:#374151;">
            <strong>Bottom line:</strong> You're all set! When we launch, sign in with this email to use Moshimoshi for free, and only upgrade if you love it and want more.
          </p>

          <p style="font-size:13px; color:#374151;">We'll share updates as we get closer to launch. In the meantime, feel free to reply with any questions or requests.</p>

          <div style="margin-top: 18px; font-size:13px; color:#374151;">
            <div><strong>Launch date:</strong> ${human || iso || 'TBA'}</div>
            <div><strong>Your email:</strong> ${email}</div>
            <div><strong>Discount:</strong> 25% off first invoice (auto-applied)</div>
          </div>

          <p style="font-size:13px; color:#374151; margin-top: 18px;">ありがとうございます — we can’t wait to help you learn Japanese.<br/>The Moshimoshi Team</p>

          <div style="margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 16px; color: #6b7280; font-size: 13px; text-align: center;">
            <div>Need help? Email <a href="mailto:support@moshimoshi.app" style="color:#8b5cf6; text-decoration:none;">support@moshimoshi.app</a></div>
            <div style="margin-top:6px;">If you didn’t request this, you can ignore it.</div>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Hi ${nameFallback},

Thanks for joining the Moshimoshi waitlist!

Here's what you need to know:

✓ Moshimoshi is 100% free to use—no trial, no expiration, no strings attached
✓ You'll have full access to learn Japanese when we launch on ${human || iso || 'launch day'}
✓ Premium is completely optional (extra features if you want them)
✓ As an early supporter, you get 25% off Premium if you ever choose to upgrade

Bottom line: You're all set! When we launch, sign in with this email to use Moshimoshi for free, and only upgrade if you love it and want more.

Launch date: ${human || iso || 'TBA'}
Your email: ${email}
Discount: 25% off first invoice (auto-applied)

We'll share updates as we get closer to launch. In the meantime, feel free to reply with any questions or requests.

ありがとうございます — we can't wait to help you learn Japanese.
The Moshimoshi Team
  `

  return { html, text }
}

async function main() {
  console.log(`Backfill started. dryRun=${dryRun} limit=${limit}`)

  const snapshot = await db.collection('waitlist').get()
  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .filter((d) => d.data.thankYouSent !== true)
    .slice(0, limit)

  console.log(`Found ${candidates.length} entries needing thank-you emails.`)

  if (dryRun) {
    candidates.forEach((c, idx) => {
      console.log(`#${idx + 1}: ${c.data.email} (joined: ${c.data.joinedAt?.toDate ? c.data.joinedAt.toDate().toISOString() : 'n/a'})`)
    })
    console.log('Dry run complete. No emails sent.')
    return
  }

  for (const [idx, entry] of candidates.entries()) {
    const { email } = entry.data
    const { html, text } = buildContent(email)
    console.log(`(${idx + 1}/${candidates.length}) Sending to ${email}...`)

    try {
      await resend.emails.send({
        from: 'Moshimoshi <noreply@moshimoshi.app>',
        to: email,
        subject: "You're on the Moshimoshi waitlist! 🚀 25% off at launch",
        html,
        text,
      })

      await db.collection('waitlist').doc(entry.id).update({
        thankYouSent: true,
        thankYouSentAt: admin.firestore.Timestamp.now(),
      })
      console.log(`✓ Sent and flagged ${email}`)
    } catch (err) {
      console.error(`✗ Failed for ${email}`, err.message || err)
    }
  }

  console.log('Backfill complete.')
}

main().catch((err) => {
  console.error('Backfill crashed:', err)
  process.exit(1)
})
