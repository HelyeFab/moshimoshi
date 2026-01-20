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
      "questionJa": "この物語について質問です。",
      "options": ["Option A in English", "Option B in English", "Option C in English", "Option D in English"],
      "optionsJa": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct",
      "explanationJa": "説明を日本語で"
    }
  ]
}

**CRITICAL RULES:**
1. BOTH question (English) AND questionJa (Japanese) are REQUIRED for all questions
2. BOTH explanation (English) AND explanationJa (Japanese) are REQUIRED for all questions
3. BOTH options (English) AND optionsJa (Japanese) are REQUIRED for all questions
4. Write questionJa, optionsJa, and explanationJa in PLAIN JAPANESE TEXT ONLY
5. DO NOT add furigana, ruby tags, or parentheses - use plain kanji and kana
6. Furigana will be added automatically by the system later
7. Do NOT reveal the answer in the question text
8. Each question must have EXACTLY 4 options

**PLAIN TEXT Examples (CORRECT):**
- questionJa: "この言葉の意味は何ですか？"
- questionJa: "主人公は誰ですか？"
- questionJa: "物語の最初に何が起こりましたか？"
- optionsJa: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"]

**WRONG (Do NOT use these formats):**
- ❌ "この<ruby>言葉<rt>ことば</rt></ruby>..." (NO ruby tags)
- ❌ "この言葉(ことば)..." (NO parentheses)
- ❌ "このことば..." (Use proper kanji, not all hiragana)`;
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
        content: 'You are an expert in creating educational assessments for Japanese language learners. You MUST return plain Japanese text without any furigana, ruby tags, or formatting.',
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
        optionsJa: q.optionsJa || [],
        correctAnswer: q.correctIndex, // Map correctIndex to correctAnswer
        explanation: q.explanation,
        explanationJa: q.explanationJa,
        type: 'multiple_choice',
        difficulty: calculateQuestionDifficulty(story.jlptLevel),
        tags: ['story-comprehension', story.jlptLevel.toLowerCase()],
      }));

      console.log(`   ✅ Generated ${questions.length} bilingual questions`);

      // Validate bilingual fields
      const missingBilingual = questions.filter(q => !q.questionJa || !q.explanationJa || !q.optionsJa || q.optionsJa.length !== q.options.length);
      if (missingBilingual.length > 0) {
        console.log(`   ⚠️  WARNING: ${missingBilingual.length} questions missing Japanese fields (questionJa, optionsJa, or explanationJa)`);
        missingBilingual.forEach((q, i) => {
          const issues = [];
          if (!q.questionJa) issues.push('questionJa');
          if (!q.explanationJa) issues.push('explanationJa');
          if (!q.optionsJa || q.optionsJa.length !== q.options.length) issues.push('optionsJa');
          console.log(`     Question ${i + 1}: Missing ${issues.join(', ')}`);
        });
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
