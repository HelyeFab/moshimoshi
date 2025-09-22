/**
 * Base email template for all notification emails
 * Provides consistent branding and layout
 */

export interface EmailTemplateProps {
  userName: string
  unsubscribeUrl: string
  preferencesUrl: string
}

export const baseEmailTemplate = (content: string, props: EmailTemplateProps) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Moshimoshi Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">
                もしもし Moshimoshi
              </h1>
              <p style="color: #fce7f3; margin: 10px 0 0 0; font-size: 14px;">
                Your Japanese Learning Companion
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
                You're receiving this email because you have notifications enabled in your Moshimoshi account.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${props.preferencesUrl}"
                       style="color: #8b5cf6; text-decoration: none; font-size: 14px; margin: 0 15px;">
                      Manage Preferences
                    </a>
                    <span style="color: #d1d5db;">|</span>
                    <a href="${props.unsubscribeUrl}"
                       style="color: #8b5cf6; text-decoration: none; font-size: 14px; margin: 0 15px;">
                      Unsubscribe
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0;">
                © ${new Date().getFullYear()} Moshimoshi. All rights reserved.<br>
                Learn Japanese with confidence 🌸
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

/**
 * Simple text version for email clients that don't support HTML
 */
export const baseTextTemplate = (content: string, props: EmailTemplateProps) => `
Moshimoshi - Your Japanese Learning Companion

${content}

---
You're receiving this email because you have notifications enabled in your Moshimoshi account.

Manage Preferences: ${props.preferencesUrl}
Unsubscribe: ${props.unsubscribeUrl}

© ${new Date().getFullYear()} Moshimoshi. All rights reserved.
`