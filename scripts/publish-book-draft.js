/**
 * Manually publish a book draft to the books collection
 * Usage: node scripts/publish-book-draft.js <draftId>
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function publishDraft(draftId) {
  console.log(`📖 Publishing book draft: ${draftId}\n`);

  // Get the draft
  const draftDoc = await db.collection('book_drafts').doc(draftId).get();

  if (!draftDoc.exists) {
    console.error('❌ Draft not found:', draftId);
    process.exit(1);
  }

  const draftData = draftDoc.data();

  console.log('Draft info:');
  console.log('  Book Name:', draftData.bookName);
  console.log('  Status:', draftData.status);
  console.log('  Progress:', draftData.metadata?.progress);
  console.log();

  // Validate required fields
  const missingFields = [];
  if (!draftData.title) missingFields.push('title');
  if (!draftData.titleJa) missingFields.push('titleJa');
  if (!draftData.content) missingFields.push('content');
  if (!draftData.summary) missingFields.push('summary');
  if (!draftData.bookName) missingFields.push('bookName');
  if (!draftData.jlptLevel) missingFields.push('jlptLevel');

  if (missingFields.length > 0) {
    console.error('❌ Draft is missing required fields:', missingFields.join(', '));
    process.exit(1);
  }

  // Create book document
  const bookId = draftId; // Use same ID for consistency
  const book = {
    title: draftData.title,
    titleJa: draftData.titleJa,
    bookName: draftData.bookName,
    content: draftData.content,
    summary: draftData.summary,
    jlptLevel: draftData.jlptLevel,
    tags: draftData.tags || [],
    createdAt: draftData.createdAt || new Date(),
    updatedAt: new Date(),
    createdBy: draftData.createdBy,
    status: 'published',
    viewCount: 0,
    readCount: 0,
    metadata: {
      wordCount: draftData.content?.length || 0,
      readingTime: Math.ceil((draftData.content?.length || 0) / 200) // Japanese: ~200 chars/min
    }
  };

  // Add optional fields only if they exist
  if (draftData.author) book.author = draftData.author;
  if (draftData.translation) book.translation = draftData.translation;
  if (draftData.coverImageUrl) book.coverImageUrl = draftData.coverImageUrl;
  if (draftData.audioUrl) book.audioUrl = draftData.audioUrl;
  if (draftData.category) book.category = draftData.category;
  if (draftData.metadata?.generationModel) book.metadata.generationModel = draftData.metadata.generationModel;
  if (draftData.metadata?.coverGenerated !== undefined) book.metadata.coverGenerated = draftData.metadata.coverGenerated;
  if (draftData.metadata?.audioCached !== undefined) book.metadata.audioCached = draftData.metadata.audioCached;
  if (draftData.metadata?.audioGeneratedAt) book.metadata.audioGeneratedAt = draftData.metadata.audioGeneratedAt;

  console.log('Publishing to books collection...');

  // Save to books collection
  await db.collection('books').doc(bookId).set(book);

  // Update draft status
  await draftDoc.ref.update({
    status: 'published',
    updatedAt: new Date()
  });

  console.log();
  console.log('✅ Book published successfully!');
  console.log('   Book ID:', bookId);
  console.log('   Title:', book.title);
  console.log('   Title (Japanese):', book.titleJa);
  console.log('   Content length:', book.content.length, 'chars');
  console.log('   Has audio:', !!book.audioUrl);
  console.log('   Has cover:', !!book.coverImageUrl);
  console.log();

  process.exit(0);
}

const draftId = process.argv[2];
if (!draftId) {
  console.error('Usage: node scripts/publish-book-draft.js <draftId>');
  console.log('\nRecent drafts:');
  console.log('  eqX6J0aL2Ww6xuEBiRrL (most recent)');
  console.log('  ZBcujYHsJUAu7HpkSSrl');
  process.exit(1);
}

publishDraft(draftId).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
