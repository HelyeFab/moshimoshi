/**
 * Check comic draft data
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkDraft(draftId) {
  console.log(`📋 Checking comic draft: ${draftId}\n`);

  const draftDoc = await db.collection('comic_drafts').doc(draftId).get();

  if (!draftDoc.exists) {
    console.error('❌ Draft not found');
    process.exit(1);
  }

  const draft = draftDoc.data();

  console.log('=== DRAFT DATA ===');
  console.log('Draft ID:', draftId);
  console.log('Status:', draft.status);
  console.log('JLPT Level:', draft.jlptLevel);
  console.log('');

  console.log('=== CULTURAL NOTES ===');
  console.log('Count:', draft.culturalNotes?.length || 0);
  if (draft.culturalNotes) {
    draft.culturalNotes.forEach((note, i) => {
      console.log(`  ${i + 1}. ${note.title || note.titleJa || 'Untitled'}`);
    });
  }
  console.log('');

  console.log('=== QUIZ ===');
  console.log('Count:', draft.quiz?.length || 0);
  if (draft.quiz) {
    draft.quiz.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q.question?.substring(0, 50)}...`);
    });
  }
  console.log('');

  console.log('=== VOCABULARY ===');
  console.log('Count:', draft.vocabulary?.length || 0);

  process.exit(0);
}

const draftId = process.argv[2] || 'comic_draft_1766415515580_6';
checkDraft(draftId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
