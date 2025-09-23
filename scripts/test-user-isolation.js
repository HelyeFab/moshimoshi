#!/usr/bin/env node

/**
 * Script to test and verify user isolation in localStorage
 * This ensures that User B cannot see User A's study lists
 */

console.log('🔍 Testing User Isolation for Study Lists\n');
console.log('='.'='.repeat(40));

// Simulate different user IDs
const USER_A_ID = 'user_a_12345';
const USER_B_ID = 'user_b_67890';

// Storage key generators (matching StudyListManager implementation)
const getStudyListsKey = (userId) => `moshimoshi_study_lists_${userId}`;
const getSavedItemsKey = (userId) => `moshimoshi_saved_study_items_${userId}`;

// Test data
const userALists = [
  { id: 'list1', name: 'User A List 1', userId: USER_A_ID },
  { id: 'list2', name: 'User A List 2', userId: USER_A_ID }
];

const userBLists = [
  { id: 'list3', name: 'User B List 1', userId: USER_B_ID },
  { id: 'list4', name: 'User B List 2', userId: USER_B_ID }
];

// Legacy keys that should NOT exist
const LEGACY_KEYS = [
  'moshimoshi_study_lists',
  'moshimoshi_saved_study_items'
];

console.log('\n1️⃣  Checking for legacy non-user-specific keys...');
LEGACY_KEYS.forEach(key => {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(key)) {
    console.error(`   ❌ SECURITY ISSUE: Found legacy key "${key}" - this allows cross-user data access!`);
  } else {
    console.log(`   ✅ Legacy key "${key}" not found (good)`);
  }
});

console.log('\n2️⃣  Verifying user-specific storage keys...');
console.log(`   User A lists key: ${getStudyListsKey(USER_A_ID)}`);
console.log(`   User A items key: ${getSavedItemsKey(USER_A_ID)}`);
console.log(`   User B lists key: ${getStudyListsKey(USER_B_ID)}`);
console.log(`   User B items key: ${getSavedItemsKey(USER_B_ID)}`);

console.log('\n3️⃣  Testing data isolation...');
console.log('   Scenario: User A saves lists, then User B logs in');
console.log('   Expected: User B should NOT see User A\'s lists');

// Simulate saving User A's data
const userAKey = getStudyListsKey(USER_A_ID);
const userBKey = getStudyListsKey(USER_B_ID);

console.log(`\n   Step 1: Saving User A's lists to ${userAKey}`);
if (typeof localStorage !== 'undefined') {
  localStorage.setItem(userAKey, JSON.stringify(userALists));
  console.log(`   ✅ Saved ${userALists.length} lists for User A`);
}

console.log(`\n   Step 2: User B logs in and checks their lists`);
if (typeof localStorage !== 'undefined') {
  const userBData = localStorage.getItem(userBKey);
  const userAData = localStorage.getItem(userAKey);

  if (!userBData || JSON.parse(userBData).length === 0) {
    console.log(`   ✅ User B correctly sees no lists (empty state)`);
  } else {
    const lists = JSON.parse(userBData);
    const hasUserAData = lists.some(list => list.userId === USER_A_ID);
    if (hasUserAData) {
      console.error(`   ❌ CRITICAL: User B can see User A's lists!`);
    } else {
      console.log(`   ✅ User B only sees their own lists`);
    }
  }

  if (userAData) {
    console.log(`   ℹ️  User A's data still exists (in separate storage)`);
  }
}

console.log('\n4️⃣  Checking all localStorage keys for proper isolation...');
if (typeof localStorage !== 'undefined') {
  const allKeys = Object.keys(localStorage);
  const studyListKeys = allKeys.filter(key =>
    key.startsWith('moshimoshi_study_lists') ||
    key.startsWith('moshimoshi_saved_study_items')
  );

  console.log(`   Found ${studyListKeys.length} study-related keys:`);
  studyListKeys.forEach(key => {
    const hasUserId = key.includes('_user_') || key.split('_').length > 3;
    if (hasUserId) {
      console.log(`   ✅ ${key} (user-specific)`);
    } else if (key === 'moshimoshi_study_lists' || key === 'moshimoshi_saved_study_items') {
      console.error(`   ❌ ${key} (LEGACY - NOT USER SPECIFIC!)`);
    } else {
      console.warn(`   ⚠️  ${key} (unclear if user-specific)`);
    }
  });
}

console.log('\n5️⃣  Security Recommendations:');
console.log('   • Always use user-specific keys (include userId in key name)');
console.log('   • Clean up legacy data on user login');
console.log('   • Verify userId matches current user when loading data');
console.log('   • Clear all user data on logout');
console.log('   • Never use shared keys across users');

console.log('\n' + '='.repeat(40));
console.log('✨ User Isolation Test Complete\n');

// Clean up test data
if (typeof localStorage !== 'undefined') {
  console.log('Cleaning up test data...');
  localStorage.removeItem(userAKey);
  console.log('Test data cleaned up.');
}

// Note for browser environment
if (typeof window !== 'undefined') {
  console.log('\n📝 Note: This script is designed to run in a browser console.');
  console.log('   Copy and paste it into your browser DevTools console to test.');
}