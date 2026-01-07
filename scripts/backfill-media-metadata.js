const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const bucket = admin.storage().bucket();
const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function backfillMetadata() {
  try {
    console.log('📦 Starting Firestore metadata backfill...\n');

    // List all files in user's anki-media folder
    const [files] = await bucket.getFiles({
      prefix: `anki-media/${userId}/`
    });

    if (files.length === 0) {
      console.log('❌ No files found in Firebase Storage');
      process.exit(0);
    }

    console.log(`✅ Found ${files.length} files in Firebase Storage\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pathParts = file.name.split('/');

      // Show progress every 50 files
      if ((i + 1) % 50 === 0) {
        console.log(`Progress: ${i + 1}/${files.length} files processed...`);
      }

      // anki-media/userId/deckId/filename
      if (pathParts.length !== 4) {
        console.log(`⚠️  Skipping invalid path: ${file.name}`);
        skipped++;
        continue;
      }

      const [_, fileUserId, deckId, filename] = pathParts;

      // Debug: Show first file details
      if (i === 0) {
        console.log(`Debug first file:`);
        console.log(`  Path: ${file.name}`);
        console.log(`  UserId: ${fileUserId}`);
        console.log(`  DeckId: ${deckId}`);
        console.log(`  Filename: ${filename}\n`);
      }

      try {
        // Check if metadata already exists
        const metadataRef = db
          .collection('users').doc(fileUserId)
          .collection('ankiDecks').doc(deckId)
          .collection('media').doc(filename);

        const existingDoc = await metadataRef.get();

        if (existingDoc.exists) {
          if (i < 5) {
            console.log(`  Skipping ${filename} - already exists`);
          }
          skipped++;
          continue;
        }

        if (i < 5) {
          console.log(`  Creating metadata for ${filename}...`);
        }

        // Get file metadata
        const [metadata] = await file.getMetadata();
        const size = parseInt(metadata.size || 0);
        const contentType = metadata.contentType || 'application/octet-stream';

        // Get signed URL
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '03-01-2500'
        });

        // Create Firestore metadata entry
        await metadataRef.set({
          filename: filename,
          originalFilename: metadata.metadata?.originalFilename || filename,
          size: size,
          contentType: contentType,
          userId: fileUserId,
          deckId: deckId,
          firebaseUrl: url,
          storagePath: file.name,
          uploadedAt: metadata.metadata?.uploadedAt
            ? admin.firestore.Timestamp.fromDate(new Date(metadata.metadata.uploadedAt))
            : admin.firestore.Timestamp.fromDate(new Date(metadata.timeCreated)),
          syncStatus: 'synced'
        });

        created++;

        if (created % 50 === 0) {
          console.log(`✓ Created ${created} metadata entries...`);
        }

      } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Backfill Summary:');
    console.log(`  ✅ Created: ${created} entries`);
    console.log(`  ⏭️  Skipped: ${skipped} (already exist)`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📦 Total: ${files.length} files\n`);

    // Calculate total size
    const totalSize = files.reduce((sum, file) => {
      return sum + parseInt(file.metadata.size || 0);
    }, 0);

    console.log(`💾 Total Storage Used: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

backfillMetadata();
