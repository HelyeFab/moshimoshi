require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const OpenAI = require('openai').default;

// Initialize Firebase with service account
const serviceAccount = require('../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}
const db = admin.firestore();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function translateText(japaneseText, context = '') {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional Japanese to English translator. Provide natural, accurate translations suitable for language learners.',
        },
        {
          role: 'user',
          content: `Translate this Japanese text to English${context ? ` (Context: ${context})` : ''}:\n\n${japaneseText}`,
        },
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Translation error:', error.message);
    throw error;
  }
}

async function addTranslationsToStories() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Add Translations to Story Pages ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`);

  // Get all published stories
  const storiesSnapshot = await db.collection('stories')
    .where('status', '==', 'published')
    .get();

  console.log(`Found ${storiesSnapshot.size} published stories\n`);

  const results = {
    total: storiesSnapshot.size,
    storiesUpdated: 0,
    pagesUpdated: 0,
    alreadyComplete: 0,
    errors: []
  };

  // Process each story
  for (const doc of storiesSnapshot.docs) {
    const story = doc.data();
    const storyId = doc.id;

    console.log(`\n📖 Story: ${story.title}`);
    console.log(`   ID: ${storyId}`);
    console.log(`   Pages: ${story.pages?.length || 0}`);

    if (!story.pages || story.pages.length === 0) {
      console.log('   ⚠️  SKIPPED: No pages found');
      continue;
    }

    let storyNeedsUpdate = false;
    const updatedPages = [];

    // Check each page
    for (let i = 0; i < story.pages.length; i++) {
      const page = story.pages[i];
      const pageNum = i + 1;

      // Check if page already has translation
      if (page.translation && page.translation.trim() !== '') {
        console.log(`   ✅ Page ${pageNum}: Already has translation`);
        updatedPages.push(page);
        continue;
      }

      console.log(`   🔄 Page ${pageNum}: Missing translation, generating...`);
      storyNeedsUpdate = true;

      try {
        // Generate translation
        const translation = await translateText(
          page.text,
          `Story: ${story.title}, JLPT Level: ${story.jlptLevel}`
        );

        console.log(`   ✅ Page ${pageNum}: Generated translation`);
        console.log(`      JP: ${page.text.substring(0, 60)}...`);
        console.log(`      EN: ${translation.substring(0, 60)}...`);

        // Create updated page
        updatedPages.push({
          ...page,
          translation
        });

        results.pagesUpdated++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`   ❌ Page ${pageNum}: Failed to translate - ${error.message}`);
        // Keep the page as-is if translation fails
        updatedPages.push(page);
        results.errors.push({
          storyId,
          title: story.title,
          pageNum,
          error: error.message
        });
      }
    }

    // Update story if any pages were modified
    if (storyNeedsUpdate) {
      if (!dryRun) {
        try {
          await db.collection('stories').doc(storyId).update({
            pages: updatedPages,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`   💾 Updated story in Firestore`);
          results.storiesUpdated++;
        } catch (error) {
          console.log(`   ❌ Failed to update story: ${error.message}`);
          results.errors.push({
            storyId,
            title: story.title,
            error: error.message
          });
        }
      } else {
        console.log(`   🔍 DRY RUN: Would update story`);
        results.storiesUpdated++;
      }
    } else {
      console.log(`   ✅ All pages already have translations`);
      results.alreadyComplete++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total stories: ${results.total}`);
  console.log(`Stories updated: ${results.storiesUpdated}`);
  console.log(`Pages updated: ${results.pagesUpdated}`);
  console.log(`Stories already complete: ${results.alreadyComplete}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.title} (${err.storyId})${err.pageNum ? ` Page ${err.pageNum}` : ''}: ${err.error}`);
    });
  }

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('To actually add translations, run:');
    console.log('  node scripts/add-translations-to-stories.js');
  } else {
    console.log('\n✅ Translation migration completed!');
  }
}

// Run the script
addTranslationsToStories()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
