import { Resend } from 'resend'

// Lazy initialize Resend to avoid build-time errors
let resend: Resend | null = null

function getResendClient(): Resend {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  if (!resend) {
    throw new Error('Resend API key not configured')
  }
  return resend
}

export interface EmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
  from?: string
}

/**
 * Send email via Resend
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error('[Resend] API key not configured')
    throw new Error('Email service not configured')
  }

  try {
    const { data, error } = await getResendClient().emails.send({
      from: options.from || 'Moshimoshi <noreply@moshimoshi.app>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })

    if (error) {
      console.error('[Resend] Error sending email:', error)
      throw error
    }

    console.log('[Resend] Email sent successfully:', data?.id)
  } catch (error: any) {
    console.error('[Resend] Error sending email:', error)
    throw error
  }
}

/**
 * Send magic link email
 */
export async function sendMagicLinkEmail(email: string, magicLink: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sign in to Moshimoshi</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo h1 {
            color: #ec4899;
            font-size: 28px;
            margin: 0;
          }
          .button {
            display: inline-block;
            padding: 14px 30px;
            background-color: #ec4899;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #db2777;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
          }
          .warning {
            background-color: #fef3c7;
            border: 1px solid #fbbf24;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <div style="width: 48px; height: 48px; background-color: #ec4899; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
                も
              </div>
              <span style="font-size: 28px; font-weight: bold; color: #111;">
                Moshimoshi
              </span>
            </div>
          </div>

          <h2>Sign in to your account</h2>

          <p>Hi there!</p>

          <p>We received a request to sign in to Moshimoshi using this email address. Click the button below to sign in:</p>

          <div style="text-align: center;">
            <a href="${magicLink}" class="button">Sign in to Moshimoshi</a>
          </div>

          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${magicLink}
          </p>

          <div class="warning">
            ⚠️ This link will expire in 1 hour and can only be used once.
          </div>

          <p>If you didn't request this email, you can safely ignore it.</p>

          <div class="footer">
            <p>© 2024 Moshimoshi - Learn Japanese with AI</p>
            <p>
              <a href="https://moshimoshi.app/privacy" style="color: #ec4899; text-decoration: none;">Privacy Policy</a> •
              <a href="https://moshimoshi.app/terms" style="color: #ec4899; text-decoration: none;">Terms of Service</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
🌸 Moshimoshi - Sign in to your account

We received a request to sign in to Moshimoshi using this email address.

Click this link to sign in:
${magicLink}

This link will expire in 1 hour and can only be used once.

If you didn't request this email, you can safely ignore it.

© 2024 Moshimoshi - Learn Japanese with AI
  `

  await sendEmail({
    to: email,
    subject: 'Sign in to Moshimoshi',
    text,
    html,
  })
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(email: string, verificationLink: string, name?: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Moshimoshi</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            padding: 14px 30px;
            background-color: #ec4899;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #db2777;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
          }
          .warning {
            background-color: #dbeafe;
            border: 1px solid #3b82f6;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <div style="width: 48px; height: 48px; background-color: #ec4899; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
                も
              </div>
              <span style="font-size: 28px; font-weight: bold; color: #111;">
                Moshimoshi
              </span>
            </div>
          </div>

          <h2>Verify your email address</h2>

          <p>Hi ${name || 'there'}!</p>

          <p>Thanks for signing up for Moshimoshi! Please verify your email address to complete your registration and start your Japanese learning journey.</p>

          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email Address</a>
          </div>

          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${verificationLink}
          </p>

          <div class="warning">
            ℹ️ This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </div>

          <div class="footer">
            <p>© 2024 Moshimoshi - Learn Japanese with AI</p>
            <p>
              <a href="https://moshimoshi.app/privacy" style="color: #ec4899; text-decoration: none;">Privacy Policy</a> •
              <a href="https://moshimoshi.app/terms" style="color: #ec4899; text-decoration: none;">Terms of Service</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
🌸 Moshimoshi - Verify Your Email Address

Hi ${name || 'there'}!

Thanks for signing up for Moshimoshi! Please verify your email address to complete your registration.

Click this link to verify:
${verificationLink}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

© 2024 Moshimoshi - Learn Japanese with AI
  `

  await sendEmail({
    to: email,
    subject: 'Verify your email - Moshimoshi',
    text,
    html,
  })
}

/**
 * Send newsletter verification email
 */
export async function sendNewsletterVerificationEmail(email: string, verificationLink: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Newsletter Subscription - Moshimoshi</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            padding: 14px 30px;
            background-color: #ec4899;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #db2777;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
          }
          .warning {
            background-color: #dbeafe;
            border: 1px solid #3b82f6;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <div style="width: 48px; height: 48px; background-color: #ec4899; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
                も
              </div>
              <span style="font-size: 28px; font-weight: bold; color: #111;">
                Moshimoshi
              </span>
            </div>
          </div>

          <h2>Confirm your newsletter subscription</h2>

          <p>Hi there!</p>

          <p>Thanks for subscribing to the Moshimoshi newsletter! Please confirm your subscription to start receiving our latest updates, Japanese learning tips, and exclusive content.</p>

          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">Confirm Subscription</a>
          </div>

          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${verificationLink}
          </p>

          <div class="warning">
            ℹ️ This link will expire in 24 hours. If you didn't subscribe to our newsletter, you can safely ignore this email.
          </div>

          <div class="footer">
            <p>© 2024 Moshimoshi - Learn Japanese with AI</p>
            <p>
              <a href="https://moshimoshi.app/privacy" style="color: #ec4899; text-decoration: none;">Privacy Policy</a> •
              <a href="https://moshimoshi.app/terms" style="color: #ec4899; text-decoration: none;">Terms of Service</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
🌸 Moshimoshi - Confirm Newsletter Subscription

Hi there!

Thanks for subscribing to the Moshimoshi newsletter! Please confirm your subscription to start receiving our updates.

Click this link to confirm:
${verificationLink}

This link will expire in 24 hours.

If you didn't subscribe to our newsletter, you can safely ignore this email.

© 2024 Moshimoshi - Learn Japanese with AI
  `

  await sendEmail({
    to: email,
    subject: 'Confirm your newsletter subscription - Moshimoshi',
    text,
    html,
  })
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetLink: string, name?: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Moshimoshi</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            padding: 14px 30px;
            background-color: #ec4899;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            background-color: #db2777;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
          }
          .warning {
            background-color: #fef3c7;
            border: 1px solid #fbbf24;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <div style="width: 48px; height: 48px; background-color: #ec4899; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
                も
              </div>
              <span style="font-size: 28px; font-weight: bold; color: #111;">
                Moshimoshi
              </span>
            </div>
          </div>

          <h2>Reset your password</h2>

          <p>Hi ${name || 'there'}!</p>

          <p>We received a request to reset your password for your Moshimoshi account. Click the button below to create a new password:</p>

          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </div>

          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${resetLink}
          </p>

          <div class="warning">
            ⚠️ This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password will not be changed.
          </div>

          <div class="footer">
            <p>© 2024 Moshimoshi - Learn Japanese with AI</p>
            <p>
              <a href="https://moshimoshi.app/privacy" style="color: #ec4899; text-decoration: none;">Privacy Policy</a> •
              <a href="https://moshimoshi.app/terms" style="color: #ec4899; text-decoration: none;">Terms of Service</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Moshimoshi - Reset Your Password

Hi ${name || 'there'}!

We received a request to reset your password for your Moshimoshi account.

Click this link to reset your password:
${resetLink}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

© 2024 Moshimoshi - Learn Japanese with AI
  `

  await sendEmail({
    to: email,
    subject: 'Reset your password - Moshimoshi',
    text,
    html,
  })
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(email: string, name?: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Moshimoshi!</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo h1 {
            color: #ec4899;
            font-size: 28px;
            margin: 0;
          }
          .button {
            display: inline-block;
            padding: 14px 30px;
            background-color: #ec4899;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .feature {
            display: flex;
            align-items: center;
            margin: 15px 0;
          }
          .feature-icon {
            font-size: 24px;
            margin-right: 15px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <div style="width: 48px; height: 48px; background-color: #ec4899; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
                も
              </div>
              <span style="font-size: 28px; font-weight: bold; color: #111;">
                Moshimoshi
              </span>
            </div>
          </div>

          <h2>Welcome to Moshimoshi, ${name || 'Friend'}!</h2>

          <p>こんにちは! We're thrilled to have you join our Japanese learning community.</p>

          <p>Here's what you can do with Moshimoshi:</p>

          <div class="feature">
            <span class="feature-icon">🎯</span>
            <div>
              <strong>Personalized Learning</strong><br>
              AI-powered lessons that adapt to your pace and learning style
            </div>
          </div>

          <div class="feature">
            <span class="feature-icon">💬</span>
            <div>
              <strong>Real Conversations</strong><br>
              Practice speaking with our AI tutor in realistic scenarios
            </div>
          </div>

          <div class="feature">
            <span class="feature-icon">📊</span>
            <div>
              <strong>Track Progress</strong><br>
              Monitor your improvement with detailed analytics
            </div>
          </div>

          <div class="feature">
            <span class="feature-icon">🏆</span>
            <div>
              <strong>Achieve Goals</strong><br>
              From JLPT preparation to business Japanese
            </div>
          </div>

          <div style="text-align: center;">
            <a href="https://moshimoshi.app/dashboard" class="button">Start Learning</a>
          </div>

          <p>If you have any questions, feel free to reach out to us at <a href="mailto:support@moshimoshi.app" style="color: #ec4899;">support@moshimoshi.app</a></p>

          <p>頑張って! (Good luck!)</p>

          <div class="footer">
            <p>© 2024 Moshimoshi - Learn Japanese with AI</p>
            <p>
              <a href="https://moshimoshi.app/privacy" style="color: #ec4899; text-decoration: none;">Privacy Policy</a> •
              <a href="https://moshimoshi.app/terms" style="color: #ec4899; text-decoration: none;">Terms of Service</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Welcome to Moshimoshi, ${name || 'Friend'}!

こんにちは! We're thrilled to have you join our Japanese learning community.

Here's what you can do with Moshimoshi:

🎯 Personalized Learning - AI-powered lessons that adapt to your pace
💬 Real Conversations - Practice speaking with our AI tutor
📊 Track Progress - Monitor your improvement
🏆 Achieve Goals - From JLPT preparation to business Japanese

Start learning now: https://moshimoshi.app/dashboard

If you have any questions, reach out to us at support@moshimoshi.app

頑張って! (Good luck!)

© 2024 Moshimoshi - Learn Japanese with AI
  `

  await sendEmail({
    to: email,
    subject: `Welcome to Moshimoshi, ${name || 'Friend'}! 🌸`,
    text,
    html,
  })
}