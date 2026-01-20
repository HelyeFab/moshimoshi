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

function buildStoryQuizPrompt(story, pages) {
  return `Create a comprehension quiz for this Japanese story:

Story Title: ${story.title} / ${story.titleJa}
Story Pages: ${JSON.stringify(
    pages.map((p) => ({
      text: p.text,
      translation: p.translation,
    })),
    null,
    2
  )}

JLPT Level: ${story.jlptLevel}

Create 5-8 multiple choice questions that test:
1. Reading comprehension
2. Vocabulary understanding
3. Grammar recognition
4. Story sequence
5. Character understanding

Questions should be appropriate for ${story.jlptLevel} learners.

You MUST return a JSON object in EXACTLY this format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question in English",
      "questionJa": "この<ruby>物語<rt>ものがたり</rt></ruby>について<ruby>質問<rt>しつもん</rt></ruby>です。",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct",
      "explanationJa": "<ruby>説明<rt>せつめい</rt></ruby>を<ruby>日本語<rt>にほんご</rt></ruby>で"
    }
  ]
}

**CRITICAL RULES:**
1. BOTH question (English) AND questionJa (Japanese) are REQUIRED for all questions
2. BOTH explanation (English) AND explanationJa (Japanese) are REQUIRED for all questions
3. questionJa must wrap ALL kanji in <ruby> tags with furigana: <ruby>漢字<rt>かんじ</rt></ruby>
4. Do NOT use parentheses format - use <ruby><rt> tags only
5. Do NOT reveal the answer in the question text
6. Each question must have EXACTLY 4 options

**Ruby Tag Examples:**
- この<ruby>言葉<rt>ことば</rt></ruby>の<ruby>意味<rt>いみ</rt></ruby>は<ruby>何<rt>なん</rt></ruby>ですか？
- <ruby>主人公<rt>しゅじんこう</rt></ruby>は<ruby>誰<rt>だれ</rt></ruby>ですか？
- <ruby>物語<rt>ものがたり</rt></ruby>の<ruby>最初<rt>さいしょ</rt></ruby>に<ruby>何<rt>なに</rt></ruby>が<ruby>起<rt>お</rt></ruby>こりましたか？`;
}

function calculateQuestionDifficulty(jlptLevel) {
  const levelMap = {
    N5: 1,
    N4: 2,
    N3: 3,
    N2: 4,
    N1: 5
  };
  return levelMap[jlptLevel] || 3;
}

async function generateQuiz(prompt) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert in creating educational assessments for Japanese language learners.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from OpenAI');
  }

  return JSON.parse(content);
}

async function regenerateStoryQuizzes() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Regenerating All Story Quizzes ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`);

  // 1. Get all published stories
  const storiesSnapshot = await db.collection('stories')
    .where('status', '==', 'published')
    .orderBy('publishedAt', 'desc')
    .get();

  console.log(`Found ${storiesSnapshot.size} published stories\n`);

  const results = {
    total: storiesSnapshot.size,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  // 2. Process each story
  for (const doc of storiesSnapshot.docs) {
    const story = doc.data();
    const storyId = doc.id;

    console.log(`\n📖 Story: ${story.title} (${story.titleJa})`);
    console.log(`   ID: ${storyId}`);
    console.log(`   JLPT: ${story.jlptLevel}`);
    console.log(`   Pages: ${story.pages?.length || 0}`);

    // Validate story has pages
    if (!story.pages || story.pages.length === 0) {
      console.log('   ⚠️  SKIPPED: No pages found');
      results.skipped++;
      continue;
    }

    try {
      // Generate new quiz
      console.log('   🔄 Generating bilingual quiz...');

      const prompt = buildStoryQuizPrompt(story, story.pages);
      const quizData = await generateQuiz(prompt);

      if (!quizData.questions || quizData.questions.length === 0) {
        throw new Error('No questions generated');
      }

      // Transform questions to match expected format
      const questions = quizData.questions.map((q, index) => ({
        id: q.id || `q${index + 1}`,
        question: q.question,
        questionJa: q.questionJa,
        options: q.options || [],
        correctAnswer: q.correctIndex, // Map correctIndex to correctAnswer
        explanation: q.explanation,
        explanationJa: q.explanationJa,
        type: 'multiple_choice',
        difficulty: calculateQuestionDifficulty(story.jlptLevel),
        tags: ['story-comprehension', story.jlptLevel.toLowerCase()],
      }));

      console.log(`   ✅ Generated ${questions.length} bilingual questions`);

      // Validate bilingual fields
      const missingBilingual = questions.filter(q => !q.questionJa || !q.explanationJa);
      if (missingBilingual.length > 0) {
        console.log(`   ⚠️  WARNING: ${missingBilingual.length} questions missing Japanese fields`);
      }

      // Show sample question
      if (questions.length > 0) {
        const sample = questions[0];
        console.log(`   Sample Question:`);
        console.log(`     EN: ${sample.question}`);
        console.log(`     JA: ${sample.questionJa?.substring(0, 80)}...`);
      }

      // Update Firestore (unless dry run)
      if (!dryRun) {
        await db.collection('stories').doc(storyId).update({
          quiz: questions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('   💾 Updated in Firestore');
      } else {
        console.log('   🔍 DRY RUN: Would update Firestore');
      }

      results.success++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      results.failed++;
      results.errors.push({
        storyId,
        title: story.title,
        error: error.message
      });
    }
  }

  // 3. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total stories: ${results.total}`);
  console.log(`Successfully regenerated: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.title} (${err.storyId}): ${err.error}`);
    });
  }

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('To actually regenerate quizzes, run:');
    console.log('  node scripts/regenerate-story-quizzes.js');
  } else {
    console.log('\n✅ Quiz regeneration completed!');
  }
}

// Run the script
regenerateStoryQuizzes()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
