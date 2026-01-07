const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixNegativeVotes() {
  try {
    const questionsSnap = await db.collection('qa_questions').get();
    const answersSnap = await db.collection('qa_answers').get();
    const batch = db.batch();
    let fixed = 0;

    questionsSnap.forEach(doc => {
      const data = doc.data();
      if (data.upvotes < 0 || data.downvotes < 0) {
        console.log(`Fixing question "${data.title}": upvotes=${data.upvotes}, downvotes=${data.downvotes}`);
        batch.update(doc.ref, {
          upvotes: 0,
          downvotes: 0,
        });
        fixed++;
      }
    });

    answersSnap.forEach(doc => {
      const data = doc.data();
      if (data.upvotes < 0 || data.downvotes < 0) {
        console.log(`Fixing answer by ${data.author.name}: upvotes=${data.upvotes}, downvotes=${data.downvotes}`);
        batch.update(doc.ref, {
          upvotes: 0,
          downvotes: 0,
        });
        fixed++;
      }
    });

    if (fixed > 0) {
      await batch.commit();
      console.log(`✅ Fixed ${fixed} items with negative vote counts!`);
    } else {
      console.log('✅ No negative vote counts found!');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixNegativeVotes().then(() => process.exit(0));
