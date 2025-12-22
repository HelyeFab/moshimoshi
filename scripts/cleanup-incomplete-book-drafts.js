/**
 * Clean up incomplete book drafts
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function cleanupIncompleteDrafts() {
  console.log('🗑️  Cleaning up incomplete book drafts\n');

  // These drafts are stuck in generating status
  const incompleteDrafts = [
    'hAMYiYeqRQoMryr7uT4s', // stuck at 72% in audio step
    'zDgOhQsXnCIyegMvlMFB', // stuck at 81% in words step
    '3NkuazzPWJPlM5e3nTdv', // stuck at 86% in words step
  ];

  console.log('Deleting incomplete drafts:');

  for (const draftId of incompleteDrafts) {
    try {
      const draftDoc = await db.collection('book_drafts').doc(draftId).get();

      if (draftDoc.exists) {
        const draft = draftDoc.data();
        console.log(`\n  Deleting ${draftId}...`);
        console.log(`    Book: ${draft.bookName}`);
        console.log(`    Status: ${draft.status}`);
        console.log(`    Progress: ${draft.metadata?.progress}%`);
        console.log(`    Step: ${draft.metadata?.generationStep}`);

        await db.collection('book_drafts').doc(draftId).delete();
        console.log(`    ✓ Deleted`);
      } else {
        console.log(`\n  ⚠️  ${draftId} not found (already deleted?)`);
      }
    } catch (error) {
      console.error(`\n  ✗ Error deleting ${draftId}:`, error.message);
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log('✅ Cleanup complete!');
  console.log(`Deleted ${incompleteDrafts.length} incomplete drafts`);
  console.log('\nRemaining drafts:');
  console.log('  - eqX6J0aL2Ww6xuEBiRrL (published)');
  console.log('  - ZBcujYHsJUAu7HpkSSrl (complete, not published yet)');

  process.exit(0);
}

cleanupIncompleteDrafts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
