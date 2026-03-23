#!/usr/bin/env node

const {
  admin,
  describeTarget,
  getCanonicalKanjiProgressRef,
  initAdmin,
  parseArgs,
  resolveUserId,
} = require('./lib/kanji-progress-admin');

async function main() {
  const { options } = parseArgs(process.argv.slice(2));
  initAdmin(options.serviceAccount);

  const db = admin.firestore();
  const userId = await resolveUserId(options);
  const docRef = getCanonicalKanjiProgressRef(db, userId);

  console.log(`🔧 Backfilling canonical kanji progress metadata for ${describeTarget(options, userId)}`);
  console.log(`📍 Target document: users/${userId}/progress/kanji`);

  await docRef.set(
    {
      userId,
      contentType: 'kanji',
    },
    { merge: true }
  );

  console.log('✅ Metadata updated');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
