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

async function regenerateOneQuiz() {
  const storyId = 'story_1768694424281_scheduler-system'; // Making New Friends

  console.log('=== Regenerating Quiz for Making New Friends ===\n');

  const doc = await db.collection('stories').doc(storyId).get();
  if (!doc.exists) {
    throw new Error('Story not found!');
  }

  const story = doc.data();

  console.log('Story:', story.title);
  console.log('JLPT:', story.jlptLevel);
  console.log('Pages:', story.pages?.length || 0);

  if (!story.pages || story.pages.length === 0) {
    throw new Error('No pages found');
  }

  // Generate new quiz
  console.log('\n🔄 Generating bilingual quiz with PLAIN Japanese text...');

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
    correctAnswer: q.correctIndex,
    explanation: q.explanation,
    explanationJa: q.explanationJa,
    type: 'multiple_choice',
    difficulty: calculateQuestionDifficulty(story.jlptLevel),
    tags: ['story-comprehension', story.jlptLevel.toLowerCase()],
  }));

  console.log(`✅ Generated ${questions.length} bilingual questions`);

  // Validate bilingual fields
  const missingBilingual = questions.filter(q => !q.questionJa || !q.explanationJa || !q.optionsJa || q.optionsJa.length !== q.options.length);
  if (missingBilingual.length > 0) {
    console.log(`⚠️  WARNING: ${missingBilingual.length} questions missing Japanese fields`);
    missingBilingual.forEach((q, i) => {
      const issues = [];
      if (!q.questionJa) issues.push('questionJa');
      if (!q.explanationJa) issues.push('explanationJa');
      if (!q.optionsJa || q.optionsJa.length !== q.options.length) issues.push('optionsJa');
      console.log(`  Question ${i + 1}: Missing ${issues.join(', ')}`);
    });
  }

  // Show all questions
  console.log('\n' + '='.repeat(80));
  console.log('GENERATED QUIZ (PLAIN JAPANESE - NO RUBY TAGS):');
  console.log('='.repeat(80));

  questions.forEach((q, i) => {
    console.log(`\nQuestion ${i + 1}:`);
    console.log('  EN:', q.question);
    console.log('  JA:', q.questionJa);
    console.log('\n  Options:');
    q.options.forEach((opt, idx) => {
      console.log(`    ${idx + 1}. EN: ${opt}`);
      console.log(`       JA: ${q.optionsJa?.[idx] || 'MISSING'}`);
    });
    console.log(`\n  Correct Answer: ${q.correctAnswer}`);
    console.log(`  Explanation EN: ${q.explanation}`);
    console.log(`  Explanation JA: ${q.explanationJa}`);
  });

  // Update Firestore
  await db.collection('stories').doc(storyId).update({
    quiz: questions,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('\n✅ Updated in Firestore');
  console.log('\n🎉 Test completed successfully!');
  console.log('\nNOTE: Furigana will be added automatically when the quiz is displayed in the UI.');
}

// Run the script
regenerateOneQuiz()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
