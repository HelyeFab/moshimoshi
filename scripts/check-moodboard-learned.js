const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.resolve(__dirname, '..', 'moshimoshi-service-account.json');

function initAdmin() {
  if (admin.apps.length) return;
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function main() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
  initAdmin();

  const db = admin.firestore();
  const progressRef = db
    .collection('users')
    .doc(userId)
    .collection('progress')
    .where('contentType', '==', 'moodboard');

  const snapshot = await progressRef.get();

  if (snapshot.empty) {
    console.log('No moodboard progress found for user:', userId);
    return;
  }

  const learned = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const status = data.status;
    if (status === 'learned' || status === 'mastered') {
      learned.push({
        id: doc.id,
        boardId: data.boardId || null,
        kanjiChar: data.kanjiChar || null,
        updatedAt: data.updatedAt || null,
      });
    }
  });

  console.log('Learned moodboard kanji count:', learned.length);
  learned
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 50)
    .forEach((item) => {
      console.log(`- ${item.kanjiChar || 'n/a'} (board: ${item.boardId || 'n/a'}) id: ${item.id}`);
    });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exitCode = 1;
});
