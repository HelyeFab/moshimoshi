/**
 * Regenerate translation for a book with incomplete translation
 */

require('dotenv').config();
const admin = require('firebase-admin');
const OpenAI = require('openai').default;
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixBookTranslation(bookId) {
  console.log(`🔧 Fixing translation for book: ${bookId}\n`);

  const bookDoc = await db.collection('books').doc(bookId).get();

  if (!bookDoc.exists) {
    console.error('❌ Book not found');
    process.exit(1);
  }

  const book = bookDoc.data();

  console.log('Current state:');
  console.log('  Content length:', book.content?.length || 0);
  console.log('  Translation length:', book.translation?.length || 0);
  console.log('');

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
  });

  console.log('🤖 Generating full translation with OpenAI...');

  try {
    const translationResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "You are a Japanese-English translator. Translate the following Japanese narrative to natural, fluent English. Preserve the story's flow, emotion, and paragraph structure. Return ONLY the English translation, nothing else.",
        },
        { role: 'user', content: book.content },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const newTranslation = translationResponse.choices[0]?.message?.content?.trim() || '';

    console.log('');
    console.log('✅ Translation generated successfully!');
    console.log('  New translation length:', newTranslation.length);
    console.log('  Ratio:', (newTranslation.length / book.content.length).toFixed(2));
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

    console.log('✅ Book translation fixed successfully!');
    console.log('');
    console.log('Summary:');
    console.log('  Old translation:', book.translation?.length || 0, 'chars');
    console.log('  New translation:', newTranslation.length, 'chars');
    console.log('  Improvement:', newTranslation.length - (book.translation?.length || 0), 'chars');

  } catch (error) {
    console.error('❌ Error generating translation:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

const bookId = process.argv[2];
if (!bookId) {
  console.error('Usage: node scripts/fix-book-translation.js <bookId>');
  console.log('\nExample: node scripts/fix-book-translation.js b5xp7Ae99ToVQ5lq2NrN');
  process.exit(1);
}

fixBookTranslation(bookId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
