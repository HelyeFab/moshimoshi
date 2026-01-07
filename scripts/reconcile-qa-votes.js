#!/usr/bin/env node
/**
 * Q&A Vote Reconciliation Script
 *
 * Fixes vote count discrepancies by counting actual vote documents
 * and updating the stored counts in question/answer documents.
 *
 * Run this:
 * - As a cron job (every 5 minutes in production)
 * - After detecting inconsistencies
 * - During maintenance windows
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

/**
 * Reconcile votes for a single question
 */
async function reconcileQuestion(questionId) {
  // Count actual vote documents
  const votesSnapshot = await db.collection('qa_question_votes')
    .where('questionId', '==', questionId)
    .get();

  let actualUpvotes = 0;
  let actualDownvotes = 0;

  votesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.voteType === 'upvote') actualUpvotes++;
    if (data.voteType === 'downvote') actualDownvotes++;
  });

  // Get stored counts
  const questionDoc = await db.collection('qa_questions').doc(questionId).get();
  if (!questionDoc.exists) {
    console.log(`⚠️  Question ${questionId} not found, skipping`);
    return { fixed: false, questionId };
  }

  const questionData = questionDoc.data();
  const storedUpvotes = questionData.upvotes || 0;
  const storedDownvotes = questionData.downvotes || 0;

  // Check if reconciliation needed
  if (storedUpvotes === actualUpvotes && storedDownvotes === actualDownvotes) {
    return { fixed: false, questionId, status: 'consistent' };
  }

  // Fix the counts
  await db.collection('qa_questions').doc(questionId).update({
    upvotes: actualUpvotes,
    downvotes: actualDownvotes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    fixed: true,
    questionId,
    before: { upvotes: storedUpvotes, downvotes: storedDownvotes },
    after: { upvotes: actualUpvotes, downvotes: actualDownvotes },
    diff: {
      upvotes: actualUpvotes - storedUpvotes,
      downvotes: actualDownvotes - storedDownvotes,
    },
  };
}

/**
 * Reconcile votes for a single answer
 */
async function reconcileAnswer(answerId) {
  // Count actual vote documents
  const votesSnapshot = await db.collection('qa_answer_votes')
    .where('answerId', '==', answerId)
    .get();

  let actualUpvotes = 0;
  let actualDownvotes = 0;

  votesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.voteType === 'upvote') actualUpvotes++;
    if (data.voteType === 'downvote') actualDownvotes++;
  });

  // Get stored counts
  const answerDoc = await db.collection('qa_answers').doc(answerId).get();
  if (!answerDoc.exists) {
    console.log(`⚠️  Answer ${answerId} not found, skipping`);
    return { fixed: false, answerId };
  }

  const answerData = answerDoc.data();
  const storedUpvotes = answerData.upvotes || 0;
  const storedDownvotes = answerData.downvotes || 0;

  // Check if reconciliation needed
  if (storedUpvotes === actualUpvotes && storedDownvotes === actualDownvotes) {
    return { fixed: false, answerId, status: 'consistent' };
  }

  // Fix the counts
  await db.collection('qa_answers').doc(answerId).update({
    upvotes: actualUpvotes,
    downvotes: actualDownvotes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    fixed: true,
    answerId,
    before: { upvotes: storedUpvotes, downvotes: storedDownvotes },
    after: { upvotes: actualUpvotes, downvotes: actualDownvotes },
    diff: {
      upvotes: actualUpvotes - storedUpvotes,
      downvotes: actualDownvotes - storedDownvotes,
    },
  };
}

/**
 * Reconcile all questions
 */
async function reconcileAllQuestions() {
  console.log('Fetching all questions...');
  const questionsSnapshot = await db.collection('qa_questions').get();
  console.log(`Found ${questionsSnapshot.size} questions\n`);

  const results = [];

  for (const doc of questionsSnapshot.docs) {
    const result = await reconcileQuestion(doc.id);
    results.push(result);

    if (result.fixed) {
      console.log(`✓ Fixed question ${doc.id}:`);
      console.log(`  Before: upvotes=${result.before.upvotes}, downvotes=${result.before.downvotes}`);
      console.log(`  After:  upvotes=${result.after.upvotes}, downvotes=${result.after.downvotes}`);
      console.log(`  Diff:   upvotes=${result.diff.upvotes > 0 ? '+' : ''}${result.diff.upvotes}, downvotes=${result.diff.downvotes > 0 ? '+' : ''}${result.diff.downvotes}\n`);
    }
  }

  return results;
}

/**
 * Reconcile all answers
 */
async function reconcileAllAnswers() {
  console.log('Fetching all answers...');
  const answersSnapshot = await db.collection('qa_answers').get();
  console.log(`Found ${answersSnapshot.size} answers\n`);

  const results = [];

  for (const doc of answersSnapshot.docs) {
    const result = await reconcileAnswer(doc.id);
    results.push(result);

    if (result.fixed) {
      console.log(`✓ Fixed answer ${doc.id}:`);
      console.log(`  Before: upvotes=${result.before.upvotes}, downvotes=${result.before.downvotes}`);
      console.log(`  After:  upvotes=${result.after.upvotes}, downvotes=${result.after.downvotes}`);
      console.log(`  Diff:   upvotes=${result.diff.upvotes > 0 ? '+' : ''}${result.diff.upvotes}, downvotes=${result.diff.downvotes > 0 ? '+' : ''}${result.diff.downvotes}\n`);
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();

  console.log('╔════════════════════════════════════════════╗');
  console.log('║      Q&A Vote Reconciliation Script       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    // Reconcile questions
    console.log('=== Reconciling Questions ===\n');
    const questionResults = await reconcileAllQuestions();

    // Reconcile answers
    console.log('=== Reconciling Answers ===\n');
    const answerResults = await reconcileAllAnswers();

    // Print summary
    const questionsFixed = questionResults.filter(r => r.fixed).length;
    const questionsConsistent = questionResults.filter(r => r.status === 'consistent').length;
    const answersFixed = answerResults.filter(r => r.fixed).length;
    const answersConsistent = answerResults.filter(r => r.status === 'consistent').length;

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║              Summary                       ║');
    console.log('╚════════════════════════════════════════════╝\n');

    console.log('Questions:');
    console.log(`  ✓ Fixed: ${questionsFixed}`);
    console.log(`  ✓ Already consistent: ${questionsConsistent}`);
    console.log(`  Total: ${questionResults.length}\n`);

    console.log('Answers:');
    console.log(`  ✓ Fixed: ${answersFixed}`);
    console.log(`  ✓ Already consistent: ${answersConsistent}`);
    console.log(`  Total: ${answerResults.length}\n`);

    const totalFixed = questionsFixed + answersFixed;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`Completed in ${duration}s`);

    if (totalFixed > 0) {
      console.log(`\n⚠️  ${totalFixed} vote count(s) were corrected`);
      console.log('Consider running this script regularly as a cron job.');
    } else {
      console.log('\n✓ All vote counts are consistent!');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error during reconciliation:', error);
    process.exit(1);
  }
}

main();
