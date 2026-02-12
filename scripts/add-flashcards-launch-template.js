/**
 * Add Flashcards Launch Announcement template to Firestore
 *
 * Usage: node scripts/add-flashcards-launch-template.js
 */

const admin = require('firebase-admin')
const path = require('path')

// Initialize Firebase Admin
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #f5f5f5; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div class="email-container" style="max-width: 600px; margin: 0 auto; padding: 20px; width: 100%;">
    <div class="email-card" style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">

      <!-- Header with Logo -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="margin-bottom: 20px;">
          <img src="https://moshimoshi.app/logo-mo-generated.png" alt="Moshimoshi" style="width: 60px; height: 60px; border-radius: 12px; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
        </div>
      </div>

      <!-- Announcement badge -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
          NEW FEATURE
        </span>
      </div>

      <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #111827; text-align: center; line-height: 1.3;">
        Flashcards just landed in Moshimoshi
      </h1>

      <p style="margin: 0 0 16px 0; font-size: 18px; color: #6b7280; text-align: center; line-height: 1.6;">
        Build, import, and master vocabulary with smart spaced repetition &mdash; right where you already learn.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

      <!-- Doshi message -->
      <div style="display: flex; align-items: flex-start; gap: 16px; margin: 24px 0; padding: 20px; background: #f5f5f5; border-radius: 12px;">
        <img src="https://moshimoshi.app/doshi.png" alt="Doshi" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" />
        <div style="flex: 1;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827;">Doshi</p>
          <p style="margin: 0; color: #6b7280; line-height: 1.6;">{{name}}-san! I've been waiting to tell you this &mdash; you can study flashcards with me now! Create your own decks, import your Anki collection, or grab a deck from DeckMarket. Let's get that vocabulary locked in together!</p>
        </div>
      </div>

      <!-- What you can do -->
      <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827; line-height: 1.3;">
        Here's what you can do
      </h2>

      <ul style="list-style: none; padding: 0; margin: 16px 0;">
        <li style="margin-bottom: 12px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          <span style="color: #10b981; margin-right: 8px; font-weight: 700;">&#10003;</span>
          <strong>Create your own decks</strong> &mdash; type in vocab, phrases, or kanji and start studying in seconds
        </li>
        <li style="margin-bottom: 12px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          <span style="color: #10b981; margin-right: 8px; font-weight: 700;">&#10003;</span>
          <strong>Import Anki decks</strong> &mdash; drop in any .apkg file and your cards, media, and progress come along
        </li>
        <li style="margin-bottom: 12px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          <span style="color: #10b981; margin-right: 8px; font-weight: 700;">&#10003;</span>
          <strong>Browse DeckMarket</strong> &mdash; pick from curated community decks and add them with one tap
        </li>
        <li style="margin-bottom: 12px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          <span style="color: #10b981; margin-right: 8px; font-weight: 700;">&#10003;</span>
          <strong>Smart SRS scheduling</strong> &mdash; the app figures out what you need to review and when
        </li>
        <li style="margin-bottom: 12px; padding-left: 8px; font-size: 16px; color: #111827; line-height: 1.6;">
          <span style="color: #10b981; margin-right: 8px; font-weight: 700;">&#10003;</span>
          <strong>Study offline</strong> &mdash; your cards live on your device, so you can study on the train, in a cafe, anywhere
        </li>
      </ul>

      <!-- Study modes highlight -->
      <div style="background: linear-gradient(135deg, #fdf2f8, #ede9fe); border-radius: 12px; padding: 24px; margin: 24px 0;">
        <p style="margin: 0 0 16px 0; font-weight: 700; font-size: 18px; color: #111827; line-height: 1.3;">
          Multiple ways to study
        </p>
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 15px; line-height: 1.6;">
          <strong style="color: #ec4899;">Mistake Replay</strong> &mdash; revisit cards you got wrong across your last 3 sessions
        </p>
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 15px; line-height: 1.6;">
          <strong style="color: #8b5cf6;">Audio First</strong> &mdash; practice listening with audio-only card sessions
        </p>
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 15px; line-height: 1.6;">
          <strong style="color: #f97316;">Heat Focus</strong> &mdash; surfaces your most fragile cards so you nail the hard ones first
        </p>
        <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.6;">
          <strong style="color: #10b981;">Momentum Coach</strong> &mdash; quick nudges to keep your streak alive
        </p>
      </div>

      <!-- Pro tip -->
      <div style="padding: 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af; line-height: 1.5;">Pro tip</p>
        <p style="margin: 0; color: #1e40af; line-height: 1.6;">Already use Anki? Export your deck as .apkg and import it into Moshimoshi &mdash; all your cards and media come with it. No starting over.</p>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="https://moshimoshi.app/en/flashcards?utm_source=email&utm_medium=announcement&utm_campaign=flashcards_launch" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; line-height: 1.3;">
          Try Flashcards Now
        </a>
      </div>

      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6;">
        Free users can study a DeckMarket deck for free. Premium users get unlimited decks, cross-device sync, and cloud backup.
      </p>

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://moshimoshi.app/doshi.png" alt="Doshi" style="width: 60px; height: 60px;" />
        </div>

        <!-- Social links -->
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
          You're receiving this email because you signed up for Moshimoshi.
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin: 8px 0; line-height: 1.5;">
          <a href="{{unsubscribeUrl}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from marketing emails
        </p>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 12px; line-height: 1.5;">
          &copy; 2026 Moshimoshi. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>`

const textContent = `NEW FEATURE: Flashcards just landed in Moshimoshi

