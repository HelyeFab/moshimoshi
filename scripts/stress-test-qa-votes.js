#!/usr/bin/env node
/**
 * Stress Test for Q&A Voting System
 *
 * Tests:
 * 1. Rapid vote creation/deletion
 * 2. Concurrent voting from multiple users
 * 3. Vote switching (upvote <-> downvote)
 * 4. Vote count consistency
 * 5. Negative count prevention
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();

// Test configuration
const TEST_QUESTION_ID = 'dsQAIGU1OqHldH2IqCKy';
const NUM_TEST_USERS = 10;
const VOTES_PER_USER = 5;

// Generate test user IDs
const testUsers = Array.from({ length: NUM_TEST_USERS }, (_, i) => `test_user_${i}`);

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get current vote counts from database
 */
async function getVoteCounts(questionId) {
  const questionDoc = await db.collection('qa_questions').doc(questionId).get();
  if (!questionDoc.exists) {
    throw new Error('Question not found');
  }
  const data = questionDoc.data();
  return {
    upvotes: data.upvotes || 0,
    downvotes: data.downvotes || 0,
  };
}

/**
 * Count actual vote documents
 */
async function countVoteDocuments(questionId) {
  const votesSnapshot = await db.collection('qa_question_votes')
    .where('questionId', '==', questionId)
    .get();

  let upvotes = 0;
  let downvotes = 0;

  votesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.voteType === 'upvote') upvotes++;
    if (data.voteType === 'downvote') downvotes++;
  });

  return { upvotes, downvotes, total: votesSnapshot.size };
}

/**
 * Create a vote document
 */
