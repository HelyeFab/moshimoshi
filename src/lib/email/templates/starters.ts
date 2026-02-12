/**
 * Email Template Starters
 *
 * Pre-built HTML templates that can be used as starting points.
 * These use the common elements from base.ts
 */

import {
  EMAIL_ASSETS,
  EMAIL_COLORS,
  EMAIL_STYLES,
  emailHeader,
  emailFooter,
  characterMessage,
  ctaButton,
  featureList,
  highlightBox,
  wrapEmailHtml,
} from './base'

/**
 * Welcome Email Starter
 * A friendly welcome email with Doshi greeting the new user
 */
export function welcomeEmailStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true, greeting: 'Welcome to Moshimoshi', recipientName: '{{name}}' })}

    <p style="${EMAIL_STYLES.paragraph}">
      We're so excited to have you join our community of Japanese learners!
    </p>

    ${characterMessage({
      character: 'doshi',
      message: "Hi there! I'm Doshi, your learning companion. I'll be here to help you on your Japanese journey. Let's make learning fun together!",
    })}

    <p style="${EMAIL_STYLES.paragraph}">
      <strong>Here's what you can do with Moshimoshi:</strong>
    </p>

    ${featureList([
      'Practice with YouTube shadowing exercises',
      'Learn kanji through visual connections',
      'Import your Anki decks for seamless study',
      'Track your progress with detailed stats',
      'Earn XP and maintain your streak',
    ])}

    ${ctaButton({ text: 'Start Learning Now', url: '{{appUrl}}' })}

    ${highlightBox({
      type: 'info',
      title: 'Pro tip',
      content: 'Start with just 5 minutes a day. Consistency beats intensity when learning a language!',
    })}

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
  `)

  const text = `
Welcome to Moshimoshi, {{name}}!

We're so excited to have you join our community of Japanese learners!

Doshi says: "Hi there! I'm Doshi, your learning companion. I'll be here to help you on your Japanese journey. Let's make learning fun together!"

Here's what you can do with Moshimoshi:
- Practice with YouTube shadowing exercises
- Learn kanji through visual connections
- Import your Anki decks for seamless study
- Track your progress with detailed stats
- Earn XP and maintain your streak

Start learning: {{appUrl}}

Pro tip: Start with just 5 minutes a day. Consistency beats intensity when learning a language!

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: 'Welcome to Moshimoshi, {{name}}!',
  }
}

/**
 * Feature Announcement Starter
 * Announce a new feature with excitement
 */
export function featureAnnouncementStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.primary}, ${EMAIL_COLORS.secondary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
        NEW FEATURE
      </span>
    </div>

    <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">
      {{featureTitle}}
    </h1>

    <p style="${EMAIL_STYLES.paragraph}">
      Hey {{name}},
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      We've been working hard on something special, and we're thrilled to share it with you!
    </p>

    ${characterMessage({
      character: 'emma',
      message: "I've been working on this feature for a while now. I really hope you'll love it as much as I enjoyed building it!",
      name: 'Emma (Developer)',
    })}

    <p style="${EMAIL_STYLES.paragraph}">
      {{featureDescription}}
    </p>

    ${ctaButton({ text: 'Try It Now', url: '{{featureUrl}}' })}

    <p style="${EMAIL_STYLES.smallText}; text-align: center;">
      We'd love to hear your feedback! Reply to this email anytime.
    </p>

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}' })}
  `)

  const text = `
NEW FEATURE: {{featureTitle}}

Hey {{name}},

We've been working hard on something special, and we're thrilled to share it with you!

Emma (Developer) says: "I've been working on this feature for a while now. I really hope you'll love it as much as I enjoyed building it!"

{{featureDescription}}

Try it now: {{featureUrl}}

We'd love to hear your feedback! Reply to this email anytime.

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: 'New in Moshimoshi: {{featureTitle}}',
  }
}

/**
 * Streak Reminder Starter
 * Gentle nudge to maintain their learning streak
 */
export function streakReminderStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 48px;">🔥</span>
      <h2 style="${EMAIL_STYLES.heading2}; margin-top: 12px;">
        Don't let your streak end!
      </h2>
    </div>

    <p style="${EMAIL_STYLES.paragraph}">
      Hey {{name}},
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      You've been on a <strong>{{streakDays}}-day streak</strong>! That's amazing dedication.
    </p>

    ${characterMessage({
      character: 'doshi',
      message: "You're doing great! Just a quick 5-minute session today will keep your streak alive. I believe in you!",
    })}

    <div style="text-align: center; padding: 20px; background: ${EMAIL_COLORS.background}; border-radius: 12px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: ${EMAIL_COLORS.textLight};">Current Streak</p>
      <p style="margin: 0; font-size: 36px; font-weight: 700; color: ${EMAIL_COLORS.primary};">{{streakDays}} days</p>
    </div>

    ${ctaButton({ text: 'Keep My Streak', url: '{{appUrl}}' })}

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
  `)

  const text = `
