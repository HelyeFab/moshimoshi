const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();

async function checkVotes() {
  // Check all questions
  const questions = await db.collection('qa_questions').get();
  console.log('\n=== Questions ===');
  questions.forEach(doc => {
    const data = doc.data();
    console.log(`${doc.id}: upvotes=${data.upvotes}, downvotes=${data.downvotes}, score=${data.upvotes - data.downvotes}`);
  });

  // Check all vote documents
  const questionVotes = await db.collection('qa_question_votes').get();
  console.log('\n=== Vote Documents ===');
  questionVotes.forEach(doc => {
    const data = doc.data();
    console.log(`${doc.id}: questionId=${data.questionId}, userId=${data.userId}, voteType=${data.voteType}`);
  });
}

checkVotes().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
