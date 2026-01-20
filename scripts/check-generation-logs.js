const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkLogs() {
  const storyId = 'story_1768694424281_scheduler-system';
  
  // Check story_generation_logs
  const logsSnapshot = await db.collection('story_generation_logs')
    .where('storyId', '==', storyId)
    .limit(1)
    .get();
  
  if (!logsSnapshot.empty) {
    console.log('=== STORY GENERATION LOG ===\n');
    logsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('Log ID:', doc.id);
      console.log('Status:', data.status);
      console.log('Steps Completed:', data.stepsCompleted);
      console.log('Errors:', data.errors || 'None');
      console.log('Duration:', data.duration);
      console.log('\nFull Data:', JSON.stringify(data, null, 2));
    });
  } else {
    console.log('No generation logs found');
  }
  
  // Check the draft
  const draftId = storyId.replace('story_', 'draft_');
  const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
  
  if (draftDoc.exists) {
    const draftData = draftDoc.data();
    console.log('\n=== DRAFT DATA ===\n');
    console.log('Status:', draftData.status);
    console.log('Page Count:', draftData.pages?.length || 0);
    if (draftData.pages && draftData.pages.length >= 3) {
      const page3 = draftData.pages[2];
      console.log('\nDRAFT Page 3 fields:', Object.keys(page3).join(', '));
      console.log('Has textWithFurigana:', 'textWithFurigana' in page3);
    }
  } else {
    console.log('\n=== NO DRAFT FOUND ===');
    console.log('Draft ID:', draftId);
  }
}

checkLogs().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
