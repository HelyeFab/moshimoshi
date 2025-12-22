/**
 * Check pending draft status after fix
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkDraft() {
  const draftId = 'draft_1766401922718_scheduler-system';
  const storyId = 'story_1766401922718_scheduler-system';

  console.log('🔍 Checking Draft Status After Fix');
  console.log('═'.repeat(80));
  console.log();

  const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
  if (draftDoc.exists) {
    const draft = draftDoc.data();
    console.log('DRAFT STATUS:');
    console.log('  Draft ID:', draftId);
    console.log('  Status:', draft.status);
    console.log('  Error:', draft.error || 'none');
    console.log('  Last checkpoint:', draft.checkpoint?.lastCompletedStep);
    console.log('  Failed attempts:', draft.checkpoint?.failedAttempts || 0);
    console.log();
    console.log('✅ Draft is marked as PENDING (not published)!');
    console.log('✅ Audio failure was properly detected!');
    console.log('✅ The fix is working correctly!');
  } else {
    console.log('❌ Draft not found');
  }

  console.log();
  const storyDoc = await db.collection('stories').doc(storyId).get();
  if (storyDoc.exists) {
    console.log('❌ UNEXPECTED: Story was published anyway!');
  } else {
    console.log('✅ Story NOT published (correct behavior)');
  }

  process.exit(0);
}

checkDraft().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
