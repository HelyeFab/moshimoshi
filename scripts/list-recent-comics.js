/**
 * List recent comic episodes
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function listRecentComics() {
  console.log('📋 Recent comic episodes:\n');

  const comicsSnapshot = await db.collection('comics')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log(`Found ${comicsSnapshot.size} episodes\n`);

  comicsSnapshot.docs.forEach((doc, index) => {
    const comic = doc.data();
    console.log(`${index + 1}. ${doc.id}`);
    console.log(`   Title: ${comic.title} / ${comic.titleJa}`);
    console.log(`   Theme: ${comic.theme} @ ${comic.location}`);
    console.log(`   Status: ${comic.status}`);
    console.log(`   Created: ${comic.createdAt?.toDate?.() || 'unknown'}`);
    console.log('');
  });

  // Also check drafts
  console.log('\n📝 Recent drafts:\n');

  const draftsSnapshot = await db.collection('comic_drafts')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log(`Found ${draftsSnapshot.size} drafts\n`);

  draftsSnapshot.docs.forEach((doc, index) => {
    const draft = doc.data();
    console.log(`${index + 1}. ${doc.id}`);
    console.log(`   Theme: ${draft.theme} @ ${draft.location}`);
    console.log(`   Status: ${draft.status}`);
    console.log(`   Step: ${draft.currentStep}`);
    console.log(`   Created: ${draft.createdAt?.toDate?.() || 'unknown'}`);
    console.log('');
  });

  process.exit(0);
}

listRecentComics().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
