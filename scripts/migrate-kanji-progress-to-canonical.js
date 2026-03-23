#!/usr/bin/env node

const {
  admin,
  describeTarget,
  formatTimestamp,
  getCanonicalKanjiProgressRef,
  getLegacyKanjiProgressRef,
  initAdmin,
  parseArgs,
  resolveUserId,
} = require('./lib/kanji-progress-admin');

function toIso(value) {
  return formatTimestamp(value);
}

function pickNewerItem(canonicalItem, legacyItem) {
  if (!canonicalItem) return legacyItem;
  if (!legacyItem) return canonicalItem;

  const canonicalUpdatedAt = toIso(canonicalItem.updatedAt) || toIso(canonicalItem.lastViewedAt);
  const legacyUpdatedAt = toIso(legacyItem.updatedAt) || toIso(legacyItem.lastViewedAt);

  if (!canonicalUpdatedAt && !legacyUpdatedAt) {
    return canonicalItem;
  }

  if (!canonicalUpdatedAt) return legacyItem;
  if (!legacyUpdatedAt) return canonicalItem;

  return legacyUpdatedAt > canonicalUpdatedAt ? legacyItem : canonicalItem;
}

async function main() {
  const { options } = parseArgs(process.argv.slice(2));
  const shouldApply = options.apply;
  initAdmin(options.serviceAccount);
  const db = admin.firestore();

  console.log('🔍 Finding user...');
  const userId = await resolveUserId(options);
  console.log(`✅ Target user: ${describeTarget(options, userId)}`);

  const legacyRef = getLegacyKanjiProgressRef(db, userId);
  const canonicalRef = getCanonicalKanjiProgressRef(db, userId);

  console.log(`\n📖 Legacy path: progress/${userId}_kanji`);
  console.log(`📖 Canonical path: users/${userId}/progress/kanji`);

  const [legacyDoc, canonicalDoc] = await Promise.all([legacyRef.get(), canonicalRef.get()]);

  const legacyItems = legacyDoc.exists ? legacyDoc.data().items || {} : {};
  const canonicalItems = canonicalDoc.exists ? canonicalDoc.data().items || {} : {};

  console.log(`\n📊 Legacy items: ${Object.keys(legacyItems).length}`);
  console.log(`📊 Canonical items: ${Object.keys(canonicalItems).length}`);

  const mergedItems = { ...canonicalItems };
  let adoptedFromLegacy = 0;
  let keptCanonical = 0;

  for (const [kanji, legacyItem] of Object.entries(legacyItems)) {
    const canonicalItem = canonicalItems[kanji];
    const chosen = pickNewerItem(canonicalItem, legacyItem);
    mergedItems[kanji] = chosen;

    if (!canonicalItem || chosen === legacyItem) {
      adoptedFromLegacy++;
    } else {
      keptCanonical++;
    }
  }

  console.log(`\n🧪 Dry run: ${shouldApply ? 'NO' : 'YES'}`);
  console.log(`   - Total merged items: ${Object.keys(mergedItems).length}`);
  console.log(`   - Adopted from legacy: ${adoptedFromLegacy}`);
  console.log(`   - Kept canonical version: ${keptCanonical}`);

  if (!shouldApply) {
    console.log('\nℹ️ No writes performed. Re-run with --apply to update the canonical document.');
    return;
  }

  await canonicalRef.set(
    {
      userId,
      contentType: 'kanji',
      items: mergedItems,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log('\n✅ Canonical document updated');
  console.log('\nℹ️ Legacy document was left untouched for audit/recovery.');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
