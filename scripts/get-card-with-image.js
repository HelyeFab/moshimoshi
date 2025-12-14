const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function getCardWithImage() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
  
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .get();
  
  const deck = snapshot.docs[0].data();
  
  // Find first card with image
  const cardWithImage = deck.cards.find(c => c.imageFilename);
  
  if (cardWithImage) {
    console.log('=== Card with Image ===');
    console.log('Card ID:', cardWithImage.id);
    console.log('Front:', cardWithImage.front);
    console.log('Back:', cardWithImage.back);
    console.log('Reading:', cardWithImage.reading);
    console.log('Image filename:', cardWithImage.imageFilename);
    console.log('Audio filename:', cardWithImage.audioFilename);
    console.log('Expression:', cardWithImage.expression);
    console.log('Meaning:', cardWithImage.meaning);
  }
}

getCardWithImage().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
