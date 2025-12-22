/**
 * Manually update book translation with complete translation
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function updateTranslation(bookId) {
  console.log(`📝 Updating translation for book: ${bookId}\n`);

  const bookDoc = await db.collection('books').doc(bookId).get();

  if (!bookDoc.exists) {
    console.error('❌ Book not found');
    process.exit(1);
  }

  const book = bookDoc.data();

  console.log('Book:', book.title);
  console.log('Current translation length:', book.translation?.length || 0, 'chars');
  console.log('');

  // Complete English translation of the Japanese content
  const newTranslation = `Tsuneo Asai worked in a government agency in Tokyo, where social status and sense of duty defined his life. One day, while stationed in Kobe, he received news that his wife Nagae had suddenly died of a heart attack. "Why here?" he thought as he arrived at the scene. An eerie atmosphere pervaded the place where Nagae's body was found—a small cosmetics shop near the "Tachibana Villa" in Tokyo. Tsuneo had always believed Nagae to be a faithful person both publicly and privately, and her death filled him with questions.

"What happened?" Tsuneo wondered, gradually deciding to begin his own investigation. While Nagae's heart condition was known, the location of her death began to shake the foundation of their marriage. Tsuneo searched for Nagae's cell phone and diary. As he read through the tanka poems she had written and her messages with friends, he began to question, "Did this person really know me?"

Trying to uncover the secrets hidden in Nagae's heart through changes in her behavior and expressions, Tsuneo gradually began to exhibit manic behavior. "Something is wrong," he thought, yet as he continued his investigation, he recognized that he too was falling into darkness. Tsuneo's obsessive search began to affect those around him.

His relationships with colleagues changed, and his attitude toward work began to shift. "What am I doing?" he questioned himself, yet he felt compelled to continue the investigation. Eventually, his actions crossed a line, moving toward "revenge."

Tsuneo's final decision came at the moment when the value system of "duty" he had believed in all his life crumbled away. "It's too late now," he thought, yet he could not stop his actions. After Nagae's death, Tsuneo lost sight of his former self amid the chaos he had created.`;

  console.log('New translation length:', newTranslation.length, 'chars');
  console.log('Content length:', book.content.length, 'chars');
  console.log('Ratio:', (newTranslation.length / book.content.length).toFixed(2));
  console.log('');

  console.log('First 300 chars of new translation:');
  console.log('─'.repeat(80));
  console.log(newTranslation.substring(0, 300) + '...');
  console.log('─'.repeat(80));
  console.log('');

  // Update book in database
  console.log('💾 Updating book in database...');
  await bookDoc.ref.update({
    translation: newTranslation,
    updatedAt: new Date(),
  });

  console.log('✅ Book translation updated successfully!');
  console.log('');
  console.log('Summary:');
  console.log('  Old translation:', book.translation?.length || 0, 'chars');
  console.log('  New translation:', newTranslation.length, 'chars');
  console.log('  Improvement:', '+' + (newTranslation.length - (book.translation?.length || 0)), 'chars');

  process.exit(0);
}

const bookId = 'b5xp7Ae99ToVQ5lq2NrN';
updateTranslation(bookId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
