/**
 * Fix answer count for question dsQAIGU1OqHldH2IqCKy
 * Both answers were rejected, so count should be 0
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixAnswerCount() {
  try {
    const questionId = 'dsQAIGU1OqHldH2IqCKy';

    console.log('Fixing answer count for question:', questionId);

    // Update the question to have 0 answers
    await db.collection('qa_questions').doc(questionId).update({
      answerCount: 0
    });

    console.log('✅ Answer count reset to 0');

    // Verify
    const questionDoc = await db.collection('qa_questions').doc(questionId).get();
    const questionData = questionDoc.data();
    console.log('Verified answerCount:', questionData.answerCount);

  } catch (error) {
    console.error('Error fixing answer count:', error);
  } finally {
    process.exit(0);
  }
}

fixAnswerCount();
