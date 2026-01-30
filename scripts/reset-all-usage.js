#!/usr/bin/env node

/**
 * Reset All Usage Script
 *
 * Resets ALL usage counts for a user (by email)
 *
 * Usage:
 *   node scripts/reset-all-usage.js <email>
 *
 * Example:
 *   node scripts/reset-all-usage.js beano@beano.com
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

// Get email argument
const email = process.argv[2];

if (!email) {
  console.error('\n❌ Error: Missing email argument\n');
  console.log('Usage:');
  console.log('  node scripts/reset-all-usage.js <email>\n');
  console.log('Example:');
  console.log('  node scripts/reset-all-usage.js beano@beano.com\n');
  process.exit(1);
}

async function resetAllUsage(email) {
  console.log('\n===========================================');
  console.log('🔄 RESET ALL USER USAGE');
  console.log('===========================================\n');
  console.log(`Email: ${email}\n`);

  try {
    // Get user ID from email
    console.log('Looking up user...');
    const userRecord = await admin.auth().getUserByEmail(email);
    const userId = userRecord.uid;
    console.log(`✅ Found user ID: ${userId}\n`);

    // Get all usage documents
    console.log('Fetching all usage documents...');
    const usageSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('usage')
      .get();

    if (usageSnapshot.empty) {
      console.log('ℹ️  No usage documents found. Nothing to reset.\n');
      console.log('===========================================');
      console.log('✅ Complete!\n');
      return;
    }

    console.log(`Found ${usageSnapshot.size} usage document(s)\n`);

    // Process each document
    let resetCount = 0;
    for (const doc of usageSnapshot.docs) {
      const docId = doc.id;
      const data = doc.data();

      console.log(`📄 Document: ${docId}`);

      // Build update object - reset all numeric fields to 0
      const updateData = { updatedAt: new Date().toISOString() };
      const fieldsReset = [];

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number' && key !== 'updatedAt') {
          updateData[key] = 0;
          fieldsReset.push(`${key}: ${value} → 0`);
        }
      }

      // Delete array fields (like kanji_mood_board_boards)
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          updateData[key] = admin.firestore.FieldValue.delete();
          fieldsReset.push(`${key}: [deleted array]`);
        }
      }

      if (fieldsReset.length > 0) {
        await db
          .collection('users')
          .doc(userId)
          .collection('usage')
          .doc(docId)
          .update(updateData);

        console.log(`   ✅ Reset ${fieldsReset.length} field(s):`);
        fieldsReset.forEach(f => console.log(`      - ${f}`));
        resetCount++;
      } else {
        console.log(`   ℹ️  No fields to reset`);
      }
      console.log('');
    }

    console.log('===========================================');
    console.log(`✅ Reset complete! Updated ${resetCount} document(s)\n`);

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ Error: No user found with email: ${email}\n`);
    } else {
      console.error('❌ Error resetting usage:', error);
    }
    throw error;
  } finally {
    await admin.app().delete();
  }
}

resetAllUsage(email).catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
