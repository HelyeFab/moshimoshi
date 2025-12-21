/**
 * Check a specific draft document
 */
const admin = require('firebase-admin');
const sa = require('../moshimoshi-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function check() {
  // Check the specific draft from the failed test
  const draftId = process.argv[2] || 'draft_1766338413098_scheduler-system';

  console.log('=== Checking Draft:', draftId, '===\n');

  const doc = await db.collection('ai_story_drafts').doc(draftId).get();

  console.log('Draft exists:', doc.exists);
  if (doc.exists) {
    const d = doc.data();
    console.log('Status:', d.status);
    console.log('Theme:', d.theme);
    console.log('JLPT Level:', d.jlptLevel);
    console.log('Has checkpoint:', !!d.checkpoint);
    if (d.checkpoint) {
      console.log('  lastCompletedStep:', d.checkpoint.lastCompletedStep);
      console.log('  failedAttempts:', d.checkpoint.failedAttempts);
      console.log('  lastError:', d.checkpoint.lastError);
    }
    console.log('Has characterSheet:', !!d.characterSheet);
    console.log('Has pages:', d.pages ? d.pages.length : 0);
  }

  // Check all recent documents in ai_story_drafts
  console.log('\n=== All recent ai_story_drafts ===');
  const all = await db.collection('ai_story_drafts')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (all.empty) {
    console.log('No documents found in ai_story_drafts');
  } else {
    console.log(`Found ${all.size} documents:\n`);
    all.forEach(d => {
      const data = d.data();
      const created = data.createdAt ? data.createdAt.toDate().toISOString().substring(0, 16) : 'N/A';
      console.log(`${created} | ${d.id.substring(0, 40)} | ${data.status || 'unknown'}`);
    });
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
