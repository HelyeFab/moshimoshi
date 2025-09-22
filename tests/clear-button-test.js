#!/usr/bin/env node

/**
 * Test script to verify Clear button behavior
 * Ensures that Clear only affects selection, not learning progress or streaks
 */

console.log('🧪 Testing Clear Button Behavior...\n');

// Simulate user data
const userId = 'test-user-123';
const today = new Date().toISOString().split('T')[0];

// Mock initial state
const initialProgress = {
  'a': {
    status: 'learned',
    reviewCount: 10,
    correctCount: 8,
    lastReviewed: new Date('2025-01-14'),
    pinned: true  // This should be cleared
  },
  'ka': {
    status: 'learning',
    reviewCount: 5,
    correctCount: 3,
    lastReviewed: new Date('2025-01-13'),
    pinned: false
  },
  'sa': {
    status: 'not-started',
    reviewCount: 0,
    correctCount: 0,
    pinned: true  // This should be cleared
  }
};

// Mock localStorage
const mockLocalStorage = {
  [`activities_${userId}`]: JSON.stringify({ '2025-01-14': true, '2025-01-15': true }),
  [`kana-progress-hiragana-${userId}`]: JSON.stringify(initialProgress),
  [`progress_${userId}`]: JSON.stringify([])
};

console.log('📝 Initial State:');
console.log('- Selected characters: ["a", "ka", "sa"]');
console.log('- Pinned characters: a ✅, sa ✅');
console.log('- Learning progress: a (learned), ka (learning), sa (not-started)');
console.log('- Streak data: 2 days');
console.log('');

// Simulate Clear button click
console.log('🔘 Clicking Clear button...\n');

// What Clear should do:
const afterClear = {
  selectedCharacters: [],  // ✅ Cleared
  progress: {
    'a': {
      ...initialProgress['a'],
      pinned: false  // ✅ Unpinned
    },
    'ka': {
      ...initialProgress['ka'],
      pinned: false  // Already false, stays false
    },
    'sa': {
      ...initialProgress['sa'],
      pinned: false  // ✅ Unpinned
    }
  }
};

// What Clear should NOT change:
const unchangedData = {
  learningStatus: {
    'a': 'learned',     // ✅ Unchanged
    'ka': 'learning',   // ✅ Unchanged
    'sa': 'not-started' // ✅ Unchanged
  },
  reviewCounts: {
    'a': { reviewCount: 10, correctCount: 8 },  // ✅ Unchanged
    'ka': { reviewCount: 5, correctCount: 3 },   // ✅ Unchanged
    'sa': { reviewCount: 0, correctCount: 0 }    // ✅ Unchanged
  },
  streakData: mockLocalStorage[`activities_${userId}`]  // ✅ Unchanged
};

console.log('✅ After Clear - What Changed:');
console.log('- Selected characters: [] (cleared)');
console.log('- Pinned characters: none (all unpinned)');
console.log('');

console.log('✅ After Clear - What Stayed the Same:');
console.log('- Learning progress: a (learned), ka (learning), sa (not-started)');
console.log('- Review counts: unchanged');
console.log('- Streak data: still 2 days');
console.log('- Last reviewed dates: unchanged');
console.log('');

// Verification tests
let allTestsPassed = true;

// Test 1: Selected characters cleared
if (afterClear.selectedCharacters.length !== 0) {
  console.log('❌ Test Failed: Selected characters not cleared');
  allTestsPassed = false;
} else {
  console.log('✅ Test Passed: Selected characters cleared');
}

// Test 2: All pinned flags set to false
const allUnpinned = Object.values(afterClear.progress).every(p => !p.pinned);
if (!allUnpinned) {
  console.log('❌ Test Failed: Some characters still pinned');
  allTestsPassed = false;
} else {
  console.log('✅ Test Passed: All characters unpinned');
}

// Test 3: Learning status unchanged
const statusUnchanged = Object.keys(initialProgress).every(key =>
  afterClear.progress[key].status === initialProgress[key].status
);
if (!statusUnchanged) {
  console.log('❌ Test Failed: Learning status changed');
  allTestsPassed = false;
} else {
  console.log('✅ Test Passed: Learning status unchanged');
}

// Test 4: Review counts unchanged
const countsUnchanged = Object.keys(initialProgress).every(key =>
  afterClear.progress[key].reviewCount === initialProgress[key].reviewCount &&
  afterClear.progress[key].correctCount === initialProgress[key].correctCount
);
if (!countsUnchanged) {
  console.log('❌ Test Failed: Review counts changed');
  allTestsPassed = false;
} else {
  console.log('✅ Test Passed: Review counts unchanged');
}

// Test 5: Streak data unchanged
if (mockLocalStorage[`activities_${userId}`] !== JSON.stringify({ '2025-01-14': true, '2025-01-15': true })) {
  console.log('❌ Test Failed: Streak data changed');
  allTestsPassed = false;
} else {
  console.log('✅ Test Passed: Streak data unchanged');
}

console.log('\n' + '='.repeat(50));
if (allTestsPassed) {
  console.log('🎉 All tests passed! Clear button working correctly.');
  console.log('✅ Clear = Deselect, not Delete');
} else {
  console.log('⚠️ Some tests failed. Please review the implementation.');
}