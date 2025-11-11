/**
 * Quick script to verify the lists were created successfully
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/home/beano/DevProjects/next_js/moshimoshi/moshimoshi-service-account.json', 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);
const USER_ID = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function verifyLists() {
  try {
    console.log('🔍 Verifying lists for user:', USER_ID);
    console.log('');

    const listsSnapshot = await db
      .collection('users')
      .doc(USER_ID)
      .collection('lists')
      .orderBy('updatedAt', 'desc')
      .get();

    console.log(`Found ${listsSnapshot.size} list(s):`);
    console.log('');

    listsSnapshot.forEach(doc => {
      const list = doc.data();
      console.log(`${list.emoji} ${list.name}`);
      console.log(`   Type: ${list.type}`);
      console.log(`   Items: ${list.items?.length || 0}`);
      console.log(`   Color: ${list.color}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying lists:', error);
    process.exit(1);
  }
}

verifyLists();