Don't let your streak end!

Hey {{name}},

You've been on a {{streakDays}}-day streak! That's amazing dedication.

Doshi says: "You're doing great! Just a quick 5-minute session today will keep your streak alive. I believe in you!"

Current Streak: {{streakDays}} days

Keep your streak: {{appUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: "Your {{streakDays}}-day streak is waiting!",
  }
}

/**
 * Weekly Progress Starter
 * Summary of the user's weekly learning progress
 */
export function weeklyProgressStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">
      Your Weekly Progress
    </h1>

    <p style="${EMAIL_STYLES.paragraph}; text-align: center; color: ${EMAIL_COLORS.textLight};">
      Week of {{weekDate}}
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      Hey {{name}}, here's what you accomplished this week:
    </p>

    <!-- Stats Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
      <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
        <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.primary};">{{xpEarned}}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">XP Earned</p>
      </div>
      <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
        <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.secondary};">{{wordsLearned}}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Words Learned</p>
      </div>
      <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
        <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.success};">{{minutesPracticed}}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Minutes</p>
      </div>
      <div style="text-align: center; padding: 16px; background: ${EMAIL_COLORS.background}; border-radius: 12px;">
        <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.accent};">{{currentStreak}}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.textLight};">Day Streak</p>
      </div>
    </div>

    ${characterMessage({
      character: 'doshi',
      message: "{{personalMessage}}",
    })}

    ${ctaButton({ text: 'Continue Learning', url: '{{appUrl}}' })}

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}' })}
  `)

  const text = `
Your Weekly Progress - Week of {{weekDate}}

Hey {{name}}, here's what you accomplished this week:

- XP Earned: {{xpEarned}}
- Words Learned: {{wordsLearned}}
- Minutes Practiced: {{minutesPracticed}}
- Current Streak: {{currentStreak}} days

Doshi says: "{{personalMessage}}"

Continue learning: {{appUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: 'Your Week in Review: {{xpEarned}} XP earned!',
  }
}

/**
 * New Content Release Starter
 * Announce new content like lessons, videos, or features
 */
export function newContentReleaseStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.accent}, ${EMAIL_COLORS.primary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
        {{contentType}}
      </span>
    </div>

    <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">
      {{contentTitle}}
    </h1>

    <p style="${EMAIL_STYLES.paragraph}">
      Hey {{name}},
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      We just released something new that we think you'll love!
    </p>

    ${characterMessage({
      character: 'doshi',
      message: "{{doshiMessage}}",
    })}

    <div style="background: ${EMAIL_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
      <h3 style="${EMAIL_STYLES.heading2}; margin-bottom: 16px;">{{contentTitle}}</h3>
      <p style="${EMAIL_STYLES.paragraph}; margin-bottom: 0;">
        {{contentDescription}}
      </p>
    </div>

    ${ctaButton({ text: 'Check It Out', url: '{{contentUrl}}' })}

    <p style="${EMAIL_STYLES.smallText}; text-align: center;">
      We're constantly working to bring you more content to help your Japanese journey!
    </p>

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}' })}
  `)

  const text = `
{{contentType}}: {{contentTitle}}

Hey {{name}},

We just released something new that we think you'll love!

Doshi says: "{{doshiMessage}}"

{{contentTitle}}
{{contentDescription}}

Check it out: {{contentUrl}}

We're constantly working to bring you more content to help your Japanese journey!

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: 'New {{contentType}}: {{contentTitle}}',
  }
}

/**
 * Thank You Note Starter
 * Express gratitude to subscribers
 */
