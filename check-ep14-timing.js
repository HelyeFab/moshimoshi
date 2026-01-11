const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkTiming() {
  const drafts = await db.collection('comic_drafts')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  
  if (!drafts.empty) {
    const draft = drafts.docs[0].data();
    
    const created = draft.createdAt.toDate();
    const updated = draft.updatedAt.toDate();
    
    const elapsed = (updated - created) / 1000; // seconds
    
    console.log('\n⏱️  Episode 14 Timing:\n');
    console.log('Created:', created.toISOString());
    console.log('Updated:', updated.toISOString());
    console.log('Elapsed:', elapsed.toFixed(1), 'seconds');
    console.log('Cloud Function timeout:', 540, 'seconds');
    console.log('\nTime remaining when audio completed:', (540 - elapsed).toFixed(1), 'seconds');
    console.log('Minimum required for word gen:', 120, 'seconds (2min buffer)');
    
    if (540 - elapsed < 120) {
      console.log('\n⚠️  INSUFFICIENT TIME - Word explanations would be SKIPPED');
    } else {
      console.log('\n✓ Sufficient time - Word explanations should have run');
      console.log('   Max allowed time for word gen:', (540 - elapsed - 30).toFixed(1), 'seconds');
    }
  }
  
  process.exit(0);
}

checkTiming();
