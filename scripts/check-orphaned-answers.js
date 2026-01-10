/**
 * Check for orphaned answers in Firebase
 * Question ID: dsQAIGU1OqHldH2IqCKy
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkOrphanedAnswers() {
  const questionId = 'dsQAIGU1OqHldH2IqCKy';

  console.log(`\n🔍 Checking Firebase for answers to question: ${questionId}\n`);

  try {
    // Get the question
    const questionDoc = await db.collection('qa_questions').doc(questionId).get();

    if (!questionDoc.exists) {
      console.log('❌ Question not found in Firebase');
      return;
    }

    const questionData = questionDoc.data();
    console.log('📝 Question found:');
    console.log(`   Title: ${questionData.title}`);
    console.log(`   Author: ${questionData.author.name} (${questionData.author.uid})`);
    console.log(`   Answer Count (stored): ${questionData.answerCount}`);
    console.log(`   Moderation Status: ${questionData.moderationStatus}\n`);

    // Query for all answers (including rejected/pending ones)
    const answersSnapshot = await db.collection('qa_answers')
      .where('questionId', '==', questionId)
      .get();

    console.log(`📊 Actual answers in Firebase: ${answersSnapshot.size}\n`);

    if (answersSnapshot.empty) {
      console.log('✅ No answers found - question can be deleted\n');
    } else {
      console.log('📋 Answer details:\n');

      answersSnapshot.forEach((doc, index) => {
        const answer = doc.data();
        console.log(`   Answer ${index + 1}:`);
        console.log(`     ID: ${doc.id}`);
        console.log(`     Author: ${answer.author.name} (${answer.author.uid})`);
        console.log(`     Moderation Status: ${answer.moderationStatus}`);
        console.log(`     Created: ${answer.createdAt?.toDate?.() || answer.createdAt}`);
        console.log(`     Content: ${answer.content.substring(0, 100)}...`);
        console.log('');
      });

      // Check for moderation status breakdown
      const approved = answersSnapshot.docs.filter(d => d.data().moderationStatus === 'approved').length;
      const pending = answersSnapshot.docs.filter(d => d.data().moderationStatus === 'pending').length;
      const rejected = answersSnapshot.docs.filter(d => d.data().moderationStatus === 'rejected').length;

      console.log('📈 Answer status breakdown:');
      console.log(`   ✅ Approved: ${approved}`);
      console.log(`   ⏳ Pending: ${pending}`);
      console.log(`   ❌ Rejected: ${rejected}\n`);

      console.log('💡 Diagnosis:');
      if (approved === 0 && (pending > 0 || rejected > 0)) {
        console.log('   ⚠️  ORPHANED ANSWERS: All answers are non-approved (pending/rejected)');
        console.log('   👉 UI only shows approved answers, so they appear hidden');
        console.log('   👉 These orphaned answers prevent question deletion\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkOrphanedAnswers();
