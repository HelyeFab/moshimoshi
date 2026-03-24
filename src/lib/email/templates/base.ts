/**
 * Email Template Base
 *
 * Common elements, assets, and HTML builders for email templates.
 * All images use absolute URLs for email client compatibility.
 */

// Base URL for assets (use production URL)
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'

/**
 * Common Email Assets
 * These are publicly accessible images that can be used in all templates
 */
export const EMAIL_ASSETS = {
  // Logo variations
  logo: `${BASE_URL}/logo-mo-generated.png`,
  logoWithText: `${BASE_URL}/logo-mo-with-text.svg`,
  logoSvg: `${BASE_URL}/logo-mo.svg`,

  // Character images
  doshi: `${BASE_URL}/doshi.png`,           // Red panda mascot
  doshiEmma: `${BASE_URL}/doshi-emma.JPG`,  // Developer/Emma character

  // Social links
  social: {
    x: 'https://x.com/AppMoshimoshi',
    instagram: 'https://www.instagram.com/moshimoshi.app/',
    tiktok: 'https://www.tiktok.com/@moshimoshiapp23',
    facebook: 'https://www.facebook.com/profile.php?id=61583293235389',
  },

  // App links
  appUrl: BASE_URL,
  settingsUrl: `${BASE_URL}/settings/notifications`,
}

/**
 * Brand Colors
 */
export const EMAIL_COLORS = {
  primary: '#ec4899',      // Pink
  primaryDark: '#db2777',
  secondary: '#8b5cf6',    // Purple
  accent: '#f97316',       // Orange
  text: '#111827',
  textLight: '#6b7280',
  textMuted: '#9ca3af',
  background: '#f5f5f5',
  cardBg: '#ffffff',
  border: '#e5e7eb',
  success: '#10b981',
  error: '#ef4444',
}

/**
 * Common Inline Styles (for email client compatibility)
 */
export const EMAIL_STYLES = {
  // Container
  body: `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: ${EMAIL_COLORS.text};
    background-color: ${EMAIL_COLORS.background};
    margin: 0;
    padding: 0;
  `.trim(),

  container: `
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  `.trim(),

  card: `
    background: ${EMAIL_COLORS.cardBg};
    border-radius: 12px;
    padding: 32px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
  `.trim(),

  // Typography
  heading1: `
    margin: 0 0 16px 0;
    font-size: 28px;
    font-weight: 700;
    color: ${EMAIL_COLORS.text};
  `.trim(),

  heading2: `
    margin: 0 0 12px 0;
    font-size: 22px;
    font-weight: 600;
    color: ${EMAIL_COLORS.text};
  `.trim(),

  paragraph: `
    margin: 0 0 16px 0;
    font-size: 16px;
    color: ${EMAIL_COLORS.text};
  `.trim(),

  smallText: `
    font-size: 14px;
    color: ${EMAIL_COLORS.textLight};
  `.trim(),

  mutedText: `
    font-size: 12px;
    color: ${EMAIL_COLORS.textMuted};
  `.trim(),

  // Buttons
  primaryButton: `
    display: inline-block;
    padding: 14px 28px;
    background: linear-gradient(135deg, ${EMAIL_COLORS.primary}, ${EMAIL_COLORS.secondary});
    color: #ffffff;
    text-decoration: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 16px;
  `.trim(),

  secondaryButton: `
    display: inline-block;
    padding: 12px 24px;
    background: ${EMAIL_COLORS.background};
    color: ${EMAIL_COLORS.text};
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    border: 1px solid ${EMAIL_COLORS.border};
  `.trim(),

  // Links
  link: `
    color: ${EMAIL_COLORS.primary};
    text-decoration: underline;
  `.trim(),

  // Images
  logoStyle: `
    width: 60px;
    height: 60px;
    border-radius: 12px;
  `.trim(),

  characterImage: `
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
  `.trim(),

  // Divider
  divider: `
    border: none;
    border-top: 1px solid ${EMAIL_COLORS.border};
    margin: 24px 0;
  `.trim(),
}

/**
 * Email Header Component
 * Renders the logo and optional greeting
 */
export function emailHeader(options?: {
  showLogo?: boolean
  greeting?: string
  recipientName?: string
}): string {
  const { showLogo = true, greeting, recipientName } = options || {}

  const logoHtml = showLogo
    ? `
      <div style="margin-bottom: 20px;">
        <img src="${EMAIL_ASSETS.logo}" alt="Moshimoshi" style="${EMAIL_STYLES.logoStyle}" />
      </div>
    `
    : ''

  const greetingHtml = greeting
    ? `<h2 style="${EMAIL_STYLES.heading2}">${greeting}${recipientName ? `, ${recipientName}` : ''}!</h2>`
    : ''

  return `
    <div style="text-align: center; margin-bottom: 24px;">
      ${logoHtml}
      ${greetingHtml}
    </div>
  `
}

/**
 * Email Footer Component
 * Renders unsubscribe link, social links, and legal text
 */
