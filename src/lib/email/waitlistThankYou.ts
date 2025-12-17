import { sendEmail } from './resend'

function getLaunchDate() {
  const iso = process.env.NEXT_PUBLIC_LAUNCH_DATE || process.env.LAUNCH_DATE

  // Debug logging
  console.log('[WaitlistEmail] NEXT_PUBLIC_LAUNCH_DATE:', process.env.NEXT_PUBLIC_LAUNCH_DATE)
  console.log('[WaitlistEmail] LAUNCH_DATE:', process.env.LAUNCH_DATE)
  console.log('[WaitlistEmail] Using ISO:', iso)

  if (!iso) return { iso: undefined, human: 'our launch day' }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    console.warn('[WaitlistEmail] Invalid date:', iso)
    return { iso, human: iso }
  }

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

  console.log('[WaitlistEmail] Formatted date:', human)
  return { iso, human }
}

export function buildWaitlistThankYouContent(email: string, locale: string = 'en') {
  const nameFallback = email.split('@')[0]
  const { iso, human } = getLaunchDate()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thanks for joining the waitlist</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #111827;
            max-width: 640px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          }
          .logo {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
          }
          .logo-mark {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #ec4899, #8b5cf6);
            color: white;
            border-radius: 12px;
            display: grid;
            place-items: center;
            font-weight: 700;
            font-size: 20px;
          }
          .badge {
            display: inline-block;
            background: #f3e8ff;
            color: #6b21a8;
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            margin: 12px 0 18px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 26px;
            background: linear-gradient(135deg, #ec4899, #8b5cf6);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 700;
            margin-top: 18px;
          }
          .footer {
            margin-top: 28px;
            border-top: 1px solid #e5e7eb;
            padding-top: 16px;
            color: #6b7280;
            font-size: 13px;
            text-align: center;
          }
          .small {
            font-size: 13px;
            color: #374151;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-mark">も</div>
            <div style="font-size: 22px; font-weight: 800; color: #111;">Moshimoshi</div>
          </div>

          <div class="badge">Waitlist confirmed</div>

          <h2 style="margin: 0 0 10px 0;">Thanks for joining, ${nameFallback}!</h2>
          <p class="small" style="margin: 0 0 14px 0;">We're excited to have you on board.</p>

          <p class="small" style="margin: 0 0 8px 0;"><strong>Here's what you need to know:</strong></p>

          <div style="margin: 0 0 16px 0;">
            <div class="small" style="margin: 6px 0; padding-left: 4px;">✓ Moshimoshi is <strong>100% free to use</strong>—no trial, no expiration, no strings attached</div>
            <div class="small" style="margin: 6px 0; padding-left: 4px;">✓ You'll have full access to learn Japanese when we launch on <strong>${human || iso || 'launch day'}</strong></div>
            <div class="small" style="margin: 6px 0; padding-left: 4px;">✓ Premium is completely optional (extra features if you want them)</div>
            <div class="small" style="margin: 6px 0; padding-left: 4px;">✓ As an early supporter, you get <strong>25% off Premium</strong> if you ever choose to upgrade</div>
          </div>

          <p class="small" style="margin: 16px 0; padding: 12px; background: #f9fafb; border-left: 3px solid #8b5cf6; border-radius: 4px;">
            <strong>Bottom line:</strong> You're all set! When we launch, sign in with this email to use Moshimoshi for free, and only upgrade if you love it and want more.
          </p>

          <p class="small">We'll share updates as we get closer to launch. In the meantime, feel free to reply with any questions or requests.</p>

          <div style="margin-top: 18px;">
            <div class="small"><strong>Launch date:</strong> ${human || iso || 'TBA'}</div>
            <div class="small"><strong>Your email:</strong> ${email}</div>
            <div class="small"><strong>Discount:</strong> 25% off first invoice (auto-applied)</div>
          </div>

          <p class="small" style="margin-top: 18px;">ありがとうございます — we can’t wait to help you learn Japanese.<br/>The Moshimoshi Team</p>

          <div class="footer">
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

export async function sendWaitlistThankYouEmail(email: string, locale: string = 'en') {
  const { html, text } = buildWaitlistThankYouContent(email, locale)
  await sendEmail({
    to: email,
    subject: "You're on the Moshimoshi waitlist! 🚀 25% off at launch",
    html,
    text,
    from: 'Moshimoshi <noreply@moshimoshi.app>',
  })
}