Build, import, and master vocabulary with smart spaced repetition - right where you already learn.

Hey {{name}},

Doshi says: "{{name}}-san! I've been waiting to tell you this - you can study flashcards with me now! Create your own decks, import your Anki collection, or grab a deck from DeckMarket. Let's get that vocabulary locked in together!"

HERE'S WHAT YOU CAN DO:
- Create your own decks - type in vocab, phrases, or kanji and start studying in seconds
- Import Anki decks - drop in any .apkg file and your cards, media, and progress come along
- Browse DeckMarket - pick from curated community decks and add them with one tap
- Smart SRS scheduling - the app figures out what you need to review and when
- Study offline - your cards live on your device, so you can study anywhere

STUDY MODES:
- Mistake Replay: revisit cards you got wrong across your last 3 sessions
- Audio First: practice listening with audio-only card sessions
- Heat Focus: surfaces your most fragile cards so you nail the hard ones first
- Momentum Coach: quick nudges to keep your streak alive

Pro tip: Already use Anki? Export your deck as .apkg and import it into Moshimoshi - all your cards and media come with it. No starting over.

Try Flashcards Now: https://moshimoshi.app/en/flashcards?utm_source=email&utm_medium=announcement&utm_campaign=flashcards_launch

Free users can study a DeckMarket deck for free. Premium users get unlimited decks, cross-device sync, and cloud backup.

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
© 2026 Moshimoshi. All rights reserved.`

const template = {
  name: 'Flashcards Launch Announcement',
  slug: 'flashcards-launch',
  description: 'Marketing campaign announcing the new flashcards feature with study modes, Anki import, DeckMarket integration, and SRS scheduling.',
  subject: '{{name}}, your new secret weapon for Japanese is here',
  htmlContent: htmlContent,
  textContent: textContent,
  category: 'marketing',
  status: 'active',
  variables: [
    {
      name: 'name',
      label: 'Recipient Name',
      type: 'string',
      defaultValue: 'there',
      required: false,
    },
  ],
  createdBy: 'system',
  createdAt: admin.firestore.Timestamp.now(),
  updatedBy: 'system',
  updatedAt: admin.firestore.Timestamp.now(),
}

async function addTemplate() {
  try {
    // Check if template with this slug already exists
    const existing = await db.collection('email_templates')
      .where('slug', '==', 'flashcards-launch')
      .get()

    if (!existing.empty) {
      console.log('Template with slug "flashcards-launch" already exists.')
      console.log(`Existing ID: ${existing.docs[0].id}`)
      console.log('Delete it first or use a different slug.')
      process.exit(1)
    }

    console.log('Adding Flashcards Launch template to Firestore...')

    const docRef = await db.collection('email_templates').add(template)

    console.log('Template added successfully!')
    console.log(`Template ID: ${docRef.id}`)
    console.log(`Name: ${template.name}`)
    console.log(`Slug: ${template.slug}`)
    console.log(`Status: ${template.status}`)
    console.log(`\nView in admin: http://localhost:3000/en/admin/email-templates`)
    console.log('\nRefresh your browser to see the new template.')

    process.exit(0)
  } catch (error) {
    console.error('Error adding template:', error)
    process.exit(1)
  }
}

addTemplate()
