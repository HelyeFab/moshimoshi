/**
 * Import Koohii community mnemonics to Firebase
 *
 * Usage: node scripts/import-koohii-mnemonics.mjs [--dry-run] [--clear-first]
 *
 * Options:
 *   --dry-run      Preview what would be imported without writing to Firebase
 *   --clear-first  Clear existing mnemonics before importing
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env.local') });

// Parse args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CLEAR_FIRST = args.includes('--clear-first');

// Initialize Firebase
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, '../moshimoshi-service-account.json');

const app = initializeApp({
  credential: cert(serviceAccountPath)
});

const db = getFirestore(app);
const COLLECTION = 'kanji_mnemonics';

async function clearCollection() {
  console.log('Clearing existing mnemonics...');
  const snapshot = await db.collection(COLLECTION).get();

  if (snapshot.size === 0) {
    console.log('Collection is already empty');
    return;
  }

  console.log(`Found ${snapshot.size} documents to delete`);

  const batchSize = 500;
  let deleted = 0;

  while (deleted < snapshot.size) {
    const batch = db.batch();
    const docs = snapshot.docs.slice(deleted, deleted + batchSize);

    docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deleted += docs.length;
    console.log(`Deleted ${deleted}/${snapshot.size} documents`);
  }

  console.log('✓ Collection cleared');
}

async function importMnemonics() {
  // Read the parsed Koohii mnemonics (with components if available)
  let mnemonicsPath = '/tmp/koohii-mnemonics-final-with-components.json';

  if (!fs.existsSync(mnemonicsPath)) {
    mnemonicsPath = '/tmp/koohii-mnemonics.json';
  }

  if (!fs.existsSync(mnemonicsPath)) {
    console.error('❌ Koohii mnemonics file not found');
    console.error('Run: node /tmp/parse-koohii-stories.mjs first');
    process.exit(1);
  }

  console.log(`Using: ${mnemonicsPath}`);

  const mnemonics = JSON.parse(fs.readFileSync(mnemonicsPath, 'utf-8'));
  console.log(`\n📚 Loaded ${mnemonics.length} mnemonics from Koohii`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would import:');
    console.log(`- ${mnemonics.length} kanji mnemonics`);
    console.log('\nSample entries:');

    for (const m of mnemonics.slice(0, 5)) {
      console.log(`\n${m.kanji} (${m.keyword}):`);
      console.log(`  Mnemonic: ${m.mnemonic.substring(0, 80)}...`);
      console.log(`  Author: ${m.author}, Votes: ${m.votes}`);
    }

    return { imported: 0, total: mnemonics.length };
  }

  // Import in batches
  const batchSize = 500;
  let imported = 0;
  let errors = 0;

  console.log('\nImporting to Firebase...');

  for (let i = 0; i < mnemonics.length; i += batchSize) {
    const batch = db.batch();
    const chunk = mnemonics.slice(i, i + batchSize);

    for (const m of chunk) {
      const docRef = db.collection(COLLECTION).doc(m.kanji);

      const entry = {
        kanji: m.kanji,
        meaning: m.keyword,
        mnemonic: m.mnemonic,
        provider: 'koohii',
        version: 1,
        createdAt: Timestamp.now(),
        lastAccessedAt: Timestamp.now(),
        accessCount: 0,
        author: m.author,
        votes: m.votes
      };

      // Add components if available
      if (m.components && m.components.length > 0) {
        entry.components = m.components;
      }

      batch.set(docRef, entry);
    }

    try {
      await batch.commit();
      imported += chunk.length;
      console.log(`Progress: ${imported}/${mnemonics.length} (${Math.round(imported/mnemonics.length*100)}%)`);
    } catch (error) {
      console.error(`Error in batch starting at ${i}:`, error.message);
      errors += chunk.length;
    }
  }

  return { imported, errors, total: mnemonics.length };
}

async function main() {
  console.log('=== Koohii Mnemonics Importer ===\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Clear first: ${CLEAR_FIRST ? 'Yes' : 'No'}\n`);

  if (CLEAR_FIRST && !DRY_RUN) {
    await clearCollection();
  }

  const result = await importMnemonics();

  console.log('\n=== Summary ===');
  console.log(`Total mnemonics: ${result.total}`);
  console.log(`Imported: ${result.imported}`);
  if (result.errors) {
    console.log(`Errors: ${result.errors}`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Remove --dry-run to import.');
  } else {
    console.log('\n✓ Import complete!');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
