/**
 * Debug script to test question deletion
 * Simulates the exact logic from the deleteQuestion function
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugDeleteQuestion() {
  const questionId = 'dsQAIGU1OqHldH2IqCKy';
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

  console.log('\n🔍 DEBUG: Question Deletion Test\n');
  console.log(`Question ID: ${questionId}`);
  console.log(`User ID: ${userId}\n`);

  try {
    // Step 1: Get question
    console.log('Step 1: Fetching question...');
    const docRef = db.collection('qa_questions').doc(questionId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      console.log('❌ ERROR: Question not found');
      return;
    }

    const question = snapshot.data();
    console.log(`✅ Question found: "${question.title}"`);
    console.log(`   Author UID: ${question.author?.uid}`);

    // Step 2: Check ownership
    console.log('\nStep 2: Checking ownership...');
    if (question.author?.uid !== userId) {
      console.log(`❌ ERROR: Not the question author`);
      console.log(`   Question author: ${question.author?.uid}`);
      console.log(`   Current user: ${userId}`);
      return;
    }
    console.log('✅ User is the question author');

    // Step 3: Get answers
    console.log('\nStep 3: Fetching answers...');
    const answersSnapshot = await db.collection('qa_answers')
      .where('questionId', '==', questionId)
      .get();

    console.log(`   Found ${answersSnapshot.size} answer(s)`);

    // Step 4: Check for approved answers from others
    console.log('\nStep 4: Checking for approved answers from other users...');
    const approvedAnswersFromOthers = answersSnapshot.docs.filter(doc => {
      const answer = doc.data();
      const isApproved = answer.moderationStatus === 'approved';
      const isFromOtherUser = answer.author?.uid !== userId;

      console.log(`   Answer ${doc.id}:`);
      console.log(`     - Status: ${answer.moderationStatus}`);
      console.log(`     - Author: ${answer.author?.name} (${answer.author?.uid})`);
      console.log(`     - Is approved: ${isApproved}`);
      console.log(`     - Is from other user: ${isFromOtherUser}`);

      return isApproved && isFromOtherUser;
    });

    if (approvedAnswersFromOthers.length > 0) {
      console.log(`\n❌ BLOCKED: ${approvedAnswersFromOthers.length} approved answer(s) from other users`);
      console.log('   Error code: HAS_APPROVED_ANSWERS');
      console.log('   Message: Cannot delete question with approved answers from other users');
      return;
    }

    console.log('✅ No approved answers from other users - deletion allowed');

    // Step 5: Would delete answers
    console.log('\nStep 5: Would delete answers and votes...');
    for (const answerDoc of answersSnapshot.docs) {
      const answer = answerDoc.data();
      console.log(`   - Would delete answer: ${answerDoc.id} (${answer.moderationStatus})`);

      const votesSnapshot = await db.collection('qa_answer_votes')
        .where('answerId', '==', answerDoc.id)
        .get();
      console.log(`     - Would delete ${votesSnapshot.size} vote(s)`);
    }

    // Step 6: Would delete question votes
    console.log('\nStep 6: Would delete question votes...');
    const questionVotesSnapshot = await db.collection('qa_question_votes')
      .where('questionId', '==', questionId)
      .get();
    console.log(`   - Would delete ${questionVotesSnapshot.size} vote(s)`);

    console.log('\n✅ RESULT: Deletion would succeed!');
    console.log('   All checks passed, question can be deleted');

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR:', error.message);
    console.error('Stack trace:', error.stack);
  }

  process.exit(0);
}

debugDeleteQuestion();
