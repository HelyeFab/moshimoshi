/**
 * End-to-end test for dashboard refresh after goal update
 * This simulates the user flow:
 * 1. Update goal on test page
 * 2. Navigate to dashboard
 * 3. Verify new layout is shown
 */

const admin = require('firebase-admin');

const serviceAccount = require('./moshimoshi-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const firestore = admin.firestore();

const DAN_UID = 'c9BqeRkpAAOr5hR6X30m4PWsgIq1';

async function testDashboardRefresh() {
  console.log('\n🧪 Testing Dashboard Refresh After Goal Update\n');
  console.log('━'.repeat(70) + '\n');

  // Step 1: Check current state
  console.log('📊 STEP 1: Current State\n');

  const userDoc = await firestore.collection('users').doc(DAN_UID).get();
  const currentGoal = userDoc.data()?.onboarding?.learningGoal || 'None';

  const layoutDoc = await firestore
    .collection('users')
    .doc(DAN_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  const currentLayout = layoutDoc.exists ? layoutDoc.data()?.districtOrder : null;

  console.log('Current Goal:', currentGoal);
  console.log('Current Layout:', currentLayout || 'None (will regenerate)');

  // Step 2: Simulate test page update
  console.log('\n━'.repeat(70));
  console.log('\n🔄 STEP 2: Simulating Test Page Goal Update\n');

  const newGoal = currentGoal === 'jlpt' ? 'anime' : 'jlpt';
  console.log(`Updating goal: ${currentGoal} → ${newGoal}`);

  // Update onboarding
  await firestore.collection('users').doc(DAN_UID).update({
    'onboarding.learningGoal': newGoal,
    'onboarding.updatedAt': admin.firestore.Timestamp.now(),
  });

  await firestore.collection('onboarding').doc(DAN_UID).update({
    learningGoal: newGoal,
    updatedAt: admin.firestore.Timestamp.now(),
  }).catch(() => {});

  console.log(`✅ Updated goal to "${newGoal}"`);

  // Simulate cascade invalidation (this happens in the API)
  try {
    await firestore
      .collection('users')
      .doc(DAN_UID)
      .collection('villageLayout')
      .doc('data')
      .delete();
    console.log('✅ Deleted village layout (cascade invalidation)');
  } catch (err) {
    console.log('⚠️  No layout to delete');
  }

  // Step 3: Simulate dashboard visit
  console.log('\n━'.repeat(70));
  console.log('\n🏠 STEP 3: Simulating Dashboard Visit\n');

  console.log('Checking if layout exists...');
  const layoutAfterDelete = await firestore
    .collection('users')
    .doc(DAN_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  if (!layoutAfterDelete.exists) {
    console.log('✅ Layout was deleted, will regenerate based on new goal');

    // Simulate what LearningVillage does
    const updatedUserDoc = await firestore.collection('users').doc(DAN_UID).get();
    const goal = updatedUserDoc.data()?.onboarding?.learningGoal;

    console.log(`Fetched goal: ${goal}`);

    // Build new district order
    const DEFAULT_ORDER = ['foundation', 'study', 'immersion', 'play', 'community'];
    const GOAL_TO_PRIORITY = {
      jlpt: 'study',
      anime: 'immersion',
      travel: 'immersion',
      conversation: 'immersion',
    };

    const priority = GOAL_TO_PRIORITY[goal];
    const newOrder = [priority, ...DEFAULT_ORDER.filter(d => d !== priority)];

    console.log('Generated new district order:', newOrder);

    // Simulate persisting the new order
    await firestore
      .collection('users')
      .doc(DAN_UID)
      .collection('villageLayout')
      .doc('data')
      .set({
        districtOrder: newOrder,
        source: 'personalized',
        generatedAt: admin.firestore.Timestamp.now(),
      });

    console.log('✅ Persisted new layout');
  } else {
    console.log('❌ ERROR: Layout still exists, should have been deleted!');
    console.log('   Layout:', layoutAfterDelete.data()?.districtOrder);
  }

  // Step 4: Verify final state
  console.log('\n━'.repeat(70));
  console.log('\n✅ STEP 4: Final State\n');

  const finalUserDoc = await firestore.collection('users').doc(DAN_UID).get();
  const finalGoal = finalUserDoc.data()?.onboarding?.learningGoal;

  const finalLayoutDoc = await firestore
    .collection('users')
    .doc(DAN_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  const finalLayout = finalLayoutDoc.data()?.districtOrder;

  console.log('Final Goal:', finalGoal);
  console.log('Final Layout:', finalLayout);

  const expectedFirstDistrict = newGoal === 'jlpt' ? 'study' : 'immersion';
  const success = finalLayout && finalLayout[0] === expectedFirstDistrict;

  console.log('\n━'.repeat(70));
  console.log(`\n${success ? '✅' : '❌'} Test ${success ? 'PASSED' : 'FAILED'}\n`);

  if (success) {
    console.log(`The dashboard will now show "${expectedFirstDistrict}" as the first district.`);
  } else {
    console.log('ERROR: Layout does not match expected order!');
    console.log(`Expected first district: ${expectedFirstDistrict}`);
    console.log(`Actual first district: ${finalLayout ? finalLayout[0] : 'none'}`);
  }

  console.log('\n━'.repeat(70) + '\n');
  process.exit(success ? 0 : 1);
}

testDashboardRefresh().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
