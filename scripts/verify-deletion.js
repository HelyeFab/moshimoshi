/**
 * Verify question deletion in Firebase
 * Question ID: dsQAIGU1OqHldH2IqCKy
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyDeletion() {
  const questionId = 'dsQAIGU1OqHldH2IqCKy';

  console.log(`\n🔍 Verifying deletion of question: ${questionId}\n`);

  try {
    // Check if question exists
    console.log('Step 1: Checking if question exists...');
    const questionDoc = await db.collection('qa_questions').doc(questionId).get();

    if (questionDoc.exists) {
      console.log('❌ QUESTION STILL EXISTS');
      const data = questionDoc.data();
      console.log(`   Title: ${data.title}`);
      console.log(`   Author: ${data.author.name}`);
      console.log(`   Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
    } else {
      console.log('✅ Question has been deleted');
    }

    // Check for answers
    console.log('\nStep 2: Checking for answers...');
    const answersSnapshot = await db.collection('qa_answers')
      .where('questionId', '==', questionId)
      .get();

    if (answersSnapshot.empty) {
      console.log('✅ No answers found (all deleted)');
    } else {
      console.log(`❌ FOUND ${answersSnapshot.size} ORPHANED ANSWER(S):`);
      answersSnapshot.forEach((doc, index) => {
        const answer = doc.data();
        console.log(`   Answer ${index + 1}:`);
        console.log(`     ID: ${doc.id}`);
        console.log(`     Author: ${answer.author.name}`);
        console.log(`     Status: ${answer.moderationStatus}`);
        console.log(`     Content: ${answer.content.substring(0, 50)}...`);
      });
    }

    // Check for question votes
    console.log('\nStep 3: Checking for question votes...');
    const questionVotesSnapshot = await db.collection('qa_question_votes')
      .where('questionId', '==', questionId)
      .get();

    if (questionVotesSnapshot.empty) {
      console.log('✅ No question votes found (all deleted)');
    } else {
      console.log(`❌ FOUND ${questionVotesSnapshot.size} ORPHANED VOTE(S)`);
    }

    // Check for answer votes (if there were any)
    console.log('\nStep 4: Checking for answer votes...');
    let totalAnswerVotes = 0;

    // We need to check by answer IDs if we know them
    // Since we know the answer IDs from earlier: GMN2ddLNX1Y1au80yIb7 and mAibyPCoGa02vCoLMjmb
    const knownAnswerIds = ['GMN2ddLNX1Y1au80yIb7', 'mAibyPCoGa02vCoLMjmb'];

    for (const answerId of knownAnswerIds) {
      const votesSnapshot = await db.collection('qa_answer_votes')
        .where('answerId', '==', answerId)
        .get();
      totalAnswerVotes += votesSnapshot.size;
    }

    if (totalAnswerVotes === 0) {
      console.log('✅ No answer votes found (all deleted)');
    } else {
      console.log(`❌ FOUND ${totalAnswerVotes} ORPHANED ANSWER VOTE(S)`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(50));

    const questionDeleted = !questionDoc.exists;
    const answersDeleted = answersSnapshot.empty;
    const questionVotesDeleted = questionVotesSnapshot.empty;
    const answerVotesDeleted = totalAnswerVotes === 0;

    console.log(`Question deleted:        ${questionDeleted ? '✅ YES' : '❌ NO'}`);
    console.log(`Answers deleted:         ${answersDeleted ? '✅ YES' : '❌ NO'}`);
    console.log(`Question votes deleted:  ${questionVotesDeleted ? '✅ YES' : '❌ NO'}`);
    console.log(`Answer votes deleted:    ${answerVotesDeleted ? '✅ YES' : '❌ NO'}`);

    if (questionDeleted && answersDeleted && questionVotesDeleted && answerVotesDeleted) {
      console.log('\n🎉 SUCCESS: Everything has been properly deleted!\n');
    } else {
      console.log('\n⚠️  WARNING: Some data still exists in Firebase!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

verifyDeletion();
