#!/usr/bin/env node

/**
 * Check Notification Preferences Script
 *
 * Displays a user's notification preferences including:
 * - Channel settings (browser, push, email, in-app)
 * - Feature reminder toggles (kana, flashcards, kanji, etc.)
 * - Timing, quiet hours, batching, and email digest settings
 *
 * Usage:
 *   node scripts/check-notification-preferences.js <email>
 *   node scripts/check-notification-preferences.js <email> --feature=flashcards_srs
 *
 * Examples:
 *   node scripts/check-notification-preferences.js beano@beano.com
 *   node scripts/check-notification-preferences.js beano@beano.com --feature=kana
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// All known feature reminder keys
const FEATURE_REMINDER_KEYS = [
  'kana',
  'kanji_mastery',
  'flashcards_srs',
  'news',
  'stories',
  'library',
  'vocabulary'
];

// Parse arguments
const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const featureArg = args.find(a => a.startsWith('--feature='));
const featureFilter = featureArg ? featureArg.split('=')[1] : null;

if (!email) {
  console.error('\n❌ Error: Missing email argument\n');
  console.log('Usage:');
  console.log('  node scripts/check-notification-preferences.js <email>');
  console.log('  node scripts/check-notification-preferences.js <email> --feature=flashcards_srs\n');
  console.log('Available features:');
  FEATURE_REMINDER_KEYS.forEach(key => console.log(`  - ${key}`));
  console.log('');
  process.exit(1);
}

async function getUserIdFromEmail(email) {
  console.log(`\n🔍 Looking up user by email: ${email}`);
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.uid}\n`);
    return userRecord.uid;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new Error(`User not found with email: ${email}`);
    }
    throw error;
  }
}

async function checkNotificationPreferences(userId) {
  console.log('===========================================');
  console.log('🔔 NOTIFICATION PREFERENCES');
  console.log('===========================================\n');
  console.log(`User ID: ${userId}\n`);

  try {
    const prefsDoc = await db.collection('notifications_preferences').doc(userId).get();

    if (!prefsDoc.exists) {
      console.log('ℹ️  No notification preferences found for this user.');
      console.log('   They are using default settings (all reminders enabled).\n');
      return;
    }

    const data = prefsDoc.data();

    // --- Channels ---
    console.log('📡 CHANNELS');
    console.log('-------------------------------------------');
    const channels = data.channels || {};
    const channelDefaults = { browser: false, inApp: true, push: false, email: false };
    Object.keys(channelDefaults).forEach(ch => {
      const value = channels[ch] !== undefined ? channels[ch] : channelDefaults[ch];
      const icon = value ? '✅' : '❌';
      const suffix = channels[ch] === undefined ? ' (default)' : '';
      console.log(`  ${icon} ${ch.padEnd(12)} ${value}${suffix}`);
    });
    console.log('');

    // --- Feature Reminders ---
    console.log('🎯 FEATURE REMINDERS');
    console.log('-------------------------------------------');
    const featureReminders = data.feature_reminders || {};
    const globalEnabled = featureReminders.enabled !== false;
    console.log(`  Global toggle: ${globalEnabled ? '✅ enabled' : '❌ disabled'}`);

    if (!globalEnabled) {
      console.log('  ⚠️  All feature reminders are disabled by global toggle\n');
    }

    const features = featureReminders.features || {};
    console.log('');

    const keysToShow = featureFilter
      ? FEATURE_REMINDER_KEYS.filter(k => k === featureFilter)
      : FEATURE_REMINDER_KEYS;

    if (featureFilter && keysToShow.length === 0) {
      console.log(`  ⚠️  Unknown feature: "${featureFilter}"`);
      console.log(`  Valid features: ${FEATURE_REMINDER_KEYS.join(', ')}\n`);
    } else {
      keysToShow.forEach(key => {
        const value = features[key] !== undefined ? features[key] : true;
        const isDefault = features[key] === undefined;
        const effectivelyEnabled = globalEnabled && value;
        const icon = effectivelyEnabled ? '✅' : '❌';
        const suffix = isDefault ? ' (default)' : '';
        const blocked = !globalEnabled && value ? ' [blocked by global toggle]' : '';
        console.log(`  ${icon} ${key.padEnd(20)} ${value}${suffix}${blocked}`);
      });
    }
    console.log('');

    // If filtering by a single feature, show detailed info and stop
    if (featureFilter && keysToShow.length > 0) {
      const key = keysToShow[0];
      const value = features[key] !== undefined ? features[key] : true;
      const effectivelyEnabled = globalEnabled && value;
      console.log('📋 SUMMARY');
      console.log('-------------------------------------------');
      console.log(`  Feature "${key}" reminders are ${effectivelyEnabled ? 'ACTIVE' : 'INACTIVE'}`);
      if (!effectivelyEnabled) {
        if (!globalEnabled) console.log('  Reason: Global feature reminders toggle is OFF');
        else if (!value) console.log('  Reason: Feature-specific toggle is OFF');
      }
      console.log('');
      return;
    }

    // --- Timing ---
    if (data.timing) {
      console.log('⏰ TIMING');
      console.log('-------------------------------------------');
      const timing = data.timing;
      console.log(`  Immediate:  ${timing.immediate !== false ? '✅' : '❌'}`);
      console.log(`  Daily:      ${timing.daily !== false ? '✅' : '❌'}`);
      console.log(`  Overdue:    ${timing.overdue !== false ? '✅' : '❌'}`);
      console.log('');
    }

    // --- Quiet Hours ---
    if (data.quiet_hours) {
      console.log('🌙 QUIET HOURS');
      console.log('-------------------------------------------');
      const qh = data.quiet_hours;
      console.log(`  Enabled:  ${qh.enabled ? '✅' : '❌'}`);
      if (qh.enabled) {
        console.log(`  Start:    ${qh.start || 'N/A'}`);
        console.log(`  End:      ${qh.end || 'N/A'}`);
        console.log(`  Timezone: ${qh.timezone || 'N/A'}`);
      }
      console.log('');
    }

    // --- Email Digest ---
    if (data.email) {
      console.log('📧 EMAIL DIGEST');
      console.log('-------------------------------------------');
      const emailPrefs = data.email;
      console.log(`  Frequency: ${emailPrefs.frequency || 'N/A'}`);
      if (emailPrefs.day) console.log(`  Day:       ${emailPrefs.day}`);
      console.log('');
    }

    // --- Metadata ---
    console.log('📊 METADATA');
    console.log('-------------------------------------------');
    if (data.created_at) console.log(`  Created:  ${data.created_at.toDate ? data.created_at.toDate().toISOString() : data.created_at}`);
    if (data.updated_at) console.log(`  Updated:  ${data.updated_at.toDate ? data.updated_at.toDate().toISOString() : data.updated_at}`);
    if (data.push_enabled !== undefined) console.log(`  Push registered: ${data.push_enabled ? '✅' : '❌'}`);

    console.log('\n===========================================\n');

  } catch (error) {
    console.error('❌ Error checking notification preferences:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

async function main() {
  const userId = await getUserIdFromEmail(email);
  await checkNotificationPreferences(userId);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
