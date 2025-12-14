const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();
const userId = 'Wj4QXNy0olYUnF169VuRCrjogOh2';

async function main() {
  // List all users
  const usersSnapshot = await db.collection('users').limit(20).get();
  console.log('Users in collection (' + usersSnapshot.size + '):');
  usersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log('  ID:', doc.id);
    console.log('  Email:', data.email);
    console.log('  Subscription:', JSON.stringify(data.subscription));
    console.log('---');
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
