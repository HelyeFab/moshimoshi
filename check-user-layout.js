/**
 * Check user's current layout and goal
 */

const admin = require('firebase-admin');

const serviceAccount = require('./moshimoshi-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const firestore = admin.firestore();

const USER_UID = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkUserLayout() {
  console.log('\n🔍 Checking User Layout\n');
  console.log('━'.repeat(70) + '\n');

  // Get user document
  const userDoc = await firestore.collection('users').doc(USER_UID).get();

  if (!userDoc.exists) {
    console.log('❌ User not found');
    process.exit(1);
  }

  const userData = userDoc.data();

  console.log('👤 User Info:');
  console.log('   Email:', userData.email);
  console.log('   Display Name:', userData.displayName || 'None');
  console.log('   UID:', USER_UID);
  console.log('');

  // Get onboarding data
  console.log('📚 Onboarding Data:');
  const onboardingGoal = userData?.onboarding?.learningGoal || null;
  const experienceLevel = userData?.onboarding?.experienceLevel || null;
  const completedAt = userData?.onboarding?.completedAt;

  console.log('   Learning Goal:', onboardingGoal || 'Not set');
  console.log('   Experience Level:', experienceLevel || 'Not set');
  console.log('   Completed:', completedAt ? 'Yes' : 'No');

  if (completedAt) {
    console.log('   Completed At:', completedAt.toDate().toISOString());
  }
  console.log('');

  // Get village layout
  const layoutDoc = await firestore
    .collection('users')
    .doc(USER_UID)
    .collection('villageLayout')
    .doc('data')
    .get();

  console.log('🏘️  Village Layout:');

  if (layoutDoc.exists) {
    const layoutData = layoutDoc.data();
    const districtOrder = layoutData.districtOrder;
    const source = layoutData.source;
    const generatedAt = layoutData.generatedAt;

    console.log('   Status: Exists');
    console.log('   District Order:', JSON.stringify(districtOrder));
    console.log('   Source:', source);

    if (generatedAt) {
      console.log('   Generated At:', generatedAt.toDate().toISOString());
    }

    // Analyze if layout matches goal
    console.log('');
    console.log('🎯 Layout Analysis:');

    const GOAL_TO_PRIORITY = {
      jlpt: 'study',
      anime: 'immersion',
      travel: 'immersion',
      conversation: 'immersion',
    };

    if (onboardingGoal && GOAL_TO_PRIORITY[onboardingGoal]) {
      const expectedFirst = GOAL_TO_PRIORITY[onboardingGoal];
      const actualFirst = districtOrder ? districtOrder[0] : null;

      console.log('   Expected first district:', expectedFirst);
      console.log('   Actual first district:', actualFirst);

      if (actualFirst === expectedFirst) {
        console.log('   ✅ Layout matches your goal!');
      } else {
        console.log('   ❌ Layout does NOT match your goal');
        console.log('      This means the layout was generated before the goal was set,');
        console.log('      or cascade invalidation did not run when goal changed.');
      }
    } else if (!onboardingGoal) {
      console.log('   ⚠️  No learning goal set - using default layout');
      const DEFAULT_ORDER = ['foundation', 'study', 'immersion', 'play', 'community'];
      console.log('   Expected order:', JSON.stringify(DEFAULT_ORDER));
    } else {
      console.log('   ⚠️  Unknown goal:', onboardingGoal);
    }

  } else {
    console.log('   Status: Not set');
    console.log('   Note: Will be generated on first dashboard visit');
  }

  console.log('\n' + '━'.repeat(70) + '\n');
  process.exit(0);
}

checkUserLayout().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
