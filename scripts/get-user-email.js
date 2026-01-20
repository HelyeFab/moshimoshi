const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function getUserEmail() {
  const uid = process.argv[2];
  if (!uid) {
    console.log('Usage: node get-user-email.js <uid>');
    process.exit(1);
  }

  try {
    const userRecord = await admin.auth().getUser(uid);
    console.log(userRecord.email);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getUserEmail().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