export function thankYouNoteStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 48px;">💖</span>
    </div>

    <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">
      Thank You, {{name}}!
    </h1>

    <p style="${EMAIL_STYLES.paragraph}">
      We wanted to take a moment to express our heartfelt gratitude for being part of the Moshimoshi family.
    </p>

    ${characterMessage({
      character: 'doshi',
      message: "You're amazing! Every day you spend learning Japanese brings you one step closer to your goals. I'm so proud to be on this journey with you!",
    })}

    <p style="${EMAIL_STYLES.paragraph}">
      {{personalMessage}}
    </p>

    ${highlightBox({
      type: 'info',
      title: 'Your Impact',
      content: '{{impactMessage}}',
    })}

    ${characterMessage({
      character: 'emma',
      message: "Building Moshimoshi has been a labor of love, and knowing you're using it to learn Japanese makes it all worthwhile. Thank you for believing in us!",
      name: 'Emma (Developer)',
    })}

    <p style="${EMAIL_STYLES.paragraph}; text-align: center;">
      With gratitude,<br/>
      <strong>The Moshimoshi Team</strong>
    </p>

    ${ctaButton({ text: 'Continue Learning', url: '{{appUrl}}' })}

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
  `)

  const text = `
Thank You, {{name}}!

We wanted to take a moment to express our heartfelt gratitude for being part of the Moshimoshi family.

Doshi says: "You're amazing! Every day you spend learning Japanese brings you one step closer to your goals. I'm so proud to be on this journey with you!"

{{personalMessage}}

Your Impact: {{impactMessage}}

Emma (Developer) says: "Building Moshimoshi has been a labor of love, and knowing you're using it to learn Japanese makes it all worthwhile. Thank you for believing in us!"

With gratitude,
The Moshimoshi Team

Continue Learning: {{appUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: 'A Heartfelt Thank You from Moshimoshi 💖',
  }
}

/**
 * Co-Journey Series Announcement Starter
 * Announce Moshi's Minna no Nihongo Adventure video series
 */
export function coJourneyAnnouncementStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.accent}, ${EMAIL_COLORS.primary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
        NEW SERIES
      </span>
    </div>

    <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">
      Moshi's Minna no Nihongo Adventure
    </h1>

    <p style="${EMAIL_STYLES.paragraph}; text-align: center; color: ${EMAIL_COLORS.textLight}; font-size: 18px;">
      50 lessons. One red panda. Zero excuses.
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      Hey {{name}},
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      We've got something exciting to share &mdash; Moshi is taking on his biggest challenge yet!
    </p>

    ${characterMessage({
      character: 'doshi',
      message: "I looked at all 50 lessons of Minna no Nihongo and thought... FIFTY?! But then Pastel reminded me: you don't climb a mountain in one jump. You take it one step at a time. So that's what we're doing!",
    })}

    <!-- Series Card -->
    <div style="background: linear-gradient(135deg, #fff7ed, #fef3c7); border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #fed7aa;">
      <h3 style="${EMAIL_STYLES.heading2}; margin-bottom: 8px; text-align: center;">
        Moshi's Co-Journey
      </h3>
      <p style="margin: 0 0 16px 0; text-align: center; color: ${EMAIL_COLORS.textLight}; font-size: 14px;">
        <strong>みんなの日本語</strong> &mdash; Minna no Nihongo
      </p>
      <p style="${EMAIL_STYLES.paragraph}; margin-bottom: 0;">
        A brand new video series where Moshi learns every lesson of Minna no Nihongo from scratch. Short videos. Real grammar. Real vocabulary. One lesson at a time.
      </p>
    </div>

    ${featureList([
      'Follow along with Moshi lesson by lesson',
      'Short, focused videos you can watch anytime',
      'Real Minna no Nihongo grammar and vocabulary',
      'Start from zero &mdash; no prior Japanese needed',
      'New episodes dropping regularly on TikTok',
    ])}

    <div style="text-align: center; padding: 20px; background: ${EMAIL_COLORS.background}; border-radius: 12px; margin: 20px 0;">
      <p style="margin: 0 0 4px 0; font-size: 14px; color: ${EMAIL_COLORS.textLight};">Lesson 1 drops</p>
      <p style="margin: 0 0 4px 0; font-size: 32px; font-weight: 700; color: ${EMAIL_COLORS.primary};">{{launchDate}}</p>
      <p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.textLight};">on TikTok</p>
    </div>

    ${ctaButton({ text: 'Follow on TikTok', url: EMAIL_ASSETS.social.tiktok })}

    <div style="text-align: center; margin-top: 8px;">
      <a href="${EMAIL_ASSETS.appUrl}" style="${EMAIL_STYLES.smallText}; color: ${EMAIL_COLORS.primary}; text-decoration: underline;">
        Or continue learning on moshimoshi.app
      </a>
    </div>

    ${characterMessage({
      character: 'emma',
      message: "I built Moshimoshi to help people learn Japanese in a fun, supportive way. This series is the next step &mdash; learning alongside Moshi, one lesson at a time. I hope you'll join us!",
      name: 'Emma (Developer)',
    })}

    ${highlightBox({
      type: 'info',
      title: 'Already studying Minna no Nihongo?',
      content: "Whether you're on lesson 1 or lesson 40, this series is for you. Follow along, review what you've learned, or get a fresh perspective on tricky grammar points!",
    })}

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
  `)

  const text = `
