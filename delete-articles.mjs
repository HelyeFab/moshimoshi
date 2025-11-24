#!/usr/bin/env node

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function deleteAllArticles() {
  try {
    console.log('🗑️  Starting to delete all articles from news_articles collection...');

    const collectionRef = db.collection('news_articles');
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      console.log('📭 No articles found in the collection');
      return;
    }

    console.log(`📊 Found ${snapshot.size} articles to delete`);

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let deletedCount = 0;

    while (true) {
      const snapshot = await collectionRef.limit(batchSize).get();

      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += snapshot.size;
      console.log(`🗑️  Deleted ${deletedCount} articles so far...`);
    }

    console.log(`✅ Successfully deleted all ${deletedCount} articles!`);
  } catch (error) {
    console.error('❌ Error deleting articles:', error);
    throw error;
  }
}

// Run the deletion
deleteAllArticles()
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
