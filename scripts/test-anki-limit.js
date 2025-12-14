const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');
const featuresConfig = require('../config/features.v1.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testAnkiLimit() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

  console.log('=== Testing Anki Import Limit ===\n');

  // Get user's plan
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const plan = userData?.subscription?.plan || 'free';
  console.log('User Plan:', plan);

  // Get current Anki deck count
  const ankiDecksSnapshot = await db
    .collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .count()
    .get();

  const currentAnkiCount = ankiDecksSnapshot.data().count;
  console.log('Current Anki Deck Count:', currentAnkiCount);

  // Check limits based on plan
  const limits = featuresConfig.limits;
  const planLimits = limits[plan] || limits.free;
  const maxAnkiImports = planLimits.monthly?.anki_imports ?? 0;
  console.log('Max Anki Imports for Plan:', maxAnkiImports);
  console.log('Remaining Imports:', maxAnkiImports === -1 ? 'Unlimited' : maxAnkiImports - currentAnkiCount);

  // Simulate limit check
  console.log('\n=== Simulating Import Attempts ===');

  if (maxAnkiImports !== -1 && currentAnkiCount >= maxAnkiImports) {
    console.log('❌ BLOCKED: User has reached the limit of', maxAnkiImports, 'Anki decks');
  } else {
    console.log('✅ ALLOWED: User can import', maxAnkiImports - currentAnkiCount, 'more decks');
  }

  // Test what would happen if we had 15 decks
  console.log('\n=== Scenario: If user had 15 decks ===');
  if (maxAnkiImports !== -1 && 15 >= maxAnkiImports) {
    console.log('❌ BLOCKED: Would return 403 error');
    console.log('   Message: "You have reached the limit of', maxAnkiImports, 'Anki deck imports for your plan."');
  } else {
    console.log('✅ ALLOWED: Import would proceed');
  }

  // Test what would happen if we had 14 decks
  console.log('\n=== Scenario: If user had 14 decks ===');
  if (maxAnkiImports !== -1 && 14 >= maxAnkiImports) {
    console.log('❌ BLOCKED: Would return 403 error');
  } else {
    console.log('✅ ALLOWED: Import would proceed (1 slot remaining)');
  }
}

testAnkiLimit().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
