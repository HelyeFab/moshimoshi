/**
 * Check answer moderation status
 * Debug script to see why answers aren't showing up
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

async function checkAnswers() {
  try {
    console.log('\n=== Checking All Answers ===\n');

    // Get all answers (without moderation filter)
    const answersSnapshot = await db
      .collection('qa_answers')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    if (answersSnapshot.empty) {
      console.log('No answers found in database');
      return;
    }

    console.log(`Found ${answersSnapshot.size} recent answers:\n`);

    for (const doc of answersSnapshot.docs) {
      const data = doc.data();
      console.log(`Answer ID: ${doc.id}`);
      console.log(`  Question ID: ${data.questionId}`);
      console.log(`  Content: ${data.content.substring(0, 100)}...`);
      console.log(`  Moderation Status: ${data.moderationStatus}`);
      console.log(`  Moderation Reason: ${data.moderationReason || 'N/A'}`);
      console.log(`  Author: ${data.author.name}`);
      console.log(`  Created: ${data.createdAt?.toDate?.()}`);
      console.log(`  Upvotes: ${data.upvotes} | Downvotes: ${data.downvotes}`);
      console.log(`  Accepted: ${data.accepted}`);
      console.log('');

      // Check associated question
      const questionDoc = await db.collection('qa_questions').doc(data.questionId).get();
      if (questionDoc.exists) {
        const questionData = questionDoc.data();
        console.log(`  → Question Answer Count: ${questionData.answerCount}`);
        console.log('');
      }
    }

    // Also check pending answers specifically
    console.log('\n=== Checking Pending Answers ===\n');
    const pendingSnapshot = await db
      .collection('qa_answers')
      .where('moderationStatus', '==', 'pending')
      .get();

    console.log(`Found ${pendingSnapshot.size} pending answers`);

    // Check rejected answers
    console.log('\n=== Checking Rejected Answers ===\n');
    const rejectedSnapshot = await db
      .collection('qa_answers')
      .where('moderationStatus', '==', 'rejected')
      .get();

    console.log(`Found ${rejectedSnapshot.size} rejected answers`);

    // Check approved answers
    console.log('\n=== Checking Approved Answers ===\n');
    const approvedSnapshot = await db
      .collection('qa_answers')
      .where('moderationStatus', '==', 'approved')
      .get();

    console.log(`Found ${approvedSnapshot.size} approved answers`);

  } catch (error) {
    console.error('Error checking answers:', error);
  } finally {
    process.exit(0);
  }
}

checkAnswers();
