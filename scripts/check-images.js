const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkImages() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
  
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .get();
  
  if (snapshot.empty) {
    console.log('No Anki decks found');
    return;
  }
  
  const deck = snapshot.docs[0].data();
  console.log('Deck:', deck.name);
  console.log('Total cards:', deck.cards?.length);
  
  // Count cards with images
  let cardsWithImages = 0;
  let cardsWithAudio = 0;
  let cardsWithImageFilename = 0;
  let cardsWithAudioFilename = 0;
  
  const sampleImages = [];
  const sampleAudio = [];
  
  deck.cards?.forEach((card, i) => {
    if (card.imageUrl) cardsWithImages++;
    if (card.audioUrl) cardsWithAudio++;
    if (card.imageFilename) {
      cardsWithImageFilename++;
      if (sampleImages.length < 3) {
        sampleImages.push({ cardId: card.id, imageFilename: card.imageFilename, imageUrl: card.imageUrl?.substring(0, 50) });
      }
    }
    if (card.audioFilename) {
      cardsWithAudioFilename++;
      if (sampleAudio.length < 3) {
        sampleAudio.push({ cardId: card.id, audioFilename: card.audioFilename, audioUrl: card.audioUrl?.substring(0, 50) });
      }
    }
  });
  
  console.log('\n=== Media Statistics ===');
  console.log('Cards with imageUrl:', cardsWithImages);
  console.log('Cards with audioUrl:', cardsWithAudio);
  console.log('Cards with imageFilename:', cardsWithImageFilename);
  console.log('Cards with audioFilename:', cardsWithAudioFilename);
  
  console.log('\n=== Sample Image Cards ===');
  sampleImages.forEach(s => console.log(s));
  
  console.log('\n=== Sample Audio Cards ===');
  sampleAudio.forEach(s => console.log(s));
}

checkImages().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
