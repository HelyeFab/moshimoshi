/**
 * Fix dates field corruption in user_stats
 *
 * ISSUE: Some user_stats have fields like bestStreak, currentStreak, isActiveToday
 * nested INSIDE the dates map instead of at the streak object level.
 *
 * This script:
 * 1. Scans all user_stats documents
 * 2. Detects dates maps with non-date fields
 * 3. Cleans the dates map to only contain date entries (YYYY-MM-DD: true)
 * 4. Updates the corrupted documents
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanDatesMap(dates) {
  if (!dates || typeof dates !== 'object') {
    return {};
  }

  const cleanDates = {};
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  Object.entries(dates).forEach(([key, value]) => {
    // Only keep entries that are valid dates
    if (datePattern.test(key) && value === true) {
      cleanDates[key] = true;
    }
  });

  return cleanDates;
}

async function fixDatesCorruption() {
  console.log('🔍 Scanning user_stats for dates field corruption...\n');

  const snapshot = await db.collection('user_stats').get();
  console.log(`Found ${snapshot.size} user_stats documents\n`);

  let corruptedCount = 0;
  let fixedCount = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = doc.id;

    // Check if dates map exists
    if (!data.streak?.dates) {
      continue;
    }

    const dates = data.streak.dates;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    // Check for corruption: non-date fields inside dates map
    const nonDateFields = Object.keys(dates).filter(key => !datePattern.test(key));

    if (nonDateFields.length > 0) {
      corruptedCount++;
      console.log(`❌ CORRUPTED: ${data.email || userId}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Non-date fields in dates map: ${nonDateFields.join(', ')}`);

      // Clean the dates map
      const cleanedDates = await cleanDatesMap(dates);
      console.log(`   Cleaned: ${Object.keys(dates).length} fields → ${Object.keys(cleanedDates).length} valid dates`);

      // Update the document
      const docRef = db.collection('user_stats').doc(userId);
      batch.update(docRef, {
        'streak.dates': cleanedDates
      });

      batchCount++;
      fixedCount++;

      // Commit batch every 500 updates
      if (batchCount >= 500) {
        console.log(`\n💾 Committing batch of ${batchCount} updates...\n`);
        await batch.commit();
        batchCount = 0;
      }

      console.log('   ✅ Queued for fix\n');
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    console.log(`\n💾 Committing final batch of ${batchCount} updates...\n`);
    await batch.commit();
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total documents scanned: ${snapshot.size}`);
  console.log(`Corrupted documents found: ${corruptedCount}`);
  console.log(`Documents fixed: ${fixedCount}`);
  console.log('='.repeat(60) + '\n');

  if (fixedCount > 0) {
    console.log('✅ Dates field corruption has been fixed!');
    console.log('   All dates maps now only contain valid date entries (YYYY-MM-DD: true)\n');
  } else {
    console.log('✅ No corruption detected. All dates maps are clean!\n');
  }
}

// Run the fix
fixDatesCorruption()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
