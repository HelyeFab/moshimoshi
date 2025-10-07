#!/usr/bin/env node

/**
 * Migration script to fix inflated watch times caused by cumulative time bug
 *
 * Bug: Client was sending cumulative time since session start instead of
 * time since last save, causing practice times to be counted multiple times.
 *
 * Fix Strategy:
 * 1. For each video, calculate realistic maximum practice time based on time span
 * 2. If totalPracticeTime exceeds time span, cap it to the time span
 * 3. Recalculate based on practiceCount and average session duration
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Estimate realistic practice time based on video data
function estimateRealisticPracticeTime(data) {
  const firstPracticed = data.firstPracticed?.toDate();
  const lastPracticed = data.lastPracticed?.toDate();
  const practiceCount = data.practiceCount || 0;
  const totalPracticeTime = data.totalPracticeTime || 0;

  // If no practice sessions, return 0
  if (practiceCount === 0 || !firstPracticed || !lastPracticed) {
    return 0;
  }

  // Calculate time span in seconds
  const timeSpanMs = lastPracticed - firstPracticed;
  const timeSpanSeconds = Math.floor(timeSpanMs / 1000);

  // If practice time is already reasonable (within time span), keep it
  if (totalPracticeTime <= timeSpanSeconds) {
    return totalPracticeTime;
  }

  // Otherwise, use time span as maximum possible practice time
  // This is conservative but more accurate than inflated values
  console.log(`  ⚠️  Inflated time detected: ${totalPracticeTime}s > ${timeSpanSeconds}s span`);
  console.log(`  → Capping to time span: ${timeSpanSeconds}s`);

  return timeSpanSeconds;
}

async function fixWatchTimesForUser(userId, dryRun = true) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Fixing watch times for user: ${userId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Get all YouTube practice history for user
    const snapshot = await db
      .collection('userPracticeHistory')
      .where('userId', '==', userId)
      .where('contentType', '==', 'youtube')
      .get();

    console.log(`Found ${snapshot.size} videos to process\n`);

    let totalOriginal = 0;
    let totalCorrected = 0;
    let videosFixed = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const videoId = data.videoId;
      const originalTime = data.totalPracticeTime || 0;
      const correctTime = estimateRealisticPracticeTime(data);

      totalOriginal += originalTime;
      totalCorrected += correctTime;

      const timeSaved = originalTime - correctTime;

      console.log(`${videoId}:`);
      console.log(`  Original time: ${originalTime}s (${Math.round(originalTime / 60)}m)`);
      console.log(`  Corrected time: ${correctTime}s (${Math.round(correctTime / 60)}m)`);
      console.log(`  Difference: ${timeSaved}s (${Math.round(timeSaved / 60)}m)`);

      if (timeSaved > 0) {
        videosFixed++;

        if (!dryRun) {
          // Update the document
          await doc.ref.update({
            totalPracticeTime: correctTime,
            _migrationNote: 'Fixed inflated practice time (2025-10-07)',
            _originalTotalPracticeTime: originalTime,
            updatedAt: admin.firestore.Timestamp.now()
          });
          console.log(`  ✅ Updated in database`);
        } else {
          console.log(`  [DRY RUN] Would update in database`);
        }
      } else {
        console.log(`  ✅ Already correct`);
      }
      console.log('');
    }

    // Also fix userYouTubeHistory (premium users)
    console.log(`\n${'─'.repeat(80)}`);
    console.log('Checking userYouTubeHistory (premium)...\n');

    const youtubeHistorySnapshot = await db
      .collection('userYouTubeHistory')
      .where('userId', '==', userId)
      .get();

    for (const doc of youtubeHistorySnapshot.docs) {
      const data = doc.data();
      const videoId = data.videoId;
      const originalTime = data.totalWatchTime || 0;

      // Find corresponding practice history
      const practiceDocId = `${userId}_${videoId}`;
      const practiceDoc = await db.collection('userPracticeHistory').doc(practiceDocId).get();

      if (practiceDoc.exists) {
        const practiceData = practiceDoc.data();
        const correctTime = dryRun ? estimateRealisticPracticeTime(practiceData) : practiceData.totalPracticeTime;

        if (originalTime !== correctTime) {
          console.log(`${videoId} (userYouTubeHistory):`);
          console.log(`  Original: ${originalTime}s → Corrected: ${correctTime}s`);

          if (!dryRun) {
            await doc.ref.update({
              totalWatchTime: correctTime,
              updatedAt: admin.firestore.Timestamp.now()
            });
            console.log(`  ✅ Updated`);
          } else {
            console.log(`  [DRY RUN] Would update`);
          }
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Total videos processed: ${snapshot.size}`);
    console.log(`Videos with inflated times: ${videosFixed}`);
    console.log(`Original total watch time: ${totalOriginal}s (${Math.round(totalOriginal / 60)}m = ${Math.round(totalOriginal / 3600)}h ${Math.round((totalOriginal % 3600) / 60)}m)`);
    console.log(`Corrected total watch time: ${totalCorrected}s (${Math.round(totalCorrected / 60)}m = ${Math.round(totalCorrected / 3600)}h ${Math.round((totalCorrected % 3600) / 60)}m)`);
    console.log(`Time inflation removed: ${totalOriginal - totalCorrected}s (${Math.round((totalOriginal - totalCorrected) / 60)}m)`);
    console.log(`Inflation factor: ${(totalOriginal / totalCorrected).toFixed(2)}x\n`);

    if (dryRun) {
      console.log(`🔍 This was a DRY RUN - no changes were made`);
      console.log(`   Run with --live flag to apply changes\n`);
    } else {
      console.log(`✅ Database updated successfully!\n`);
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Main execution
const userId = process.argv[2] || '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
const isLive = process.argv.includes('--live');

console.log('🔧 Watch Time Inflation Fix');
console.log('═'.repeat(80));

fixWatchTimesForUser(userId, !isLive)
  .then(() => {
    console.log('✅ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
