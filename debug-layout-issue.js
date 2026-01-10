/**
 * Deep dive into layout issue - check all possible locations
 */

const admin = require('firebase-admin');

const serviceAccount = require('./moshimoshi-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const firestore = admin.firestore();

const USER_UID = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function debugLayout() {
  console.log('\n🔍 Deep Debug - Layout Issue\n');
  console.log('━'.repeat(70) + '\n');

  // Check user document
  const userDoc = await firestore.collection('users').doc(USER_UID).get();
  const userData = userDoc.data();

  console.log('1️⃣  User Document (users/{uid}):');
  console.log('   Learning Goal:', userData?.onboarding?.learningGoal);
  console.log('');

  // Check ALL subcollections
  console.log('2️⃣  Checking villageLayout subcollection:');
  const layoutCollection = await firestore
    .collection('users')
    .doc(USER_UID)
    .collection('villageLayout')
    .get();

  console.log('   Documents found:', layoutCollection.size);

  if (layoutCollection.empty) {
    console.log('   ❌ No documents in villageLayout subcollection');
  } else {
    layoutCollection.forEach(doc => {
      console.log('   📄 Document ID:', doc.id);
      console.log('      Data:', JSON.stringify(doc.data(), null, 2));
    });
  }
  console.log('');

  // Try to read the specific 'data' document
  console.log('3️⃣  Checking villageLayout/data specifically:');
  const layoutDoc = await firestore
    .collection('users')
    .doc(USER_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  console.log('   Exists:', layoutDoc.exists);
  if (layoutDoc.exists) {
    console.log('   Data:', JSON.stringify(layoutDoc.data(), null, 2));
  }
  console.log('');

  // Check onboarding collection (separate from users doc)
  console.log('4️⃣  Checking onboarding/{uid}:');
  const onboardingDoc = await firestore.collection('onboarding').doc(USER_UID).get();

  if (onboardingDoc.exists) {
    console.log('   Exists: Yes');
    console.log('   Learning Goal:', onboardingDoc.data()?.learningGoal);
    console.log('   Data:', JSON.stringify(onboardingDoc.data(), null, 2));
  } else {
    console.log('   Exists: No');
  }
  console.log('');

  // Now simulate what the dashboard does
  console.log('5️⃣  Simulating Dashboard Load:');
  console.log('');

  console.log('   Step 1: Try to load saved layout...');
  const layoutRes = await firestore
    .collection('users')
    .doc(USER_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  let userOrder = null;
  if (layoutRes.exists) {
    const maybeOrder = layoutRes.data()?.districtOrder;
    console.log('   Found saved layout:', maybeOrder);
    userOrder = maybeOrder;
  } else {
    console.log('   No saved layout found');
  }

  console.log('');
  console.log('   Step 2: Load onboarding goal...');
  const goal = userData?.onboarding?.learningGoal;
  console.log('   Goal from users doc:', goal);

  console.log('');
  console.log('   Step 3: Build district order...');

  const DEFAULT_ORDER = ['foundation', 'study', 'immersion', 'play', 'community'];
  const GOAL_TO_PRIORITY = {
    jlpt: 'study',
    anime: 'immersion',
    travel: 'immersion',
    conversation: 'immersion',
  };

  let finalOrder;
  if (userOrder && userOrder.length > 0) {
    console.log('   Using saved layout (cached)');
    finalOrder = userOrder;
  } else if (goal && GOAL_TO_PRIORITY[goal]) {
    const priority = GOAL_TO_PRIORITY[goal];
    const rest = DEFAULT_ORDER.filter(d => d !== priority);
    finalOrder = [priority, ...rest];
    console.log('   Building from goal:', goal);
    console.log('   Priority district:', priority);
  } else {
    finalOrder = DEFAULT_ORDER;
    console.log('   Using default order (no goal)');
  }

  console.log('   Final order:', JSON.stringify(finalOrder));

  console.log('');
  console.log('   Step 4: Persist to Firestore...');

  if (!userOrder) {
    console.log('   Would save:', JSON.stringify(finalOrder));
    console.log('   Saving now...');

    await firestore
      .collection('users')
      .doc(USER_UID)
      .collection('villageLayout')
      .doc('data')
      .set({
        districtOrder: finalOrder,
        source: 'personalized',
        generatedAt: admin.firestore.Timestamp.now(),
      });

    console.log('   ✅ Saved to Firestore');
  } else {
    console.log('   Already exists, not saving');
  }

  console.log('');
  console.log('━'.repeat(70));
  console.log('');
  console.log('🎯 DIAGNOSIS:');
  console.log('');
  console.log('Expected first district for goal "anime":', 'immersion');
  console.log('Actual first district:', finalOrder[0]);
  console.log('');

  if (finalOrder[0] === 'immersion') {
    console.log('✅ Layout is CORRECT for your goal');
  } else {
    console.log('❌ Layout does NOT match your goal');
  }

  console.log('');
  console.log('Full expected order:', JSON.stringify(['immersion', 'foundation', 'study', 'play', 'community']));
  console.log('Full actual order:  ', JSON.stringify(finalOrder));

  console.log('');
  console.log('━'.repeat(70) + '\n');
  process.exit(0);
}

debugLayout().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
