#!/usr/bin/env node

const {
  admin,
  describeTarget,
  formatTimestamp,
  getCanonicalKanjiProgressRef,
  initAdmin,
  parseArgs,
  resolveUserId,
} = require('./lib/kanji-progress-admin');

async function verifyData() {
  const { options } = parseArgs(process.argv.slice(2));
  initAdmin(options.serviceAccount);
  const db = admin.firestore();

  console.log('🔍 Finding user...');
  const userId = await resolveUserId(options);
  console.log(`✅ Target user: ${describeTarget(options, userId)}`);

  console.log('\n📖 Reading Firebase document...');
  console.log(`   Path: users/${userId}/progress/kanji`);
  const docRef = getCanonicalKanjiProgressRef(db, userId);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.log('❌ Document does NOT exist!');
    return;
  }

  const data = doc.data();
  console.log('✅ Document exists');
  console.log('\n📊 Document structure:');
  console.log('   - userId:', data.userId);
  console.log('   - contentType:', data.contentType);
  console.log('   - items count:', data.items ? Object.keys(data.items).length : 0);
  console.log('   - lastUpdated:', formatTimestamp(data.lastUpdated));
  console.log('   - userId matches target:', data.userId === userId);

  if (data.items) {
    console.log('\n📝 Sample items (first 5):');
    const sampleKanji = Object.keys(data.items).slice(0, 5);
    sampleKanji.forEach(kanji => {
      const item = data.items[kanji];
      console.log(`   ${kanji}:`, {
        status: item.status,
        viewCount: item.viewCount,
        contentId: item.contentId,
        contentType: item.contentType,
      });
    });

    // Check for learned kanji
    const learnedKanji = Object.entries(data.items)
      .filter(([, item]) => item.status === 'learned')
      .map(([kanji]) => kanji);

    console.log(`\n✅ Learned kanji count: ${learnedKanji.length}`);
    console.log(`   First 10: ${learnedKanji.slice(0, 10).join(' ')}`);
  }

  process.exit(0);
}

verifyData().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
