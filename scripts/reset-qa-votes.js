#!/usr/bin/env node
/**
 * Reset vote counts for Q&A questions and answers
 * Usage: node scripts/reset-qa-votes.js [questionId]
 * If no questionId provided, resets ALL questions
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

async function resetQuestionVotes(questionId) {
  console.log(`\nResetting votes for question: ${questionId}`);

  // Reset question vote counts
  await db.collection('qa_questions').doc(questionId).update({
    upvotes: 0,
    downvotes: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Delete all vote documents for this question
  const votesSnapshot = await db.collection('qa_question_votes')
    .where('questionId', '==', questionId)
    .get();

  const batch = db.batch();
  votesSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  console.log(`✅ Reset question ${questionId}: 0 upvotes, 0 downvotes, deleted ${votesSnapshot.size} vote records`);
}

async function resetAllQuestions() {
  console.log('\nResetting votes for ALL questions...');

  const questionsSnapshot = await db.collection('qa_questions').get();

  for (const doc of questionsSnapshot.docs) {
    await resetQuestionVotes(doc.id);
  }

  console.log(`\n✅ Reset complete! Processed ${questionsSnapshot.size} questions`);
}

async function resetAnswerVotes(answerId) {
  console.log(`\nResetting votes for answer: ${answerId}`);

  // Reset answer vote counts
  await db.collection('qa_answers').doc(answerId).update({
    upvotes: 0,
    downvotes: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Delete all vote documents for this answer
  const votesSnapshot = await db.collection('qa_answer_votes')
    .where('answerId', '==', answerId)
    .get();

  const batch = db.batch();
  votesSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  console.log(`✅ Reset answer ${answerId}: 0 upvotes, 0 downvotes, deleted ${votesSnapshot.size} vote records`);
}

async function main() {
  const questionId = process.argv[2];

  if (questionId) {
    await resetQuestionVotes(questionId);
  } else {
    await resetAllQuestions();
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
