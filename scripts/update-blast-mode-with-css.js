const admin = require('firebase-admin')
const path = require('path')

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Blast Mode is Here</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #f5f5f5; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div class="email-container" style="max-width: 600px; margin: 0 auto; padding: 20px; width: 100%;">
    <div class="email-card" style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">

      <div style="text-align: center; margin-bottom: 24px;">
        <div style="margin-bottom: 20px;">
          <img src="https://moshimoshi.app/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
        </div>
      </div>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        Hey {{firstName}},
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        I just launched Blast Mode.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        It's a new way to practice kanji that focuses on one thing: actually mastering what you're learning.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        Here's how it works.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

      <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827; line-height: 1.3;">
        The 5-Kanji Rule
      </h2>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        You start with 5 kanji.
      </p>

      <p style="margin: 0 0 8px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        You practice them through different question types:
      </p>

      <ul style="list-style: none; padding: 0; margin: 0 0 16px 0;">
        <li style="margin-bottom: 6px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          • Meaning to Japanese
        </li>
        <li style="margin-bottom: 6px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          • Reassemble the characters
        </li>
        <li style="margin-bottom: 6px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          • Onyomi readings
        </li>
        <li style="margin-bottom: 6px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          • Kunyomi readings
        </li>
        <li style="margin-bottom: 6px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          • Japanese to meaning
        </li>
      </ul>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        You need to get everything right — <strong>100% accuracy</strong>.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        Only then do you move to the next 5.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        No shortcuts. No "good enough." You either know it, or you keep practicing until you do.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

      <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827; line-height: 1.3;">
        Why This Works
      </h2>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        Most apps let you move forward even when you're still shaky on the basics.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        Blast Mode doesn't.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        5 kanji. Master them. Move on.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        It's slower upfront. But you actually remember what you learn.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

      <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827; text-align: center; line-height: 1.3;">
        Try It Now
      </h2>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        It's live in your dashboard right now.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="https://moshimoshi.app/tools/blast-mode?utm_source=email&utm_medium=announcement&utm_campaign=blast_mode_launch" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; line-height: 1.3;">
          → Launch Blast Mode
        </a>
      </div>

      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6;">
        Look for the lightning bolt ⚡.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        That's it.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        Let me know what you think.
      </p>

      <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 1.6;">
        — Emmanuel<br/>
        <span style="font-size: 14px; color: #6b7280;">Founder, Moshimoshi</span>
      </p>

      <div style="text-align: center; margin-top: 24px;">
        <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.6;">
          <a href="https://moshimoshi.app" style="color: #6b7280; margin: 0 8px; text-decoration: none;">moshimoshi.app</a>
          <span style="color: #e5e7eb;">|</span>
          <a href="https://moshimoshi.app/dashboard" style="color: #6b7280; margin: 0 8px; text-decoration: none;">Dashboard</a>
        </p>
      </div>

      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
        <div style="text-align: center; margin-bottom: 16px;">
          <a href="https://x.com/AppMoshimoshi" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">X</a>
          <span style="color: #e5e7eb;">|</span>
          <a href="https://www.instagram.com/moshimoshi.app/" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">Instagram</a>
          <span style="color: #e5e7eb;">|</span>
          <a href="https://www.tiktok.com/@moshimoshiapp23" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">TikTok</a>
          <span style="color: #e5e7eb;">|</span>
          <a href="https://www.facebook.com/profile.php?id=61583293235389" style="margin: 0 6px; color: #9ca3af; text-decoration: none;">Facebook</a>
        </div>

        <p style="font-size: 12px; color: #9ca3af; margin: 8px 0; line-height: 1.5;">
          You're receiving this because you have a Moshimoshi account.
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin: 8px 0; line-height: 1.5;">
          <a href="{{unsubscribeUrl}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from marketing emails
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 12px; line-height: 1.5;">
          © 2026 Moshimoshi. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>`

async function updateTemplate() {
  try {
    const snapshot = await db.collection('email_templates')
      .where('slug', '==', 'blast-mode-announcement')
      .get()

    if (snapshot.empty) {
      console.log('❌ Template not found')
      process.exit(1)
    }

    const doc = snapshot.docs[0]
    await doc.ref.update({
      htmlContent: htmlContent,
      updatedAt: admin.firestore.Timestamp.now()
    })

    console.log('✅ Template updated with your text changes + full CSS!')
    console.log('📝 Changes made:')
    console.log('   - Removed "6" from "different question types"')
    console.log('   - Kept 5 question types (removed Context questions)')
    console.log('   - ALL CSS RESTORED (inline styles, <style> tag, meta tags)')
    console.log('\n🔄 Refresh your browser to see the styled version!')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

updateTemplate()
