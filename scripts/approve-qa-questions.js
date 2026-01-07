/**
 * Script to manually approve pending Q&A questions
 * Usage: node scripts/approve-qa-questions.js
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

async function approvePendingQuestions() {
  try {
    console.log('Fetching pending questions...');

    const snapshot = await db
      .collection('qa_questions')
      .where('moderationStatus', '==', 'pending')
      .get();

    if (snapshot.empty) {
      console.log('No pending questions found.');
      return;
    }

    console.log(`Found ${snapshot.size} pending question(s)`);

    const batch = db.batch();
    const questions = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      questions.push({
        id: doc.id,
        title: data.title,
        author: data.author.name,
      });

      batch.update(doc.ref, {
        moderationStatus: 'approved',
        moderationReason: 'Manually approved by admin',
        moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log('\nQuestions to approve:');
    questions.forEach((q, i) => {
      console.log(`${i + 1}. "${q.title}" by ${q.author} (ID: ${q.id})`);
    });

    console.log('\nApproving all questions...');
    await batch.commit();

    console.log('✅ All questions approved successfully!');
  } catch (error) {
    console.error('❌ Error approving questions:', error);
    process.exit(1);
  }
}

// Run the script
approvePendingQuestions()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
