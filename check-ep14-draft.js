const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkEp14() {
  console.log('\n📊 Episode 14 Draft Status:\n');
  
  // Check for Episode 14 draft
  const drafts = await db.collection('comic_drafts')
    .where('episodeNumber', '==', 14)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  
  if (!drafts.empty) {
    const draft = drafts.docs[0].data();
    console.log('Draft ID:', drafts.docs[0].id);
    console.log('Status:', draft.status);
    console.log('Current Step:', draft.currentStep);
    console.log('Progress:', draft.progress + '%');
    console.log('Created:', draft.createdAt ? draft.createdAt.toDate() : 'unknown');
    console.log('Updated:', draft.updatedAt ? draft.updatedAt.toDate() : 'unknown');
    console.log('Theme:', draft.theme);
    console.log('Location:', draft.location);
    
    console.log('\nPanels:', draft.panels ? draft.panels.length : 0);
    if (draft.panels) {
      let imagesCount = 0;
      draft.panels.forEach((p, idx) => {
        if (p.imageUrl) imagesCount++;
      });
      console.log('Images generated:', imagesCount + '/' + draft.panels.length);
    }
    
    console.log('\nAudio Status:', draft.audioStatus || 'not set');
    console.log('Full Audio URL:', draft.fullAudioUrl ? 'YES' : 'NO');
    
    if (draft.dialogueError) {
      console.log('\n⚠️  Dialogue Error:', draft.dialogueError);
    }
    
  } else {
    console.log('❌ No Episode 14 draft found');
  }
  
  // Check if Episode 14 was published
  const published = await db.collection('comics')
    .where('episodeNumber', '==', 14)
    .get();
  
  if (!published.empty) {
    console.log('\n✅ Episode 14 WAS PUBLISHED!');
    const data = published.docs[0].data();
    console.log('Title:', data.title);
    console.log('Published:', data.publishedAt ? data.publishedAt.toDate() : 'unknown');
  } else {
    console.log('\n❌ Episode 14 not published');
  }
  
  process.exit(0);
}

checkEp14();
