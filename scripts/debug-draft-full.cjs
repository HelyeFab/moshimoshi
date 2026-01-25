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

  // Show full outline
  console.log('=== OUTLINE ===');
  if (data.outline) {
    console.log('Title:', data.outline.title);
    console.log('TitleJa:', data.outline.titleJa);
    console.log('Pages in outline:', data.outline.pages?.length || 0);
    if (data.outline.pages) {
      data.outline.pages.forEach((p, idx) => {
        console.log(`  Outline Page ${idx + 1}:`);
        console.log('    - summary:', p.summary?.substring(0, 60) + '...');
        console.log('    - keyVocabulary:', p.keyVocabulary?.slice(0, 3).join(', '));
      });
    }
  } else {
    console.log('No outline found');
  }

  console.log('');
  console.log('=== FULL PAGE DATA (Page 1) ===');
  if (data.pages && data.pages[0]) {
    const page1 = data.pages[0];
    console.log(JSON.stringify(page1, null, 2));
  }

  console.log('');
  console.log('=== PAGE KEYS ===');
  if (data.pages && data.pages[0]) {
    console.log('Keys in page object:', Object.keys(data.pages[0]));
  }
}

checkDraft().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
