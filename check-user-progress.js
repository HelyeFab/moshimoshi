const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUserProgress() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';

  console.log('Checking progress data for user:', userId);
  console.log('Looking in: /users/{uid}/progress');
  console.log('---\n');

  // Check if progress collection exists
  const progressRef = db.collection('users').doc(userId).collection('progress');
  const progressSnapshot = await progressRef.get();

  if (progressSnapshot.empty) {
    console.log('❌ No progress collection found');
  } else {
    console.log(`✅ Found ${progressSnapshot.size} document(s) in progress collection\n`);

    progressSnapshot.forEach(doc => {
      console.log(`Document ID: ${doc.id}`);
      console.log('Data:');
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log('---\n');
    });
  }

  // Also check if there's a progress document (not collection)
  const progressDocRef = db.collection('users').doc(userId);
  const userDoc = await progressDocRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData && userData.progress) {
      console.log('✅ Found progress field in user document:');
      console.log(JSON.stringify(userData.progress, null, 2));
    } else {
      console.log('❌ No progress field in user document');
    }
  } else {
    console.log('❌ User document does not exist');
  }

  process.exit(0);
}

checkUserProgress().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
