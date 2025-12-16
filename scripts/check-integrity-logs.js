/**
 * Check recent integrity check logs
 */
const admin = require('firebase-admin');
const sa = require('../moshimoshi-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function check() {
  const logs = await db.collection('integrity_check_logs')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log('=== Recent Integrity Check Logs ===\n');
  logs.forEach(doc => {
    const d = doc.data();
    const ts = d.createdAt ? d.createdAt.toDate().toISOString() : 'N/A';
    console.log('Time:', ts);
    console.log('Type:', d.type, '| CheckId:', d.checkId);
    console.log('Success:', d.success !== false);
    if (d.stories) {
      console.log('Stories checked:', d.stories.checked);
      console.log('Stories missing images:', JSON.stringify(d.stories.missingImages || []));
      console.log('Stories repaired images:', d.stories.repaired?.images || 0);
    }
    if (d.error) {
      console.log('Error:', d.error);
    }
    console.log('---');
  });
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