NEW SERIES: Moshi's Minna no Nihongo Adventure

50 lessons. One red panda. Zero excuses.

Hey {{name}},

We've got something exciting to share - Moshi is taking on his biggest challenge yet!

Doshi says: "I looked at all 50 lessons of Minna no Nihongo and thought... FIFTY?! But then Pastel reminded me: you don't climb a mountain in one jump. You take it one step at a time. So that's what we're doing!"

---

MOSHI'S CO-JOURNEY: Minna no Nihongo

A brand new video series where Moshi learns every lesson of Minna no Nihongo from scratch. Short videos. Real grammar. Real vocabulary. One lesson at a time.

What to expect:
- Follow along with Moshi lesson by lesson
- Short, focused videos you can watch anytime
- Real Minna no Nihongo grammar and vocabulary
- Start from zero - no prior Japanese needed
- New episodes dropping regularly on TikTok

Lesson 1 drops {{launchDate}} on TikTok!

Follow on TikTok: https://www.tiktok.com/@moshimoshiapp23
Or keep learning: https://moshimoshi.app

Emma (Developer) says: "I built Moshimoshi to help people learn Japanese in a fun, supportive way. This series is the next step - learning alongside Moshi, one lesson at a time. I hope you'll join us!"

Already studying Minna no Nihongo? Whether you're on lesson 1 or lesson 40, this series is for you. Follow along, review what you've learned, or get a fresh perspective on tricky grammar points!

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: "Moshi's learning ALL of Minna no Nihongo - come join the adventure!",
  }
}

/**
 * Flashcards Launch Announcement Starter
 * Announce the new flashcards feature with study modes and DeckMarket
 */
export function flashcardsLaunchStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, ${EMAIL_COLORS.primary}, ${EMAIL_COLORS.secondary}); color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
        NEW FEATURE
      </span>
    </div>

    <h1 style="${EMAIL_STYLES.heading1}; text-align: center;">
      Flashcards just landed in Moshimoshi
    </h1>

    <p style="${EMAIL_STYLES.paragraph}; text-align: center; color: ${EMAIL_COLORS.textLight}; font-size: 18px;">
      Build, import, and master vocabulary with smart spaced repetition &mdash; right where you already learn.
    </p>

    <hr style="${EMAIL_STYLES.divider}" />

    ${characterMessage({
      character: 'doshi',
      message: "{{name}}-san! I've been waiting to tell you this &mdash; you can study flashcards with me now! Create your own decks, import your Anki collection, or grab a deck from DeckMarket. Let's get that vocabulary locked in together!",
    })}

    <h2 style="${EMAIL_STYLES.heading2}">
      Here's what you can do
    </h2>

    ${featureList([
      '<strong>Create your own decks</strong> &mdash; type in vocab, phrases, or kanji and start studying in seconds',
      '<strong>Import Anki decks</strong> &mdash; drop in any .apkg file and your cards, media, and progress come along',
      '<strong>Browse DeckMarket</strong> &mdash; pick from curated community decks and add them with one tap',
      '<strong>Smart SRS scheduling</strong> &mdash; the app figures out what you need to review and when',
      '<strong>Study offline</strong> &mdash; your cards live on your device, so you can study on the train, in a cafe, anywhere',
    ])}

    <!-- Study modes highlight -->
    <div style="background: linear-gradient(135deg, #fdf2f8, #ede9fe); border-radius: 12px; padding: 24px; margin: 24px 0;">
      <p style="margin: 0 0 16px 0; font-weight: 700; font-size: 18px; color: ${EMAIL_COLORS.text};">
        Multiple ways to study
      </p>
      <p style="margin: 0 0 10px 0; color: ${EMAIL_COLORS.textLight}; font-size: 15px;">
        <strong style="color: ${EMAIL_COLORS.primary};">Mistake Replay</strong> &mdash; revisit cards you got wrong across your last 3 sessions
      </p>
      <p style="margin: 0 0 10px 0; color: ${EMAIL_COLORS.textLight}; font-size: 15px;">
        <strong style="color: ${EMAIL_COLORS.secondary};">Audio First</strong> &mdash; practice listening with audio-only card sessions
      </p>
      <p style="margin: 0 0 10px 0; color: ${EMAIL_COLORS.textLight}; font-size: 15px;">
        <strong style="color: ${EMAIL_COLORS.accent};">Heat Focus</strong> &mdash; surfaces your most fragile cards so you nail the hard ones first
      </p>
      <p style="margin: 0; color: ${EMAIL_COLORS.textLight}; font-size: 15px;">
        <strong style="color: ${EMAIL_COLORS.success};">Momentum Coach</strong> &mdash; quick nudges to keep your streak alive
      </p>
    </div>

    ${highlightBox({
      type: 'info',
      title: 'Pro tip',
      content: 'Already use Anki? Export your deck as .apkg and import it into Moshimoshi &mdash; all your cards and media come with it. No starting over.',
    })}

    ${ctaButton({ text: 'Try Flashcards Now', url: 'https://moshimoshi.app/en/flashcards' })}

    <p style="${EMAIL_STYLES.smallText}; text-align: center;">
      Free users can study a DeckMarket deck for free. Premium users get unlimited decks, cross-device sync, and cloud backup.
    </p>

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
  `)

  const text = `