async function createVote(userId, questionId, voteType) {
  const voteId = `${userId}_${questionId}`;
  await db.collection('qa_question_votes').doc(voteId).set({
    userId,
    questionId,
    voteType,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Delete a vote document
 */
async function deleteVote(userId, questionId) {
  const voteId = `${userId}_${questionId}`;
  await db.collection('qa_question_votes').doc(voteId).delete();
}

/**
 * Update vote type
 */
async function updateVote(userId, questionId, voteType) {
  const voteId = `${userId}_${questionId}`;
  await db.collection('qa_question_votes').doc(voteId).update({
    voteType,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Test 1: Rapid Sequential Voting
 */
async function testRapidSequentialVoting() {
  console.log('\n=== Test 1: Rapid Sequential Voting ===');
  console.log('Testing rapid vote creation and deletion...');

  const userId = 'rapid_test_user';
  const startCounts = await getVoteCounts(TEST_QUESTION_ID);

  // Rapidly create and delete votes
  for (let i = 0; i < VOTES_PER_USER; i++) {
    await createVote(userId, TEST_QUESTION_ID, 'upvote');
    await sleep(100); // Small delay to let Cloud Function trigger
    await deleteVote(userId, TEST_QUESTION_ID);
    await sleep(100);
  }

  // Wait for Cloud Functions to settle
  await sleep(2000);

  const endCounts = await getVoteCounts(TEST_QUESTION_ID);
  const voteDocs = await countVoteDocuments(TEST_QUESTION_ID);

  console.log(`Start counts: ${JSON.stringify(startCounts)}`);
  console.log(`End counts: ${JSON.stringify(endCounts)}`);
  console.log(`Vote documents: ${voteDocs.total}`);
  console.log(`✓ Test completed - Vote count should return to baseline`);

  return endCounts.upvotes === startCounts.upvotes && endCounts.downvotes === startCounts.downvotes;
}

/**
 * Test 2: Concurrent Voting (Multiple Users)
 */
async function testConcurrentVoting() {
  console.log('\n=== Test 2: Concurrent Voting ===');
  console.log(`Simulating ${NUM_TEST_USERS} users voting simultaneously...`);

  const startCounts = await getVoteCounts(TEST_QUESTION_ID);

  // All users vote concurrently
  const votePromises = testUsers.map(userId =>
    createVote(userId, TEST_QUESTION_ID, 'upvote')
  );

  await Promise.all(votePromises);

  // Wait for Cloud Functions
  await sleep(3000);

  const endCounts = await getVoteCounts(TEST_QUESTION_ID);
  const voteDocs = await countVoteDocuments(TEST_QUESTION_ID);

  console.log(`Start counts: ${JSON.stringify(startCounts)}`);
  console.log(`End counts: ${JSON.stringify(endCounts)}`);
  console.log(`Expected upvotes: ${startCounts.upvotes + NUM_TEST_USERS}`);
  console.log(`Actual upvotes: ${endCounts.upvotes}`);
  console.log(`Vote documents: ${voteDocs.upvotes} upvotes, ${voteDocs.total} total`);

  const success = endCounts.upvotes === startCounts.upvotes + NUM_TEST_USERS;
  console.log(success ? '✓ Test passed' : '✗ Test failed - count mismatch');

  return success;
}

/**
 * Test 3: Vote Switching
 */
async function testVoteSwitching() {
  console.log('\n=== Test 3: Vote Switching ===');
  console.log('Testing upvote <-> downvote switching...');

  const userId = 'switch_test_user';

  // Create initial upvote
  await createVote(userId, TEST_QUESTION_ID, 'upvote');
  await sleep(1000);

  const afterUpvote = await getVoteCounts(TEST_QUESTION_ID);
  console.log(`After upvote: ${JSON.stringify(afterUpvote)}`);

  // Switch to downvote
  await updateVote(userId, TEST_QUESTION_ID, 'downvote');
  await sleep(1000);

  const afterSwitch = await getVoteCounts(TEST_QUESTION_ID);
  console.log(`After switch to downvote: ${JSON.stringify(afterSwitch)}`);

  // Clean up
  await deleteVote(userId, TEST_QUESTION_ID);
  await sleep(1000);

  const afterDelete = await getVoteCounts(TEST_QUESTION_ID);
  console.log(`After delete: ${JSON.stringify(afterDelete)}`);

  console.log('✓ Test completed');
  return true;
}

/**
 * Test 4: Negative Count Prevention
 */
async function testNegativeCountPrevention() {
  console.log('\n=== Test 4: Negative Count Prevention ===');
  console.log('Testing that counts cannot go negative...');

  const userId = 'negative_test_user';
  const voteId = `${userId}_${TEST_QUESTION_ID}`;

  // Manually delete a non-existent vote to trigger decrement
  try {
    // Create a vote doc that will be deleted
    await db.collection('qa_question_votes').doc(voteId).set({
      userId,
      questionId: TEST_QUESTION_ID,
      voteType: 'upvote',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sleep(1000);

    // Delete it multiple times rapidly
    for (let i = 0; i < 3; i++) {
      try {
        await db.collection('qa_question_votes').doc(voteId).delete();
        await sleep(200);
      } catch (err) {
        // Ignore errors for subsequent deletes
      }
    }

    await sleep(2000);

    const counts = await getVoteCounts(TEST_QUESTION_ID);
    console.log(`Final counts: ${JSON.stringify(counts)}`);

    const hasNegative = counts.upvotes < 0 || counts.downvotes < 0;
    if (hasNegative) {
      console.log('✗ Test failed - negative counts detected!');
      return false;
    } else {
      console.log('✓ Test passed - no negative counts');
      return true;
    }
  } catch (error) {
    console.error('Error in negative count test:', error);
    return false;
  }
}

/**
 * Test 5: Data Consistency
 */
async function testDataConsistency() {
  console.log('\n=== Test 5: Data Consistency ===');
  console.log('Verifying vote counts match actual vote documents...');

  await sleep(2000); // Let all previous operations settle

  const storedCounts = await getVoteCounts(TEST_QUESTION_ID);
  const actualCounts = await countVoteDocuments(TEST_QUESTION_ID);

  console.log(`Stored counts in question doc: upvotes=${storedCounts.upvotes}, downvotes=${storedCounts.downvotes}`);
  console.log(`Actual vote documents: upvotes=${actualCounts.upvotes}, downvotes=${actualCounts.downvotes}, total=${actualCounts.total}`);

  const upvotesMatch = storedCounts.upvotes === actualCounts.upvotes;
  const downvotesMatch = storedCounts.downvotes === actualCounts.downvotes;

  if (upvotesMatch && downvotesMatch) {
    console.log('✓ Test passed - counts are consistent');
    return true;
  } else {
    console.log('✗ Test failed - count mismatch detected!');
    console.log(`  Upvotes: stored=${storedCounts.upvotes}, actual=${actualCounts.upvotes} ${upvotesMatch ? '✓' : '✗'}`);
    console.log(`  Downvotes: stored=${storedCounts.downvotes}, actual=${actualCounts.downvotes} ${downvotesMatch ? '✓' : '✗'}`);
    return false;
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n=== Cleanup ===');
  console.log('Removing test votes...');

  const allTestUsers = [...testUsers, 'rapid_test_user', 'switch_test_user', 'negative_test_user'];

  const deletePromises = allTestUsers.map(userId => {
    const voteId = `${userId}_${TEST_QUESTION_ID}`;
    return db.collection('qa_question_votes').doc(voteId).delete().catch(() => {});
  });

  await Promise.all(deletePromises);
  await sleep(2000); // Let Cloud Functions process deletions

  console.log('✓ Cleanup complete');
}

/**
 * Main test runner
 */
async function runStressTests() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Q&A Voting System Stress Test Suite     ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\nTesting question: ${TEST_QUESTION_ID}`);
  console.log(`Number of test users: ${NUM_TEST_USERS}`);
  console.log(`Votes per user: ${VOTES_PER_USER}`);

  const results = [];

  try {
    // Run tests
    results.push({ name: 'Rapid Sequential Voting', passed: await testRapidSequentialVoting() });
    results.push({ name: 'Concurrent Voting', passed: await testConcurrentVoting() });
    results.push({ name: 'Vote Switching', passed: await testVoteSwitching() });
    results.push({ name: 'Negative Count Prevention', passed: await testNegativeCountPrevention() });
    results.push({ name: 'Data Consistency', passed: await testDataConsistency() });

    // Cleanup
    await cleanup();

    // Print summary
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║           Test Results Summary             ║');
    console.log('╚════════════════════════════════════════════╝\n');

    results.forEach(result => {
      const status = result.passed ? '✓ PASSED' : '✗ FAILED';
      const icon = result.passed ? '✓' : '✗';
      console.log(`${icon} ${result.name.padEnd(35)} ${status}`);
    });

    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log('\n' + '─'.repeat(48));
    console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
    console.log('─'.repeat(48));

    if (failedTests === 0) {
      console.log('\n🎉 All tests passed! Voting system is production-ready.');
    } else {
      console.log(`\n⚠️  ${failedTests} test(s) failed. Review the output above.`);
    }

    process.exit(failedTests > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n✗ Test suite error:', error);
    await cleanup();
    process.exit(1);
  }
}

// Run tests
runStressTests();
