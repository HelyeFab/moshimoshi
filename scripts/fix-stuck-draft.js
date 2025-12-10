const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixStuckDraft() {
  const draftId = '3ParyjutMp89XEFNsbPN'; // The stuck "Butter" draft

  console.log('Fixing stuck draft:', draftId);

  await db.collection('book_drafts').doc(draftId).update({
    status: 'draft',
    'metadata.generationStep': 'complete',
    'metadata.progress': 100,
  });

  console.log('✅ Draft fixed! Status set to "draft", progress to 100%');

  // Verify the fix
  const doc = await db.collection('book_drafts').doc(draftId).get();
  const data = doc.data();
  console.log('\nVerification:');
  console.log('Status:', data.status);
  console.log('Progress:', data.metadata?.progress);
  console.log('Step:', data.metadata?.generationStep);

  process.exit(0);
}

fixStuckDraft().catch(e => { console.error(e); process.exit(1); });
