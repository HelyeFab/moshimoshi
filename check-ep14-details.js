const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDetails() {
  const drafts = await db.collection('comic_drafts')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  
  if (!drafts.empty) {
    const draft = drafts.docs[0].data();
    
    console.log('\n📋 Episode 14 Draft Details:\n');
    console.log('All fields:', Object.keys(draft).sort());
    
    // Check for any error fields
    const errorFields = Object.keys(draft).filter(k => k.toLowerCase().includes('error'));
    if (errorFields.length > 0) {
      console.log('\n⚠️  Error fields found:');
      errorFields.forEach(field => {
        console.log(`  ${field}:`, draft[field]);
      });
    }
    
    // Check panel text for word extraction
    let totalText = '';
    if (draft.panels) {
      draft.panels.forEach((panel, idx) => {
        const dialogueText = panel.dialogues?.map(d => d.textJa || '').join(' ') || '';
        const narrationText = panel.narration?.textJa || '';
        totalText += `${dialogueText} ${narrationText} `;
      });
    }
    console.log('\nTotal Japanese text length:', totalText.trim().length, 'characters');
    console.log('Text preview:', totalText.trim().substring(0, 150) + '...');
    
    // Check if word explanations were generated
    const episodeId = 'moshi-goes-to-japan-ep014';
    const wordDoc = await db.collection('word_explanations').doc(episodeId).get();
    
    console.log('\n📚 Word Explanations:');
    if (wordDoc.exists) {
      const wordData = wordDoc.data();
      console.log('✅ Word explanations EXIST');
      console.log('   Words:', wordData.words ? wordData.words.length : 0);
      console.log('   Generated:', wordData.generatedAt ? wordData.generatedAt.toDate() : 'unknown');
    } else {
      console.log('❌ Word explanations NOT FOUND');
      console.log('   Expected ID:', episodeId);
    }
  }
  
  process.exit(0);
}

checkDetails();
