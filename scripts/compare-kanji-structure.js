#!/usr/bin/env node

const {
  admin,
  describeTarget,
  getCanonicalKanjiProgressRef,
  initAdmin,
  parseArgs,
  resolveUserId,
} = require('./lib/kanji-progress-admin');

async function compareStructure() {
  const { options } = parseArgs(process.argv.slice(2));
  initAdmin(options.serviceAccount);
  const db = admin.firestore();
  const userId = await resolveUserId(options);

  console.log('📖 Reading Firebase document...\n');
  console.log(`Target: ${describeTarget(options, userId)}`);
  console.log(`Path: users/${userId}/progress/kanji\n`);
  const docRef = getCanonicalKanjiProgressRef(db, userId);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.log('❌ Document does not exist');
    process.exit(1);
  }

  const data = doc.data();
  const items = data.items || {};

  // The original 4 kanji that WERE showing
  const originalKanji = ['一', '中', '会', '人'];

  console.log('🔍 ORIGINAL KANJI (that were showing):');
  console.log('=====================================\n');

  originalKanji.forEach(kanji => {
    if (items[kanji]) {
      console.log(`${kanji}:`);
      console.log(JSON.stringify(items[kanji], null, 2));
      console.log('\n---\n');
    } else {
      console.log(`${kanji}: NOT FOUND\n`);
    }
  });

  // Sample of script-imported kanji
  const importedKanji = ['球', '約', '内', '理', '切'];

  console.log('\n🆕 SCRIPT-IMPORTED KANJI:');
  console.log('========================\n');

  importedKanji.forEach(kanji => {
    if (items[kanji]) {
      console.log(`${kanji}:`);
      console.log(JSON.stringify(items[kanji], null, 2));
      console.log('\n---\n');
    } else {
      console.log(`${kanji}: NOT FOUND\n`);
    }
  });

  // Compare field sets
  const originalFields = originalKanji
    .filter(k => items[k])
    .map(k => Object.keys(items[k]).sort());

  const importedFields = importedKanji
    .filter(k => items[k])
    .map(k => Object.keys(items[k]).sort());

  console.log('\n📊 FIELD COMPARISON:');
  console.log('===================\n');

  if (originalFields.length > 0) {
    console.log('Original kanji fields:', originalFields[0]);
  }

  if (importedFields.length > 0) {
    console.log('Imported kanji fields:', importedFields[0]);
  }

  // Check for differences
  if (originalFields.length > 0 && importedFields.length > 0) {
    const origSet = new Set(originalFields[0]);
    const impSet = new Set(importedFields[0]);

    const missingInImported = originalFields[0].filter(f => !impSet.has(f));
    const extraInImported = importedFields[0].filter(f => !origSet.has(f));

    console.log('\n⚠️  Missing in imported:', missingInImported.length > 0 ? missingInImported : 'None');
    console.log('✅ Extra in imported:', extraInImported.length > 0 ? extraInImported : 'None');
  }

  process.exit(0);
}

compareStructure().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
