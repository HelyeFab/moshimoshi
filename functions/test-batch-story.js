#!/usr/bin/env node
/**
 * Simple test script to create a story and trigger batch processing
 * Run from functions directory: node test-batch-story.js
 */

const admin = require('firebase-admin');

// Initialize if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function createTestStory() {
  const storyId = `story_${Date.now()}_batch_test`;

  console.log('\n🚀 Creating test story for batch processing...\n');

  const testStory = {
    id: storyId,
    title: 'Test: Batch Word Processing',
    titleJa: 'テスト：バッチ単語処理',
    description: 'Testing batch word explanation generation system',
    jlptLevel: 'N4',
    theme: 'Daily Life',
    tags: ['test', 'batch-processing'],
    pages: [
      {
        pageNumber: 1,
        text: '今日は天気がいいです。公園で友達と遊びます。桜の花が美しいです。春はとても好きです。毎日日本語を勉強します。新しい言葉を学びます。',
        imageUrl: 'https://storage.googleapis.com/moshimoshi-de237.appspot.com/placeholder.jpg',
        imagePrompt: 'A sunny day in a park with cherry blossoms',
        audioUrl: 'https://storage.googleapis.com/moshimoshi-de237.appspot.com/placeholder.mp3'
      },
      {
        pageNumber: 2,
        text: '図書館で本を読みます。先生と話します。質問をします。答えを聞きます。ノートに書きます。とても楽しいです。',
        imageUrl: 'https://storage.googleapis.com/moshimoshi-de237.appspot.com/placeholder.jpg',
        imagePrompt: 'Studying in a library',
        audioUrl: 'https://storage.googleapis.com/moshimoshi-de237.appspot.com/placeholder.mp3'
      },
      {
        pageNumber: 3,
        text: '家に帰ります。夕食を作ります。美味しいご飯を食べます。家族と話します。テレビを見ます。幸せな時間です。',
        imageUrl: 'https://storage.googleapis.com/moshimoshi-de237.appspot.com/placeholder.jpg',
        imagePrompt: 'Family dinner at home',
        audioUrl: 'https://storage.googleapis.com/moshimoshi-de237.appspot.com/placeholder.mp3'
      }
    ],
    authorId: 'batch-test-system',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'published', // Must be 'published' to trigger word generation
    viewCount: 0,
    completionCount: 0,
    slug: `test-batch-${Date.now()}`,
    isAIGenerated: true,
    aiModel: 'test-manual',
  };

  try {
    await db.collection('stories').doc(storyId).set(testStory);

    console.log('✅ Test story created successfully!\n');
    console.log('📋 Story Details:');
    console.log('   ID:', storyId);
    console.log('   Title:', testStory.title);
    console.log('   Pages:', testStory.pages.length);
    console.log('   Status:', testStory.status);
    console.log('\n📊 Expected Batch Processing Flow:');
    console.log('   1. onStoryPublished trigger fires (within 5 seconds)');
    console.log('   2. Words extracted from story text');
    console.log('   3. Batch queue created in Firestore');
    console.log('   4. First batch message published to Pub/Sub');
    console.log('   5. processStoryWordBatch processes batches sequentially');
    console.log('   6. Progress updates in real-time');
    console.log('\n🔍 Monitor Progress:');
    console.log('   Logs: firebase functions:log --only onStoryPublished,processStoryWordBatch');
    console.log('   UI:   Check admin dashboard for pulsing yellow dot');
    console.log('\n⏱️  Estimated Time:');
    console.log('   ~40-50 words expected from story text');
    console.log('   ~2-3 batches of 20 words each');
    console.log('   ~18-27 minutes total (9 min per batch)');

    return storyId;

  } catch (error) {
    console.error('\n❌ Error creating test story:', error);
    throw error;
  }
}

// Run the test
createTestStory()
  .then(storyId => {
    console.log('\n✨ Test initiated successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
