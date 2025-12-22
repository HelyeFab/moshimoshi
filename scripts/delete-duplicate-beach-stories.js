/**
 * Delete duplicate beach stories, keeping only the newest complete one
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function deleteDuplicates() {
  console.log('🗑️  Deleting Duplicate Beach Stories');
  console.log('═'.repeat(80));
  console.log();

  // Keep this one (newest & complete)
  const keepId = 'story_1766402709491_scheduler-system';

  // Delete these
  const deleteIds = [
    'story_1766401126672_scheduler-system',
    'story_1766400669157_scheduler-system',
    'story_1766399089965_scheduler-system',
    'story_1766396144811_scheduler-system',
  ];

  console.log('KEEPING:');
  console.log(`  ✓ ${keepId}`);
  console.log();
  console.log('DELETING:');

  for (const storyId of deleteIds) {
    try {
      const storyDoc = await db.collection('stories').doc(storyId).get();
      if (storyDoc.exists) {
        const story = storyDoc.data();
        console.log(`  Deleting ${storyId}...`);
        console.log(`    Title: ${story.titleJa || story.title}`);
        console.log(`    Character: ${story.characterSheet?.mainCharacter?.name}`);

        await db.collection('stories').doc(storyId).delete();
        console.log(`    ✓ Deleted`);
      } else {
        console.log(`  ⚠️  ${storyId} not found (already deleted?)`);
      }
    } catch (error) {
      console.error(`  ✗ Error deleting ${storyId}:`, error.message);
    }
    console.log();
  }

  console.log('═'.repeat(80));
  console.log('✅ Cleanup complete!');
  console.log(`Kept: ${keepId}`);
  console.log(`Deleted: ${deleteIds.length} duplicates`);

  process.exit(0);
}

deleteDuplicates().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
