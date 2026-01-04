/**
 * Verify comic panel image and download it for inspection
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function verifyImage(episodeId, panelNumber) {
  console.log(`🔍 Verifying panel ${panelNumber} for ${episodeId}\n`);

  // Get comic from Firestore
  const doc = await db.collection('comics').doc(episodeId).get();
  const comic = doc.data();
  const panel = comic.panels[panelNumber - 1];

  console.log('📋 Panel data from Firestore:');
  console.log('Image URL:', panel.imageUrl);
  console.log('Scene:', panel.sceneDescription);
  console.log('Characters:', panel.dialogues.map(d => d.characterName).join(', '));
  console.log('');

  // Download the image
  console.log('⬇️  Downloading image...');
  const response = await fetch(panel.imageUrl);

  if (!response.ok) {
    console.error('❌ Failed to download image:', response.status);
    process.exit(1);
  }

  const buffer = await response.buffer();
  const filename = `panel-${panelNumber}-verification.webp`;
  fs.writeFileSync(filename, buffer);

  console.log(`✅ Image downloaded to: ${filename}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
  console.log('');
  console.log('🖼️  Open this file to verify it shows Moshi AND Yuki (not two Moshi)');
}

const episodeId = process.argv[2] || 'moshi-goes-to-japan-ep008';
const panelNumber = parseInt(process.argv[3], 10) || 6;

verifyImage(episodeId, panelNumber)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
