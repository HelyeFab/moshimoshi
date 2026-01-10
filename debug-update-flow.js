/**
 * Debug script to trace the full goal update flow
 * This will show exactly what's happening in Firestore when you update
 */

const admin = require('firebase-admin');

const serviceAccount = require('./moshimoshi-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const firestore = admin.firestore();

// Dan's UID
const DAN_UID = 'c9BqeRkpAAOr5hR6X30m4PWsgIq1';

async function debugUpdateFlow() {
  console.log('\n🔍 Debugging Goal Update Flow\n');
  console.log('━'.repeat(70) + '\n');

  // Step 1: Check current state
  console.log('📊 STEP 1: Current State Before Update\n');

  const userDoc = await firestore.collection('users').doc(DAN_UID).get();
  const userData = userDoc.data();

  console.log('Current Goal:', userData?.onboarding?.learningGoal || 'None');

  const layoutDoc = await firestore
    .collection('users')
    .doc(DAN_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  const currentLayout = layoutDoc.exists ? layoutDoc.data()?.districtOrder : null;
  console.log('Current Layout:', currentLayout || 'None');
  console.log('Layout Source:', layoutDoc.exists ? layoutDoc.data()?.source : 'N/A');

  // Step 2: Simulate updating goal from JLPT to Anime
  console.log('\n━'.repeat(70));
  console.log('\n🔄 STEP 2: Simulating Goal Update (JLPT → Anime)\n');

  console.log('Updating onboarding goal...');
  await firestore.collection('users').doc(DAN_UID).update({
    'onboarding.learningGoal': 'anime',
    'onboarding.updatedAt': admin.firestore.Timestamp.now(),
  });
  console.log('✅ Updated users/{uid}/onboarding.learningGoal to "anime"');

  console.log('\nUpdating onboarding collection...');
  await firestore.collection('onboarding').doc(DAN_UID).update({
    learningGoal: 'anime',
    updatedAt: admin.firestore.Timestamp.now(),
  }).catch(() => {});
  console.log('✅ Updated onboarding/{uid}/learningGoal to "anime"');

  // Step 3: Check if layout still exists (should be deleted by cascade invalidation)
  console.log('\n━'.repeat(70));
  console.log('\n⚠️  STEP 3: Checking for Cascade Invalidation\n');

  const layoutAfterUpdate = await firestore
    .collection('users')
    .doc(DAN_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  if (layoutAfterUpdate.exists) {
    console.log('❌ PROBLEM FOUND: Village layout still exists!');
    console.log('   This means cascade invalidation did NOT run.');
    console.log('   Layout:', layoutAfterUpdate.data()?.districtOrder);
    console.log('\n   The API should have deleted this document.');
    console.log('   Dashboard will use this OLD layout instead of regenerating.');
  } else {
    console.log('✅ Layout was deleted (cascade invalidation worked)');
  }

  // Step 4: Manually delete layout to test
  console.log('\n━'.repeat(70));
  console.log('\n🧹 STEP 4: Manually Deleting Village Layout\n');

  try {
    await firestore
      .collection('users')
      .doc(DAN_UID)
      .collection('villageLayout')
      .doc('data')
      .delete();
    console.log('✅ Village layout deleted successfully');
  } catch (err) {
    console.log('⚠️  Layout already deleted or doesn\'t exist');
  }

  // Step 5: Verify final state
  console.log('\n━'.repeat(70));
  console.log('\n📊 STEP 5: Final State After Manual Deletion\n');

  const finalUserDoc = await firestore.collection('users').doc(DAN_UID).get();
  const finalUserData = finalUserDoc.data();

  console.log('Goal:', finalUserData?.onboarding?.learningGoal);
  console.log('Expected Layout:', '["immersion", "foundation", "study", "play", "community"]');

  const finalLayoutDoc = await firestore
    .collection('users')
    .doc(DAN_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  console.log('Layout Exists:', finalLayoutDoc.exists ? 'Yes ❌' : 'No ✅');

  if (finalLayoutDoc.exists) {
    console.log('Layout:', finalLayoutDoc.data()?.districtOrder);
  } else {
    console.log('Status: Layout will regenerate on next dashboard visit');
  }

  console.log('\n━'.repeat(70));
  console.log('\n🎯 DIAGNOSIS:\n');

  if (layoutAfterUpdate.exists) {
    console.log('❌ The PATCH /api/user/onboarding endpoint is NOT deleting the layout.');
    console.log('   This is why the dashboard shows the old layout.');
    console.log('\n   SOLUTION:');
    console.log('   1. The cascade invalidation code IS in the API file');
    console.log('   2. But it might not be running due to:');
    console.log('      - The API endpoint not being called from the test page');
    console.log('      - An error occurring before reaching the delete code');
    console.log('      - The test page calling a different endpoint');
    console.log('\n   Next step: Check browser Network tab to see what API is called');
  } else {
    console.log('✅ Cascade invalidation is working correctly.');
    console.log('   If dashboard still shows old layout, it might be:');
    console.log('   - Browser caching');
    console.log('   - React state not refreshing');
    console.log('   - useEffect not re-running');
  }

  console.log('\n━'.repeat(70) + '\n');
  process.exit(0);
}

debugUpdateFlow().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
