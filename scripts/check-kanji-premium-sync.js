const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.resolve(__dirname, '..', 'moshimoshi-service-account.json');

function initAdmin() {
  if (admin.apps.length) return;
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function formatTimestamp(ts) {
  if (!ts) return 'n/a';
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

async function main() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
  initAdmin();

  const db = admin.firestore();

  const userSnap = await db.collection('users').doc(userId).get();
  const userData = userSnap.data() || {};
  const subscription = userData.subscription || {};
  const plan = subscription.plan || 'free';
  const status = subscription.status || 'unknown';
  const isPremium = status === 'active' && (plan === 'premium_monthly' || plan === 'premium_yearly');

  console.log('User:', userId);
  console.log('Subscription:', { plan, status, isPremium });

  const docRef = db.collection('users').doc(userId).collection('progress').doc('kanji');
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.log('Progress doc missing: kanji');
    return;
  }

  const data = docSnap.data() || {};
  const items = data.items || {};
  const itemCount = Object.keys(items).length;

  console.log('Progress doc found: kanji');
  console.log({
    itemCount,
    lastUpdated: formatTimestamp(data.lastUpdated),
    contentType: data.contentType || 'n/a'
  });

  // Show a small sample of item keys for sanity
  const sampleKeys = Object.keys(items).slice(0, 5);
  console.log('Sample item keys:', sampleKeys);

  console.log('Done.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exitCode = 1;
});
