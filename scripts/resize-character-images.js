/**
 * Resize character images to reduce payload size
 *
 * The original images are too large (5-7MB) causing 413 errors.
 * This script resizes them to ~500KB max while maintaining quality.
 */

const admin = require('firebase-admin');
const sharp = require('sharp');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Target size: 1024px max dimension, ~500KB file size
const TARGET_SIZE = 1024;
const QUALITY = 85;

async function resizeCharacterImages() {
  console.log('🖼️  Starting character image resize...\n');

  const snapshot = await db.collection('saved_characters').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const charId = doc.id;
    const name = data.name;
    const imageUrl = data.referenceImageUrl;

    if (!imageUrl) {
      console.log(`⚠️  ${name}: No image URL, skipping`);
      continue;
    }

    console.log(`\n📷 Processing ${name} (${charId})...`);

    try {
      // Fetch original image
      console.log(`   Fetching from: ${imageUrl}`);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.log(`   ❌ Failed to fetch: ${response.status}`);
        continue;
      }

      const originalBuffer = Buffer.from(await response.arrayBuffer());
      const originalSizeKB = (originalBuffer.length / 1024).toFixed(1);
      console.log(`   Original size: ${originalSizeKB} KB`);

      // Resize image
      const resizedBuffer = await sharp(originalBuffer)
        .resize(TARGET_SIZE, TARGET_SIZE, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({ quality: QUALITY, compressionLevel: 9 })
        .toBuffer();

      const newSizeKB = (resizedBuffer.length / 1024).toFixed(1);
      const reduction = ((1 - resizedBuffer.length / originalBuffer.length) * 100).toFixed(1);
      console.log(`   Resized: ${newSizeKB} KB (${reduction}% reduction)`);

      // Upload resized image
      const storagePath = `characters/${charId}/model-sheet-optimized.png`;
      const file = bucket.file(storagePath);

      await file.save(resizedBuffer, {
        metadata: {
          contentType: 'image/png',
          metadata: {
            originalSize: originalSizeKB,
            resizedAt: new Date().toISOString(),
            targetSize: TARGET_SIZE
          }
        }
      });

      await file.makePublic();
      const newUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      console.log(`   ✅ Uploaded to: ${storagePath}`);

      // Convert to base64 for Firestore (optional - for faster loading)
      const base64Data = resizedBuffer.toString('base64');
      const base64SizeKB = (base64Data.length / 1024).toFixed(1);
      console.log(`   Base64 size: ${base64SizeKB} KB`);

      // Update Firestore document
      await db.collection('saved_characters').doc(charId).update({
        referenceImageUrl: newUrl,
        referenceImageData: base64Data,
        imageOptimizedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`   ✅ Firestore updated with new URL and base64 data`);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n✅ Done resizing character images!');
  process.exit(0);
}

resizeCharacterImages().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
