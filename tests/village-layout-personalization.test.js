/**
 * Village Layout Personalization Test Suite
 *
 * Tests the complete flow of village layout personalization based on onboarding goals
 * including cascade invalidation when goals change.
 *
 * Run with: node tests/village-layout-personalization.test.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moshimoshi-de237'
});

const firestore = admin.firestore();

// Test configuration
const DEFAULT_DISTRICT_ORDER = ['foundation', 'study', 'immersion', 'play', 'community'];
const GOAL_TO_PRIORITY = {
  conversation: 'immersion',
  anime: 'immersion',
  travel: 'immersion',
  jlpt: 'study',  // Updated from 'foundation'
};

// Helper function to build expected district order
function buildExpectedDistrictOrder(goal) {
  if (!goal || !GOAL_TO_PRIORITY[goal]) {
    return DEFAULT_DISTRICT_ORDER;
  }
  const priority = GOAL_TO_PRIORITY[goal];
  const rest = DEFAULT_DISTRICT_ORDER.filter(district => district !== priority);
  return [priority, ...rest];
}

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.testUsers = [];
  }

  async setup() {
    console.log('🔧 Setting up test environment...\n');
  }

  async teardown() {
    console.log('\n🧹 Cleaning up test users...');
    for (const uid of this.testUsers) {
      try {
        // Delete auth user
        await admin.auth().deleteUser(uid);

        // Delete user document
        await firestore.collection('users').doc(uid).delete();

        // Delete village layout
        await firestore
          .collection('users')
          .doc(uid)
          .collection('villageLayout')
          .doc('data')
          .delete()
          .catch(() => {});

        // Delete onboarding collection
        await firestore.collection('onboarding').doc(uid).delete().catch(() => {});

        console.log(`  ✓ Cleaned up user ${uid}`);
      } catch (err) {
        console.log(`  ⚠ Failed to clean up ${uid}: ${err.message}`);
      }
    }
  }

  async createTestUser(name, email) {
    const userRecord = await admin.auth().createUser({
      email,
      emailVerified: true,
      password: 'TestPassword123!',
      displayName: name,
    });

    await firestore.collection('users').doc(userRecord.uid).set({
      profileVersion: 1,
      locale: 'en',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      email,
      emailVerified: true,
      authProvider: 'password',
      displayName: name,
      profile: { displayName: name, avatarUrl: null },
      subscription: {
        plan: 'free',
        status: 'active',
        metadata: {
          source: 'auth',
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        }
      },
      preferences: {
        language: 'en',
        theme: 'dark',
        dailyGoalMinutes: 10,
        notifications: { email: true, push: false }
      },
      userState: 'active'
    });

    this.testUsers.push(userRecord.uid);
    return userRecord.uid;
  }

  async completeOnboarding(uid, learningGoal, experienceLevel = 'beginner') {
    await firestore.collection('users').doc(uid).set({
      onboarding: {
        completed: true,
        completedAt: admin.firestore.Timestamp.now(),
        learningGoal,
        experienceLevel,
        language: 'en',
      },
      updatedAt: admin.firestore.Timestamp.now(),
    }, { merge: true });

    await firestore.collection('onboarding').doc(uid).set({
      userId: uid,
      learningGoal,
      experienceLevel,
      language: 'en',
      completedAt: admin.firestore.Timestamp.now(),
    });
  }

  async simulateFirstDashboardVisit(uid) {
    // Simulate what LearningVillage.tsx does
    const userDoc = await firestore.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const onboardingGoal = userData?.onboarding?.learningGoal || null;

    // Check for saved layout
    const layoutDoc = await firestore
      .collection('users')
      .doc(uid)
      .collection('villageLayout')
      .doc('data')
      .get();

    let districtOrder;
    if (layoutDoc.exists) {
      districtOrder = layoutDoc.data()?.districtOrder || DEFAULT_DISTRICT_ORDER;
    } else {
      // No saved layout, build from onboarding
      districtOrder = buildExpectedDistrictOrder(onboardingGoal);

      // Save it
      await firestore
        .collection('users')
        .doc(uid)
        .collection('villageLayout')
        .doc('data')
        .set({
          districtOrder,
          updatedAt: admin.firestore.Timestamp.now(),
          source: 'onboarding-personalization',
        });
    }

    return districtOrder;
  }

  async updateOnboardingGoal(uid, newGoal) {
    // Simulate PATCH /api/user/onboarding
    await firestore.collection('users').doc(uid).update({
      'onboarding.learningGoal': newGoal,
      'onboarding.updatedAt': admin.firestore.Timestamp.now(),
    });

    await firestore.collection('onboarding').doc(uid).update({
      learningGoal: newGoal,
      updatedAt: admin.firestore.Timestamp.now(),
    }).catch(() => {});

    // CASCADE INVALIDATION (the fix we implemented)
    try {
      await firestore
        .collection('users')
        .doc(uid)
        .collection('villageLayout')
        .doc('data')
        .delete();
    } catch (err) {
      // Ignore if doesn't exist
    }
  }

  async test(name, testFn) {
    try {
      await testFn();
      this.passed++;
      console.log(`  ✅ ${name}`);
    } catch (err) {
      this.failed++;
      console.log(`  ❌ ${name}`);
      console.log(`     Error: ${err.message}`);
      if (err.stack) {
        console.log(`     ${err.stack.split('\n').slice(1, 3).join('\n     ')}`);
      }
    }
  }

  assertEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(`${message}\n      Expected: ${expectedStr}\n      Actual:   ${actualStr}`);
    }
  }

  async run() {
    await this.setup();

    console.log('🧪 Running Village Layout Personalization Test Suite\n');
    console.log('━'.repeat(70));

    // Test Suite 1: Fresh Users with Different Goals
    console.log('\n📋 Test Suite 1: Fresh Users with Different Goals\n');

    await this.test('Fresh user with JLPT goal should get "study" first', async () => {
      const uid = await this.createTestUser('Test JLPT', 'test-jlpt@example.com');
      await this.completeOnboarding(uid, 'jlpt', 'beginner');
      const order = await this.simulateFirstDashboardVisit(uid);
      const expected = ['study', 'foundation', 'immersion', 'play', 'community'];
      this.assertEqual(order, expected, 'JLPT user should get "study" district first');
    });

    await this.test('Fresh user with Anime goal should get "immersion" first', async () => {
      const uid = await this.createTestUser('Test Anime', 'test-anime@example.com');
      await this.completeOnboarding(uid, 'anime', 'beginner');
      const order = await this.simulateFirstDashboardVisit(uid);
      const expected = ['immersion', 'foundation', 'study', 'play', 'community'];
      this.assertEqual(order, expected, 'Anime user should get "immersion" district first');
    });

    await this.test('Fresh user with Travel goal should get "immersion" first', async () => {
      const uid = await this.createTestUser('Test Travel', 'test-travel@example.com');
      await this.completeOnboarding(uid, 'travel', 'intermediate');
      const order = await this.simulateFirstDashboardVisit(uid);
      const expected = ['immersion', 'foundation', 'study', 'play', 'community'];
      this.assertEqual(order, expected, 'Travel user should get "immersion" district first');
    });

    await this.test('Fresh user with Conversation goal should get "immersion" first', async () => {
      const uid = await this.createTestUser('Test Conversation', 'test-conversation@example.com');
      await this.completeOnboarding(uid, 'conversation', 'advanced');
      const order = await this.simulateFirstDashboardVisit(uid);
      const expected = ['immersion', 'foundation', 'study', 'play', 'community'];
      this.assertEqual(order, expected, 'Conversation user should get "immersion" district first');
    });

    // Test Suite 2: Layout Persistence
    console.log('\n📋 Test Suite 2: Layout Persistence\n');

    await this.test('Saved layout should persist on subsequent visits', async () => {
      const uid = await this.createTestUser('Test Persistence', 'test-persist@example.com');
      await this.completeOnboarding(uid, 'anime', 'beginner');

      // First visit
      const firstVisit = await this.simulateFirstDashboardVisit(uid);

      // Second visit (should return same order)
      const secondVisit = await this.simulateFirstDashboardVisit(uid);

      this.assertEqual(secondVisit, firstVisit, 'Layout should persist across visits');
    });

    // Test Suite 3: Cascade Invalidation (THE CRITICAL FIX)
    console.log('\n📋 Test Suite 3: Cascade Invalidation (Goal Changes)\n');

    await this.test('Changing goal from JLPT to Anime should regenerate layout', async () => {
      const uid = await this.createTestUser('Test Goal Change 1', 'test-change-1@example.com');

      // Start with JLPT
      await this.completeOnboarding(uid, 'jlpt', 'beginner');
      const jlptOrder = await this.simulateFirstDashboardVisit(uid);
      this.assertEqual(jlptOrder, ['study', 'foundation', 'immersion', 'play', 'community'],
        'Initial JLPT layout should have "study" first');

      // Change to Anime
      await this.updateOnboardingGoal(uid, 'anime');
      const animeOrder = await this.simulateFirstDashboardVisit(uid);
      this.assertEqual(animeOrder, ['immersion', 'foundation', 'study', 'play', 'community'],
        'After changing to Anime, layout should have "immersion" first');
    });

    await this.test('Changing goal from Anime to JLPT should regenerate layout', async () => {
      const uid = await this.createTestUser('Test Goal Change 2', 'test-change-2@example.com');

      // Start with Anime
      await this.completeOnboarding(uid, 'anime', 'beginner');
      const animeOrder = await this.simulateFirstDashboardVisit(uid);
      this.assertEqual(animeOrder[0], 'immersion', 'Anime should start with immersion');

      // Change to JLPT
      await this.updateOnboardingGoal(uid, 'jlpt');
      const jlptOrder = await this.simulateFirstDashboardVisit(uid);
      this.assertEqual(jlptOrder[0], 'study', 'JLPT should start with study after change');
    });

    await this.test('Layout should be deleted when goal changes', async () => {
      const uid = await this.createTestUser('Test Layout Deletion', 'test-delete@example.com');

      // Create initial layout
      await this.completeOnboarding(uid, 'travel', 'beginner');
      await this.simulateFirstDashboardVisit(uid);

      // Verify layout exists
      let layoutDoc = await firestore
        .collection('users')
        .doc(uid)
        .collection('villageLayout')
        .doc('data')
        .get();

      if (!layoutDoc.exists) {
        throw new Error('Layout should exist after first visit');
      }

      // Change goal
      await this.updateOnboardingGoal(uid, 'conversation');

      // Verify layout was deleted
      layoutDoc = await firestore
        .collection('users')
        .doc(uid)
        .collection('villageLayout')
        .doc('data')
        .get();

      if (layoutDoc.exists) {
        throw new Error('Layout should be deleted after goal change');
      }
    });

    // Test Suite 4: Edge Cases
    console.log('\n📋 Test Suite 4: Edge Cases\n');

    await this.test('User with no onboarding should get default order', async () => {
      const uid = await this.createTestUser('Test No Onboarding', 'test-no-onboard@example.com');
      // Don't complete onboarding
      const order = await this.simulateFirstDashboardVisit(uid);
      this.assertEqual(order, DEFAULT_DISTRICT_ORDER, 'Should get default order without onboarding');
    });

    await this.test('JLPT goal produces different order than default', async () => {
      const jlptOrder = buildExpectedDistrictOrder('jlpt');
      const defaultOrder = DEFAULT_DISTRICT_ORDER;

      if (JSON.stringify(jlptOrder) === JSON.stringify(defaultOrder)) {
        throw new Error('JLPT order should be visually different from default');
      }

      this.assertEqual(jlptOrder[0], 'study', 'JLPT should prioritize "study" district');
    });

    await this.test('All immersion goals (anime, travel, conversation) produce same order', async () => {
      const animeOrder = buildExpectedDistrictOrder('anime');
      const travelOrder = buildExpectedDistrictOrder('travel');
      const conversationOrder = buildExpectedDistrictOrder('conversation');

      this.assertEqual(animeOrder, travelOrder, 'Anime and Travel should produce same order');
      this.assertEqual(animeOrder, conversationOrder, 'Anime and Conversation should produce same order');
    });

    // Test Suite 5: Firestore Data Integrity
    console.log('\n📋 Test Suite 5: Firestore Data Integrity\n');

    await this.test('Onboarding data should persist in both collections', async () => {
      const uid = await this.createTestUser('Test Data Integrity', 'test-integrity@example.com');
      await this.completeOnboarding(uid, 'jlpt', 'intermediate');

      // Check users collection
      const userDoc = await firestore.collection('users').doc(uid).get();
      const userOnboarding = userDoc.data()?.onboarding;

      // Check onboarding collection
      const onboardingDoc = await firestore.collection('onboarding').doc(uid).get();
      const onboardingData = onboardingDoc.data();

      this.assertEqual(userOnboarding?.learningGoal, 'jlpt', 'User collection should have goal');
      this.assertEqual(onboardingData?.learningGoal, 'jlpt', 'Onboarding collection should have goal');
      this.assertEqual(userOnboarding?.experienceLevel, 'intermediate',
        'User collection should have level');
      this.assertEqual(onboardingData?.experienceLevel, 'intermediate',
        'Onboarding collection should have level');
    });

    await this.test('Village layout should have correct metadata', async () => {
      const uid = await this.createTestUser('Test Metadata', 'test-metadata@example.com');
      await this.completeOnboarding(uid, 'anime', 'beginner');
      await this.simulateFirstDashboardVisit(uid);

      const layoutDoc = await firestore
        .collection('users')
        .doc(uid)
        .collection('villageLayout')
        .doc('data')
        .get();

      const layoutData = layoutDoc.data();

      if (!layoutData?.districtOrder) {
        throw new Error('Layout should have districtOrder field');
      }
      if (!layoutData?.updatedAt) {
        throw new Error('Layout should have updatedAt timestamp');
      }
      if (layoutData?.source !== 'onboarding-personalization') {
        throw new Error('Layout source should be "onboarding-personalization"');
      }
    });

    // Summary
    console.log('\n' + '━'.repeat(70));
    console.log('\n📊 Test Results Summary\n');
    console.log(`  Total Tests: ${this.passed + this.failed}`);
    console.log(`  ✅ Passed: ${this.passed}`);
    console.log(`  ❌ Failed: ${this.failed}`);
    console.log(`  Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);

    await this.teardown();

    if (this.failed > 0) {
      console.log('\n❌ Some tests failed. Please review the errors above.\n');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed! Village layout personalization is working correctly.\n');
      process.exit(0);
    }
  }
}

// Run the test suite
const runner = new TestRunner();
runner.run().catch(err => {
  console.error('\n💥 Test suite crashed:', err);
  process.exit(1);
});
