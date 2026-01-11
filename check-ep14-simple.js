const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkEp14() {
  console.log('\n📊 Episode 14 Status:\n');
  
  // Check latest drafts (no compound query)
  const drafts = await db.collection('comic_drafts')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();
  
  console.log('=== Latest Comic Drafts ===');
  if (!drafts.empty) {
    drafts.forEach(doc => {
      const draft = doc.data();
      if (draft.episodeNumber === 14) {
        console.log('\n✅ FOUND Episode 14 Draft!');
        console.log('Draft ID:', doc.id);
        console.log('Status:', draft.status);
        console.log('Current Step:', draft.currentStep);
        console.log('Progress:', draft.progress + '%');
        console.log('Created:', draft.createdAt ? draft.createdAt.toDate() : 'unknown');
        console.log('Theme:', draft.theme);
        console.log('Panels:', draft.panels ? draft.panels.length : 0);
        console.log('Audio Status:', draft.audioStatus || 'not set');
      } else {
        console.log(`Episode ${draft.episodeNumber}: ${draft.status} - ${draft.currentStep} (${draft.progress}%)`);
      }
    });
  }
  
  // Check if published
  const published = await db.collection('comics')
    .where('episodeNumber', '==', 14)
    .get();
  
  console.log('\n=== Published Status ===');
  if (!published.empty) {
    console.log('✅ Episode 14 PUBLISHED');
    const data = published.docs[0].data();
    console.log('Title:', data.title);
  } else {
    console.log('❌ Episode 14 not published');
  }
  
  process.exit(0);
}

checkEp14();
