const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.resolve(__dirname, '..', 'moshimoshi-service-account.json');

function initAdmin() {
  if (admin.apps.length) return;
  // Load from local file so we don't rely on env vars.
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

  const scripts = ['hiragana', 'katakana'];
  for (const script of scripts) {
    const docRef = db.collection('users').doc(userId).collection('progress').doc(script);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`Progress doc missing: ${script}`);
      continue;
    }

    const data = docSnap.data() || {};
    const characters = data.characters || {};
    const characterCount = Object.keys(characters).length;

    console.log(`Progress doc found: ${script}`);
    console.log({
      totalCharacters: data.totalCharacters ?? 'n/a',
      totalLearned: data.totalLearned ?? 'n/a',
      characterCount,
      lastSync: formatTimestamp(data.lastSync),
      updatedAt: formatTimestamp(data.updatedAt)
    });
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exitCode = 1;
});
