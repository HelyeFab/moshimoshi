const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, '../moshimoshi-service-account.json'), 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDraft() {
  const draftId = 'draft_1769299765109_scheduler-system';
  const doc = await db.collection('ai_story_drafts').doc(draftId).get();

  if (!doc.exists) {
    console.log('Draft not found');
    return;
  }

  const data = doc.data();
  console.log('=== DRAFT STATUS ===');
  console.log('Status:', data.status);
  console.log('Theme:', data.theme);
  console.log('JLPT Level:', data.jlptLevel);
  console.log('Page Count:', data.pageCount);
  console.log('');
  console.log('=== CHECKPOINT ===');
  console.log(JSON.stringify(data.checkpoint, null, 2));
  console.log('');
  console.log('=== PAGES ===');
  if (data.pages && Array.isArray(data.pages)) {
    data.pages.forEach((page, idx) => {
      console.log(`\nPage ${idx + 1}:`);
      console.log('  - text:', page.text ? page.text.substring(0, 80) + '...' : 'MISSING');
      console.log('  - textWithFurigana:', page.textWithFurigana ? 'Present (' + page.textWithFurigana.length + ' chars)' : 'MISSING');
      console.log('  - translation:', page.translation || 'MISSING');
      console.log('  - textEn:', page.textEn || 'MISSING');
      console.log('  - imagePrompt:', page.imagePrompt ? 'Present' : 'MISSING');
      console.log('  - imageUrl:', page.imageUrl || 'MISSING');
      console.log('  - audioUrl:', page.audioUrl || 'MISSING');
    });
  } else {
    console.log('No pages found');
  }
  console.log('');
  console.log('=== METADATA ===');
  console.log(JSON.stringify(data.metadata, null, 2));
}

checkDraft().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
