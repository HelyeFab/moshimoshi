#!/usr/bin/env node

/**
 * Backfill Anki Media Metadata
 *
 * This script scans Firebase Storage for existing Anki media files
 * and creates Firestore metadata entries for quota tracking.
 *
 * Run this ONCE after deploying the new metadata tracking system.
 *
 * Usage:
 *   node scripts/backfill-anki-media-metadata.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function backfillMetadata() {
  console.log('🔍 Scanning Firebase Storage for Anki media files...\n');

  try {
    // Get all files in the anki-media/ folder
    const [files] = await bucket.getFiles({
      prefix: 'anki-media/'
    });

    if (files.length === 0) {
      console.log('✅ No media files found in Firebase Storage.');
      console.log('   This is expected if you haven\'t uploaded any decks yet.\n');
      return;
    }

    console.log(`📁 Found ${files.length} media files in Storage\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Process each file
    for (const file of files) {
      const filePath = file.name; // e.g., "anki-media/userId/deckId/filename.jpg"

      // Skip if not a valid media file path
      const parts = filePath.split('/');
      if (parts.length !== 4 || parts[0] !== 'anki-media') {
        console.log(`⚠️  Skipping invalid path: ${filePath}`);
        skipped++;
        continue;
      }

      const [, userId, deckId, filename] = parts;

      try {
        // Check if metadata already exists
        const metadataRef = db
          .collection('users').doc(userId)
          .collection('ankiDecks').doc(deckId)
          .collection('media').doc(filename);

        const existingDoc = await metadataRef.get();

        if (existingDoc.exists) {
          console.log(`⏭️  Metadata already exists: ${filename}`);
          skipped++;
          continue;
        }

        // Get file metadata from Storage
        const [metadata] = await file.getMetadata();
        const size = parseInt(metadata.size, 10);
        const contentType = metadata.contentType || 'application/octet-stream';
        const timeCreated = metadata.timeCreated;

        // Get download URL
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '03-01-2500' // Far future date
        });

        // Create Firestore metadata
        await metadataRef.set({
          filename,
          firebaseUrl: url,
          size,
          contentType,
          uploadedAt: timeCreated,
          syncStatus: 'synced',
          userId,
          deckId,
          backfilled: true, // Flag to identify backfilled entries
          backfilledAt: new Date().toISOString()
        });

        console.log(`✅ Created metadata: ${filename} (${formatBytes(size)})`);
        created++;

      } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Created:  ${created} metadata entries`);
    console.log(`⏭️  Skipped:  ${skipped} files (already had metadata)`);
    console.log(`❌ Errors:   ${errors} files failed`);
    console.log(`📁 Total:    ${files.length} files scanned`);
    console.log('='.repeat(60) + '\n');

    if (created > 0) {
      console.log('🎉 Backfill complete! Your storage quota should now show accurate usage.\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Run the backfill
backfillMetadata()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
