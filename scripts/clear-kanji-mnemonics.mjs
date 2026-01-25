import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(__dirname, '../moshimoshi-service-account.json');

const app = initializeApp({
  credential: cert(serviceAccountPath)
});

const db = getFirestore(app);

async function clearMnemonics() {
  console.log('Clearing kanji_mnemonics collection...');
  
  const collection = db.collection('kanji_mnemonics');
  const snapshot = await collection.get();
  
  console.log(`Found ${snapshot.size} documents to delete`);
  
  if (snapshot.size === 0) {
    console.log('Collection is already empty');
    return;
  }
  
  // Delete in batches of 500 (Firestore limit)
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
  
  console.log('✓ All mnemonics cleared!');
}

clearMnemonics()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