export function emailFooter(options?: {
  unsubscribeUrl?: string
  showSocial?: boolean
  showDoshi?: boolean
}): string {
  const { unsubscribeUrl, showSocial = true, showDoshi = false } = options || {}

  const doshiHtml = showDoshi
    ? `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${EMAIL_ASSETS.doshi}" alt="Moshi" style="width: 60px; height: 60px;" />
      </div>
    `
    : ''

  const socialHtml = showSocial
    ? `
      <div style="text-align: center; margin-bottom: 16px;">
        <a href="${EMAIL_ASSETS.social.x}" style="margin: 0 6px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">X</a>
        <span style="color: ${EMAIL_COLORS.border};">|</span>
        <a href="${EMAIL_ASSETS.social.instagram}" style="margin: 0 6px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">Instagram</a>
        <span style="color: ${EMAIL_COLORS.border};">|</span>
        <a href="${EMAIL_ASSETS.social.tiktok}" style="margin: 0 6px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">TikTok</a>
        <span style="color: ${EMAIL_COLORS.border};">|</span>
        <a href="${EMAIL_ASSETS.social.facebook}" style="margin: 0 6px; color: ${EMAIL_COLORS.textMuted}; text-decoration: none;">Facebook</a>
      </div>
    `
    : ''

  const unsubscribeHtml = unsubscribeUrl
    ? `
      <p style="${EMAIL_STYLES.mutedText}">
        <a href="${unsubscribeUrl}" style="color: ${EMAIL_COLORS.textMuted}; text-decoration: underline;">Unsubscribe</a>
        from marketing emails
      </p>
    `
    : ''

  return `
    <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid ${EMAIL_COLORS.border}; text-align: center;">
      ${doshiHtml}
      ${socialHtml}
      <p style="${EMAIL_STYLES.mutedText}">
        You're receiving this email because you signed up for Moshimoshi.
      </p>
      ${unsubscribeHtml}
      <p style="${EMAIL_STYLES.mutedText}; margin-top: 12px;">
        &copy; ${new Date().getFullYear()} Moshimoshi. All rights reserved.
      </p>
    </div>
  `
}

/**
 * Character Message Component
 * Renders a message from Moshi or Emma with their avatar
 */
export function characterMessage(options: {
  character: 'doshi' | 'emma'
  message: string
  name?: string
}): string {
  const { character, message, name } = options
  const imageSrc = character === 'doshi' ? EMAIL_ASSETS.doshi : EMAIL_ASSETS.doshiEmma
  const characterName = name || (character === 'doshi' ? 'Moshi' : 'Emma')

  return `
    <div style="margin: 24px 0; padding: 20px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 12px;">
        <img src="${imageSrc}" alt="${characterName}" style="${EMAIL_STYLES.characterImage}" />
        <p style="margin: 8px 0 0 0; font-weight: 600; color: ${EMAIL_COLORS.text};">${characterName}</p>
      </div>
      <p style="margin: 0; color: ${EMAIL_COLORS.textLight}; text-align: left;">${message}</p>
    </div>
  `
}

/**
 * CTA Button Component
 */
export function ctaButton(options: {
  text: string
  url: string
  variant?: 'primary' | 'secondary'
}): string {
  const { text, url, variant = 'primary' } = options
  const style = variant === 'primary' ? EMAIL_STYLES.primaryButton : EMAIL_STYLES.secondaryButton

  return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${url}" style="${style}">${text}</a>
    </div>
  `
}

/**
 * Feature List Component
 * Renders a list of features with checkmarks
 */
export function featureList(features: string[]): string {
  const items = features
    .map(
      (feature) => `
      <li style="margin-bottom: 8px; padding-left: 8px;">
        <span style="color: ${EMAIL_COLORS.success}; margin-right: 8px;">✓</span>
        ${feature}
      </li>
    `
    )
    .join('')

  return `
    <ul style="list-style: none; padding: 0; margin: 16px 0;">
      ${items}
    </ul>
  `
}

/**
 * Highlight Box Component
 * For important callouts or tips
 */
export function highlightBox(options: {
  content: string
  type?: 'info' | 'success' | 'warning'
  title?: string
}): string {
  const { content, type = 'info', title } = options

  const colors = {
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
  }

  const c = colors[type]

  return `
    <div style="padding: 16px; background: ${c.bg}; border-left: 4px solid ${c.border}; border-radius: 8px; margin: 16px 0;">
      ${title ? `<p style="margin: 0 0 8px 0; font-weight: 600; color: ${c.text};">${title}</p>` : ''}
      <p style="margin: 0; color: ${c.text};">${content}</p>
    </div>
  `
}

/**
 * Wrap content in full email HTML structure
 */
export function wrapEmailHtml(content: string): string {
  return `
<!DOCTYPE html>
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
    /* Mobile responsive */
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        padding: 12px !important;
      }
      .email-card {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body style="${EMAIL_STYLES.body}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div class="email-container" style="${EMAIL_STYLES.container}; width: 100%;">
    <div class="email-card" style="${EMAIL_STYLES.card}">
      ${content}
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Build a complete email with header, content, and footer
 */
export function buildEmail(options: {
  content: string
  greeting?: string
  recipientName?: string
  showLogo?: boolean
  showDoshiInFooter?: boolean
  unsubscribeUrl?: string
}): string {
  const {
    content,
    greeting,
    recipientName,
    showLogo = true,
    showDoshiInFooter = false,
    unsubscribeUrl,
  } = options

  const header = emailHeader({ showLogo, greeting, recipientName })
  const footer = emailFooter({ unsubscribeUrl, showDoshi: showDoshiInFooter })

  return wrapEmailHtml(`
    ${header}
    ${content}
    ${footer}
  `)
}
