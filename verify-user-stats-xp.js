const admin = require('firebase-admin');
const serviceAccount = require('./moshimoshi-service-account.json');

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verifyUserStatsXP() {
  const userId = 'r7r6at83BUPIjD69XatI4EGIECr1';

  console.log('✅ Verifying XP data in user_stats...\n');

  const userStatsDoc = await db.collection('user_stats').doc(userId).get();

  if (userStatsDoc.exists) {
    const stats = userStatsDoc.data();
    console.log('XP Data in user_stats:');
    console.log(JSON.stringify(stats.xp, null, 2));
  } else {
    console.log('❌ No user_stats found');
  }

  process.exit(0);
}

verifyUserStatsXP().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
