#!/usr/bin/env node

/**
 * Fix XP Migration Script
 * Recovers XP that wasn't migrated to user_stats
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixXPMigration(userId) {
  console.log('\n=====================================');
  console.log(`🔧 Fixing XP for User: ${userId}`);
  console.log('=====================================\n');

  try {
    // 1. Get XP from old location
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log('❌ User document not found');
      return false;
    }

    const userData = userDoc.data();
    const oldProgress = userData.progress || {};

    console.log('📊 Found in old location:');
    console.log(`  - Total XP: ${oldProgress.totalXp || 0}`);
    console.log(`  - Level: ${oldProgress.currentLevel || 1}`);
    console.log(`  - Last XP Gain: ${oldProgress.lastXpGain || 0}`);

    // 2. Get current user_stats
    const statsDoc = await db.collection('user_stats').doc(userId).get();

    if (!statsDoc.exists) {
      console.log('❌ user_stats document not found - creating new one');
      // Would create new doc here if needed
      return false;
    }

    const currentStats = statsDoc.data();
    console.log('\n📊 Current user_stats:');
    console.log(`  - Total XP: ${currentStats.xp?.total || 0}`);
    console.log(`  - Level: ${currentStats.xp?.level || 1}`);

    // 3. Update with correct XP if needed
    if ((oldProgress.totalXp || 0) > (currentStats.xp?.total || 0)) {
      console.log('\n✅ Updating user_stats with recovered XP...');

      await db.collection('user_stats').doc(userId).update({
        'xp.total': oldProgress.totalXp || 0,
        'xp.level': oldProgress.currentLevel || 1,
        'xp.lastXpGain': oldProgress.lastXpGain || 0,
        'metadata.lastUpdated': new Date().toISOString(),
        'metadata.migrationHistory': admin.firestore.FieldValue.arrayUnion(
          `xp_recovery_${new Date().toISOString()}`
        )
      });

      console.log(`✅ Successfully recovered ${oldProgress.totalXp} XP!`);

      // 4. Verify the update
      const updatedStats = await db.collection('user_stats').doc(userId).get();
      const newXP = updatedStats.data().xp;
      console.log('\n📊 Verified update:');
      console.log(`  - Total XP: ${newXP.total}`);
      console.log(`  - Level: ${newXP.level}`);
    } else {
      console.log('\n✅ XP is already up to date or higher in user_stats');
    }

    return true;

  } catch (error) {
    console.error('\n❌ Error fixing XP:', error);
    return false;
  }
}

// Run the fix
const userId = process.argv[2] || 'r7r6at83BUPIjD69XatI4EGIECr1';
fixXPMigration(userId)
  .then(success => {
    if (success) {
      console.log('\n🎉 XP recovery complete!');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });