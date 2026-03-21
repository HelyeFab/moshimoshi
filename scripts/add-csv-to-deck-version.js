#!/usr/bin/env node

/**
 * Add CSV download to an existing DeckMarket deck version.
 *
 * Uploads the CSV to R2 and patches the Firestore version document
 * with csvR2Key, csvFilename, csvSizeBytes.
 *
 * Usage:
 *   node scripts/add-csv-to-deck-version.js <deckId> <csvPath>
 *
 * Example:
 *   node scripts/add-csv-to-deck-version.js japaneseadjectives100audio ~/Documents/.../Japanese_Adjectives_100_MasterDeck.csv
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const admin = require('firebase-admin');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function main() {
  const [, , deckId, csvPath] = process.argv;

  if (!deckId || !csvPath) {
    console.error('Usage: node scripts/add-csv-to-deck-version.js <deckId> <csvPath>');
    process.exit(1);
  }

  const resolvedCsvPath = path.resolve(csvPath);
  if (!fs.existsSync(resolvedCsvPath)) {
    console.error(`CSV file not found: ${resolvedCsvPath}`);
    process.exit(1);
  }

  // 1. Get deck and latest version
  const deckRef = db.collection('deckmarket_decks').doc(deckId);
  const deckDoc = await deckRef.get();

  if (!deckDoc.exists) {
    console.error(`Deck not found: ${deckId}`);
    process.exit(1);
  }

  const deckData = deckDoc.data();
  const versionId = deckData.latestVersionId;

  if (!versionId) {
    console.error('Deck has no latestVersionId');
    process.exit(1);
  }

  const versionRef = deckRef.collection('versions').doc(versionId);
  const versionDoc = await versionRef.get();

  if (!versionDoc.exists) {
    console.error(`Version not found: ${versionId}`);
    process.exit(1);
  }

  const versionData = versionDoc.data();
  if (versionData.csvR2Key) {
    console.log(`Version already has CSV: ${versionData.csvR2Key}`);
    console.log('Nothing to do.');
    process.exit(0);
  }

  // 2. Read CSV
  const csvBuffer = fs.readFileSync(resolvedCsvPath);
  const csvFilename = path.basename(resolvedCsvPath).replace(/[^a-zA-Z0-9._-]/g, '');
  const csvSizeBytes = csvBuffer.length;

  console.log(`Deck: ${deckData.title} (${deckId})`);
  console.log(`Version: ${versionData.versionLabel || versionId}`);
  console.log(`CSV: ${csvFilename} (${(csvSizeBytes / 1024).toFixed(1)} KB)`);

  // 3. Upload CSV to R2
  const csvR2Key = `deckmarket/${deckId}/${versionId}/${csvFilename}`;
  console.log(`Uploading to R2: ${csvR2Key}`);

  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET || 'moshmoshi-anki';

  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: csvR2Key,
    Body: csvBuffer,
    ContentType: 'text/csv',
  }));

  console.log('R2 upload complete.');

  // 4. Update Firestore version doc
  await versionRef.update({
    csvR2Key,
    csvFilename,
    csvSizeBytes,
  });

  console.log('Firestore updated.');
  console.log('\nDone! CSV download is now available for this deck.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