NEW FEATURE: Flashcards just landed in Moshimoshi

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

Try Flashcards Now: https://moshimoshi.app/en/flashcards

Free users can study a DeckMarket deck for free. Premium users get unlimited decks, cross-device sync, and cloud backup.

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: '{{name}}, your new secret weapon for Japanese is here',
  }
}

/**
 * Simple Newsletter Starter
 * Clean template for general announcements
 */
export function newsletterStarter(): { html: string; text: string; subject: string } {
  const html = wrapEmailHtml(`
    ${emailHeader({ showLogo: true })}

    <h1 style="${EMAIL_STYLES.heading1}">
      {{headline}}
    </h1>

    <p style="${EMAIL_STYLES.paragraph}">
      Hey {{name}},
    </p>

    <p style="${EMAIL_STYLES.paragraph}">
      {{introText}}
    </p>

    <hr style="${EMAIL_STYLES.divider}" />

    {{mainContent}}

    <hr style="${EMAIL_STYLES.divider}" />

    <p style="${EMAIL_STYLES.paragraph}">
      {{closingText}}
    </p>

    ${ctaButton({ text: '{{ctaText}}', url: '{{ctaUrl}}' })}

    ${emailFooter({ unsubscribeUrl: '{{unsubscribeUrl}}', showDoshi: true })}
  `)

  const text = `
{{headline}}

Hey {{name}},

{{introText}}

---

{{mainContent}}

---

{{closingText}}

{{ctaText}}: {{ctaUrl}}

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: {{unsubscribeUrl}}
  `.trim()

  return {
    html,
    text,
    subject: '{{subject}}',
  }
}

/**
 * Get all available starter templates
 */
export function getStarterTemplates() {
  return {
    welcome: {
      name: 'Welcome Email',
      description: 'A friendly welcome email with Doshi greeting new users',
      ...welcomeEmailStarter(),
    },
    featureAnnouncement: {
      name: 'Feature Announcement',
      description: 'Announce new features with Emma (developer) message',
      ...featureAnnouncementStarter(),
    },
    newContentRelease: {
      name: 'New Content Release',
      description: 'Announce new lessons, videos, or content with customizable type',
      ...newContentReleaseStarter(),
    },
    thankYouNote: {
      name: 'Thank You Note',
      description: 'Express gratitude to subscribers with heartfelt message',
      ...thankYouNoteStarter(),
    },
    streakReminder: {
      name: 'Streak Reminder',
      description: 'Gentle nudge to maintain learning streak',
      ...streakReminderStarter(),
    },
    weeklyProgress: {
      name: 'Weekly Progress',
      description: 'Summary of weekly learning stats',
      ...weeklyProgressStarter(),
    },
    newsletter: {
      name: 'Newsletter',
      description: 'Clean template for general announcements',
      ...newsletterStarter(),
    },
    coJourneyAnnouncement: {
      name: 'Co-Journey Series Announcement',
      description: "Announce Moshi's Minna no Nihongo Adventure video series on TikTok",
      ...coJourneyAnnouncementStarter(),
    },
    flashcardsLaunch: {
      name: 'Flashcards Launch Announcement',
      description: 'Announce the new flashcards feature with study modes, Anki import, and DeckMarket integration',
      ...flashcardsLaunchStarter(),
    },
  }
}
