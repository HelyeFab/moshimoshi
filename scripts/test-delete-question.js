/**
 * Test deleting question with orphaned rejected answers
 * Question ID: dsQAIGU1OqHldH2IqCKy
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testDeleteQuestion() {
  const questionId = 'dsQAIGU1OqHldH2IqCKy';
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2'; // Your user ID from the question

  console.log(`\n🧪 Testing delete question: ${questionId}\n`);

  try {
    // Check current state
    const questionDoc = await db.collection('qa_questions').doc(questionId).get();
    const answersSnapshot = await db.collection('qa_answers')
      .where('questionId', '==', questionId)
      .get();

    console.log('📊 Before deletion:');
    console.log(`   Question exists: ${questionDoc.exists}`);
    console.log(`   Answers: ${answersSnapshot.size}`);

    if (answersSnapshot.size > 0) {
      answersSnapshot.forEach((doc, index) => {
        const answer = doc.data();
        console.log(`   Answer ${index + 1}: ${answer.moderationStatus} (by ${answer.author.name})`);
      });
    }

    console.log('\n🗑️  Simulating deletion logic...\n');

    // Check for approved answers from other users (Option C logic)
    const approvedAnswersFromOthers = answersSnapshot.docs.filter(doc => {
      const answer = doc.data();
      return answer.moderationStatus === 'approved' && answer.author?.uid !== userId;
    });

    if (approvedAnswersFromOthers.length > 0) {
      console.log('❌ Cannot delete: Question has approved answers from other users');
      console.log(`   Found ${approvedAnswersFromOthers.length} approved answer(s) from others\n`);
      return;
    }

    console.log('✅ Deletion check passed: No approved answers from other users');
    console.log('   Auto-cleanup will remove all rejected/pending answers\n');

    // Ask for confirmation before actual deletion
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('❓ Do you want to actually delete this question? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        console.log('\n🗑️  Deleting question and all answers...\n');

        // Delete answer votes
        for (const answerDoc of answersSnapshot.docs) {
          const answerId = answerDoc.id;
          const votesSnapshot = await db.collection('qa_answer_votes')
            .where('answerId', '==', answerId)
            .get();

          console.log(`   Deleting ${votesSnapshot.size} vote(s) for answer ${answerId}`);
          const voteBatch = db.batch();
          votesSnapshot.docs.forEach(voteDoc => voteBatch.delete(voteDoc.ref));
          await voteBatch.commit();
        }

        // Delete answers
        const answerBatch = db.batch();
        answersSnapshot.docs.forEach(answerDoc => answerBatch.delete(answerDoc.ref));
        await answerBatch.commit();
        console.log(`   Deleted ${answersSnapshot.size} answer(s)`);

        // Delete question votes
        const questionVotesSnapshot = await db.collection('qa_question_votes')
          .where('questionId', '==', questionId)
          .get();
        console.log(`   Deleting ${questionVotesSnapshot.size} vote(s) for question`);
        const questionVoteBatch = db.batch();
        questionVotesSnapshot.docs.forEach(voteDoc => questionVoteBatch.delete(voteDoc.ref));
        await questionVoteBatch.commit();

        // Delete question
        await db.collection('qa_questions').doc(questionId).delete();
        console.log(`   Deleted question ${questionId}\n`);

        console.log('✅ Deletion complete!\n');
      } else {
        console.log('\n⏭️  Skipped deletion\n');
      }

      readline.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testDeleteQuestion();
