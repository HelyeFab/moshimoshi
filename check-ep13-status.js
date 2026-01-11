const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkEp13() {
  console.log('\n📊 Episode 13 Status:\n');

  // Check published
  const published = await db.collection('comics')
    .where('episodeNumber', '==', 13)
    .get();

  if (!published.empty) {
    const data = published.docs[0].data();
    console.log('✅ PUBLISHED!');
    console.log('  Title:', data.title);
    console.log('  Created:', data.createdAt ? data.createdAt.toDate() : 'unknown');
    console.log('  Published:', data.publishedAt ? data.publishedAt.toDate() : 'unknown');
    console.log('  Images:', data.panels ? data.panels.filter(p => p.imageUrl).length : 0);
    process.exit(0);
  }

  console.log('⏳ Not published yet');

  // Check drafts
  const drafts = await db.collection('comic_drafts')
    .where('episodeNumber', '==', 13)
    .get();

  if (!drafts.empty) {
    const data = drafts.docs[0].data();
    console.log('\n📝 Draft found:');
    console.log('  ID:', drafts.docs[0].id);
    console.log('  Status:', data.status);
    console.log('  Step:', data.currentStep);
    console.log('  Progress:', data.progress);
    console.log('  Created:', data.createdAt ? data.createdAt.toDate() : 'unknown');
    console.log('  Panels:', data.panels ? data.panels.length : 0);
    console.log('  Images:', data.panels ? data.panels.filter(p => p.imageUrl).length : 0);
  } else {
    console.log('📝 No draft found');
  }

  // Check latest drafts
  console.log('\n📋 Latest drafts:');
  const latestDrafts = await db.collection('comic_drafts')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();

  if (!latestDrafts.empty) {
    latestDrafts.forEach(doc => {
      const data = doc.data();
      console.log(`  Ep ${data.episodeNumber}: ${data.status} - ${data.currentStep} (${data.progress}%)`);
    });
  }

  process.exit(0);
}

checkEp13();
