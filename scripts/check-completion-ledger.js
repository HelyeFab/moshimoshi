const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/check-completion-ledger.js <uid>');
  process.exit(1);
}

async function run() {
  console.log('='.repeat(80));
  console.log(`COMPLETION LEDGER + DRILL SESSIONS FOR: ${userId}`);
  console.log('='.repeat(80));
  console.log();

  try {
    const ledgerRef = db.collection('users').doc(userId).collection('completion_ledger');
    const ledgerSnapshot = await ledgerRef.orderBy('createdAt', 'desc').limit(20).get();

    console.log('📒 COMPLETION LEDGER (latest 20)');
    console.log('-'.repeat(80));
    console.log(`Total fetched: ${ledgerSnapshot.size}`);
    ledgerSnapshot.forEach(doc => {
      console.log(`- ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
    console.log();

    const drillSessionsSnapshot = await db
      .collection('drill_sessions')
      .where('userId', '==', userId)
      .orderBy('startedAt', 'desc')
      .limit(10)
      .get();

    console.log('🧩 DRILL SESSIONS (latest 10)');
    console.log('-'.repeat(80));
    console.log(`Total fetched: ${drillSessionsSnapshot.size}`);
    drillSessionsSnapshot.forEach(doc => {
      console.log(`- ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

run();
