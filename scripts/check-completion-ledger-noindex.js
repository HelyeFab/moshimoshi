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
  console.error('Usage: node scripts/check-completion-ledger-noindex.js <uid>');
  process.exit(1);
}

async function run() {
  console.log('='.repeat(80));
  console.log(`COMPLETION LEDGER + DRILL SESSIONS FOR: ${userId}`);
  console.log('='.repeat(80));
  console.log();

  try {
    const ledgerRef = db.collection('users').doc(userId).collection('completion_ledger');
    const ledgerSnapshot = await ledgerRef.limit(20).get();

    console.log('📒 COMPLETION LEDGER (latest 20)');
    console.log('-'.repeat(80));
    console.log(`Total fetched: ${ledgerSnapshot.size}`);
    if (ledgerSnapshot.empty) {
      console.log('(No completion ledger entries found)');
    } else {
      ledgerSnapshot.forEach(doc => {
        console.log(`- ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
      });
    }
    console.log();

    // Query without orderBy to avoid index requirement
    const drillSessionsSnapshot = await db
      .collection('drill_sessions')
      .where('userId', '==', userId)
      .limit(10)
      .get();

    console.log('🧩 DRILL SESSIONS (latest 10 - unordered)');
    console.log('-'.repeat(80));
    console.log(`Total fetched: ${drillSessionsSnapshot.size}`);
    if (drillSessionsSnapshot.empty) {
      console.log('(No drill sessions found)');
    } else {
      drillSessionsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}`);
        console.log(`  Started: ${data.startedAt}`);
        console.log(`  Completed: ${data.completedAt || 'N/A'}`);
        console.log(`  Status: ${data.status || 'N/A'}`);
        console.log(`  Items: ${data.items?.length || 0}`);
        console.log(JSON.stringify(data, null, 2));
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

run();
