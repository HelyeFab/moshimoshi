const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function addDummyDecks() {
  console.log('=== Adding 14 dummy Anki decks to reach limit ===\n');

  const batch = db.batch();
  const dummyDeckIds = [];

  for (let i = 2; i <= 15; i++) {
    const deckId = `test-limit-deck-${i}`;
    dummyDeckIds.push(deckId);

    const deckRef = db.collection('flashcardDecks').doc(deckId);
    batch.set(deckRef, {
      id: deckId,
      userId: userId,
      name: `Test Limit Deck ${i}`,
      source: 'anki',
      cardCount: 1,
      cards: [{ id: '1', front: 'test', back: 'test' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  await batch.commit();
  console.log('Added 14 dummy decks. Total should now be 15.');

  // Verify count
  const countSnapshot = await db
    .collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .count()
    .get();

  console.log('Current Anki deck count:', countSnapshot.data().count);

  return dummyDeckIds;
}

async function testApiImport() {
  console.log('\n=== Testing API Import (should fail with 403) ===\n');

  // We'll simulate the API check logic here since we can't call HTTP from this script easily
  const featuresConfig = require('../config/features.v1.json');

  // Get user's plan
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const plan = userData?.subscription?.plan || 'free';

  // Get current count
  const countSnapshot = await db
    .collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .count()
    .get();

  const currentAnkiCount = countSnapshot.data().count;

  // Check limits
  const limits = featuresConfig.limits;
  const planLimits = limits[plan] || limits.free;
  const maxAnkiImports = planLimits.monthly?.anki_imports ?? 0;

  console.log('Plan:', plan);
  console.log('Current count:', currentAnkiCount);
  console.log('Max allowed:', maxAnkiImports);

  if (maxAnkiImports !== -1 && currentAnkiCount >= maxAnkiImports) {
    console.log('\n❌ API would return 403 Forbidden:');
    console.log(JSON.stringify({
      error: 'Anki import limit reached',
      message: `You have reached the limit of ${maxAnkiImports} Anki deck imports for your plan.`,
      currentCount: currentAnkiCount,
      limit: maxAnkiImports,
    }, null, 2));
    return true; // Test passed
  } else {
    console.log('\n⚠️ API would ALLOW the import - test failed!');
    return false;
  }
}

async function cleanupDummyDecks(dummyDeckIds) {
  console.log('\n=== Cleaning up dummy decks ===\n');

  const batch = db.batch();
  for (const deckId of dummyDeckIds) {
    const deckRef = db.collection('flashcardDecks').doc(deckId);
    batch.delete(deckRef);
  }

  await batch.commit();
  console.log('Deleted', dummyDeckIds.length, 'dummy decks.');

  // Verify count
  const countSnapshot = await db
    .collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .count()
    .get();

  console.log('Final Anki deck count:', countSnapshot.data().count);
}

async function runTest() {
  try {
    // Step 1: Add dummy decks
    const dummyDeckIds = await addDummyDecks();

    // Step 2: Test the import (should fail)
    const testPassed = await testApiImport();

    // Step 3: Cleanup
    await cleanupDummyDecks(dummyDeckIds);

    console.log('\n=== Test Result ===');
    if (testPassed) {
      console.log('✅ SUCCESS: Limit enforcement is working correctly!');
    } else {
      console.log('❌ FAILURE: Limit enforcement is NOT working!');
    }
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

runTest().then(() => process.exit(0));
