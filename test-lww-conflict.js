const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testLWWConflict() {
  try {
    const deckId = 'ce09ced7-d1f5-4734-a5a8-434c0134194a'; // Beano deck

    console.log('🧪 Testing Last-Write-Wins (LWW) Conflict Resolution\n');

    // Step 1: Get current deck state
    const deckDoc = await db.collection('flashcardDecks').doc(deckId).get();
    const currentData = deckDoc.data();

    console.log('📊 Current Firebase State:');
    console.log('  Name:', currentData.name);
    console.log('  Description:', currentData.description || '(empty)');
    console.log('  Updated:', new Date(currentData.updatedAt).toLocaleString());
    console.log('  Timestamp:', currentData.updatedAt);

    // Step 2: Create an OLDER version in Firebase (simulate conflict)
    const olderTimestamp = Date.now() - 60000; // 1 minute ago
    const olderDescription = '🔴 OLDER VERSION (Firebase) - Should be OVERWRITTEN by local';

    console.log('\n🕐 Creating OLDER version in Firebase...');
    console.log('  Timestamp:', olderTimestamp, '(1 minute ago)');
    console.log('  Description:', olderDescription);

    await db.collection('flashcardDecks').doc(deckId).update({
      description: olderDescription,
      updatedAt: olderTimestamp
    });

    console.log('  ✅ Older version saved to Firebase');

    // Step 3: Instructions for user
    console.log('\n📋 TEST INSTRUCTIONS:');
    console.log('  1. In the UI, edit the "Beano" deck');
    console.log('  2. Change description to: "🟢 NEWER VERSION (Local) - Should WIN"');
    console.log('  3. Save the deck (this will have a newer timestamp)');
    console.log('  4. Wait 5 seconds for sync to complete');
    console.log('  5. Run: node test-lww-verify.js');
    console.log('');
    console.log('  EXPECTED RESULT:');
    console.log('    ✅ Firebase should have: "🟢 NEWER VERSION (Local) - Should WIN"');
    console.log('    ✅ The newer local timestamp should win (LWW)');
    console.log('    ❌ Firebase should NOT have: "🔴 OLDER VERSION"');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testLWWConflict();
