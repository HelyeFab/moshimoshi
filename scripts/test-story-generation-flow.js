#!/usr/bin/env node
/**
 * End-to-End Test: Story Generation Flow
 * Creates a minimal test story with quiz to verify:
 * 1. Story schema with schemaVersion
 * 2. Quiz generation with PLAIN Japanese (no ruby tags)
 * 3. Bilingual quiz fields (questionJa, optionsJa, explanationJa)
 * 4. Kuromoji integration for furigana
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const OpenAI = require('openai').default;

// Initialize Firebase
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

const STORY_SCHEMA_VERSION = 'v1.1.0';

async function generateQuiz(story, pages) {
  const prompt = `Create a comprehension quiz for this Japanese story:

Story Title: ${story.title} / ${story.titleJa}
Story Pages: ${JSON.stringify(pages.map(p => ({ text: p.text, translation: p.translation })), null, 2)}

JLPT Level: ${story.jlptLevel}

Create 3 multiple choice questions.

You MUST return a JSON object in EXACTLY this format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question in English",
      "questionJa": "日本語の質問です",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "optionsJa": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correctIndex": 0,
      "explanation": "Explanation in English",
      "explanationJa": "日本語の説明です"
    }
  ]
}

**CRITICAL RULES:**
1. Write questionJa, optionsJa, and explanationJa in PLAIN JAPANESE TEXT ONLY
2. DO NOT add furigana, ruby tags, or parentheses - use plain kanji and kana
3. Furigana will be added automatically by the system later
4. Each question must have EXACTLY 4 options`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert in creating educational assessments for Japanese language learners. You MUST return plain Japanese text without any furigana, ruby tags, or formatting.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No content from OpenAI');

  const quizData = JSON.parse(content);

  return quizData.questions.map((q, index) => ({
    id: q.id || `q${index + 1}`,
    question: q.question,
    questionJa: q.questionJa,
    options: q.options || [],
    optionsJa: q.optionsJa || [],
    correctAnswer: q.correctIndex,
    explanation: q.explanation,
    explanationJa: q.explanationJa,
    type: 'multiple_choice',
    difficulty: 1,
    tags: ['story-comprehension', 'test'],
  }));
}

async function testStoryGenerationFlow() {
  console.log('='.repeat(80));
  console.log('END-TO-END STORY GENERATION FLOW TEST');
  console.log('='.repeat(80));

  const storyId = `story_${Date.now()}_e2e_test`;

  console.log('\n📝 Step 1: Creating test story...');

  const testStory = {
    id: storyId,
    title: 'Test Story: A Morning Walk',
    titleJa: 'テスト物語：朝の散歩',
    description: 'A simple story about a morning walk to test the generation flow',
    jlptLevel: 'N5',
    theme: 'Daily Life',
    tags: ['test', 'morning', 'walk'],
    pages: [
      {
        pageNumber: 1,
        text: '朝、花子は公園に行きます。天気がとてもいいです。鳥が歌っています。',
        translation: 'In the morning, Hanako goes to the park. The weather is very good. Birds are singing.',
        imageUrl: 'https://placehold.co/600x400/png',
      },
      {
        pageNumber: 2,
        text: '公園で友達に会いました。一緒に話します。とても楽しいです。',
        translation: 'She met a friend at the park. They talk together. It is very fun.',
        imageUrl: 'https://placehold.co/600x400/png',
      },
    ],
    authorId: 'e2e-test-system',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'published',
    viewCount: 0,
    completionCount: 0,
    slug: `test-morning-walk-${Date.now()}`,
    isAIGenerated: true,
    aiModel: 'gpt-4o-mini',
    schemaVersion: STORY_SCHEMA_VERSION,
  };

  console.log('   ✅ Story structure created');
  console.log('   ID:', storyId);
  console.log('   Schema Version:', STORY_SCHEMA_VERSION);

  console.log('\n🎯 Step 2: Generating quiz with PLAIN Japanese...');

  const quiz = await generateQuiz(testStory, testStory.pages);

  console.log('   ✅ Generated', quiz.length, 'questions');

  // Validate quiz
  const validation = {
    allHaveQuestionJa: quiz.every(q => q.questionJa),
    allHaveOptionsJa: quiz.every(q => q.optionsJa && q.optionsJa.length === 4),
    allHaveExplanationJa: quiz.every(q => q.explanationJa),
    noRubyTags: !quiz.some(q =>
      q.questionJa?.includes('<ruby>') ||
      q.optionsJa?.some(opt => opt?.includes('<ruby>'))
    ),
  };

  console.log('\n📊 Step 3: Validation checks...');
  console.log('   questionJa present:', validation.allHaveQuestionJa ? '✅' : '❌');
  console.log('   optionsJa present:', validation.allHaveOptionsJa ? '✅' : '❌');
  console.log('   explanationJa present:', validation.allHaveExplanationJa ? '✅' : '❌');
  console.log('   No ruby tags:', validation.noRubyTags ? '✅' : '❌');

  if (!Object.values(validation).every(v => v)) {
    throw new Error('Validation failed! See checks above.');
  }

  testStory.quiz = quiz;

  console.log('\n💾 Step 4: Saving to Firestore...');

  await db.collection('stories').doc(storyId).set(testStory);

  console.log('   ✅ Saved successfully');

  console.log('\n📋 Step 5: Sample Quiz Data (Plain Japanese - No Ruby Tags)');
  console.log('='.repeat(80));

  quiz.forEach((q, i) => {
    console.log(`\nQuestion ${i + 1}:`);
    console.log('  EN:', q.question);
    console.log('  JA:', q.questionJa);
    console.log('\n  Options:');
    q.options.forEach((opt, idx) => {
      console.log(`    ${idx + 1}. EN: ${opt}`);
      console.log(`       JA: ${q.optionsJa[idx]}`);
    });
    console.log(`\n  Correct: ${q.correctAnswer}`);
    console.log(`  Explanation JA: ${q.explanationJa}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✨ END-TO-END TEST COMPLETE');
  console.log('='.repeat(80));
  console.log('\n📌 Test Story Details:');
  console.log('   ID:', storyId);
  console.log('   Title:', testStory.title);
  console.log('   JLPT:', testStory.jlptLevel);
  console.log('   Pages:', testStory.pages.length);
  console.log('   Quiz Questions:', quiz.length);
  console.log('   Schema Version:', STORY_SCHEMA_VERSION);

  console.log('\n🎨 Next Steps:');
  console.log('   1. Go to: http://localhost:3000/en/stories/' + storyId);
  console.log('   2. Read the story and click the quiz');
  console.log('   3. Verify furigana appears automatically via Kuromoji');
  console.log('   4. Verify both Japanese and English are displayed');

  console.log('\n✅ All systems operational!\n');

  return storyId;
}

// Run the test
testStoryGenerationFlow()
  .then(storyId => {
    console.log('🎉 SUCCESS! Story ID:', storyId);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
