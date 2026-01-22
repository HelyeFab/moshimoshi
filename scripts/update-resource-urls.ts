/**
 * Migration script to update existing resources with their external URLs
 * Run with: npx ts-node scripts/update-resource-urls.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

// Initialize Firebase Admin using service account file
const serviceAccountPath = path.join(process.cwd(), 'moshimoshi-service-account.json');

if (getApps().length === 0) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to load service account from:', serviceAccountPath);
    process.exit(1);
  }
}

const db = getFirestore();

// Resource URL mappings
const resourceUrls: Record<string, string> = {
  '5I9bJnve4su9sUdaS5uA': 'https://guidetojapanese.org/learn/', // Tae Kim's Guide
  'fZEFXuo96ZSOd4IA3gAm': 'https://nihongo-e-na.com/eng/', // NIHONGO eな
  'KA0OFySj2Kj7tRb77rDw': 'https://marugotoweb.jp/en/', // MARUGOTO Grammar
  'rv7GvHUuK0WSQBdFeNXk': 'https://www.youtube.com/@JapanesewithShun', // Oyasumi Japanese
};

async function updateResourceUrls() {
  console.log('Starting resource URL migration...\n');

  for (const [resourceId, externalUrl] of Object.entries(resourceUrls)) {
    try {
      const docRef = db.collection('resources').doc(resourceId);
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log(`⚠️  Resource ${resourceId} not found, skipping...`);
        continue;
      }

      const data = doc.data();
      console.log(`📝 Updating: ${data?.title}`);
      console.log(`   URL: ${externalUrl}`);

      await docRef.update({
        externalUrl,
        updatedAt: new Date(),
      });

      console.log(`✅ Updated successfully\n`);
    } catch (error) {
      console.error(`❌ Failed to update ${resourceId}:`, error);
    }
  }

  console.log('Migration complete!');
}

updateResourceUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
