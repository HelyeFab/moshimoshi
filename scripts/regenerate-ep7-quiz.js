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

function buildQuizPrompt(panels, vocabulary, outline) {
  const vocabList = vocabulary?.slice(0, 8) || [];
  const panelSummary = panels?.slice(0, 3).map((p, i) => ({
    panel: i + 1,
    narration: p.narration?.textJa || p.narration?.textEn || '',
    dialogue: p.dialogues?.map((d) => d.textJa || d.textEn).join(' ') || ''
  })) || [];

  return `Create a quiz for a Japanese learning comic.

Comic Content Summary:
${JSON.stringify(panelSummary, null, 2)}

Vocabulary from Comic:
${JSON.stringify(vocabList, null, 2)}

You MUST return a JSON object in EXACTLY this format:
{
  "questions": [
    {
      "type": "multiple-choice",
      "questionJa": "この<ruby>言葉<rt>ことば</rt></ruby>の<ruby>意味<rt>いみ</rt></ruby>は<ruby>何<rt>なに</rt></ruby>ですか？祭り",
      "questionEn": "What does this word mean?",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this answer is correct",
      "explanationJa": "なぜこの<ruby>答え<rt>こたえ</rt></ruby>が<ruby>正<rt>ただ</rt></ruby>しいかの<ruby>説明<rt>せつめい</rt></ruby>"
    }
  ],
  "passingScore": 70
}

CRITICAL RULES TO AVOID REVEALING ANSWERS:
1. **questionEn must NOT contain the answer, meaning, or translation of the word being tested**
   - WRONG: "What does this word mean? Festival" (reveals the answer!)
   - CORRECT: "What does this word mean?"

2. **For reading/pronunciation questions, do NOT add furigana to the target word**
   - WRONG: "<ruby>焼き鳥<rt>やきとり</rt></ruby>" when asking "What is the reading?"
   - CORRECT: "焼き鳥" (no furigana on the word being tested)

3. **The target word in questionJa should have NO furigana if asking about its reading**

Requirements:
- Create EXACTLY 4-5 questions
- Each question must have ALL 7 fields: type, questionJa, questionEn, options (array of 4), correctAnswer (0-3), explanation, explanationJa
- For questionJa and explanationJa, wrap kanji in <ruby> tags EXCEPT for the target word in reading questions
- Test vocabulary, reading comprehension, and cultural understanding
- Make questions appropriate for the JLPT level
- Options must be plausible but only one correct`;
}

async function generateJSON(prompt) {
  console.log('[generateJSON] Calling OpenAI...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that generates JSON content for Japanese learning comics. Always return valid, well-formed JSON that exactly matches the requested structure.',
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

async function regenerateQuiz() {
  console.log('=== Regenerating Quiz for EP7 ===\n');

  // 1. Get EP7 data
  const doc = await db.collection('comics').doc('moshi-goes-to-japan-ep007').get();
  if (!doc.exists) {
    console.error('EP7 not found!');
    return;
  }

  const data = doc.data();
  console.log('EP7 Title:', data.title);
  console.log('Current quiz questions:', data.quiz?.questions?.length || 0);
  console.log('Panels:', data.panels?.length || 0);
  console.log('Vocabulary:', data.vocabulary?.length || 0);
  console.log('');

  // 2. Build quiz prompt
  const prompt = buildQuizPrompt(data.panels, data.vocabulary, data.outline);
  console.log('Quiz prompt built, calling OpenAI...\n');

  // 3. Generate new quiz
  const quizResult = await generateJSON(prompt);
  console.log('Quiz result keys:', Object.keys(quizResult));

  let quiz = { questions: [], passingScore: 70 };

  if (quizResult?.questions && Array.isArray(quizResult.questions)) {
    quiz = quizResult;
  } else if (quizResult?.quiz?.questions && Array.isArray(quizResult.quiz.questions)) {
    quiz = quizResult.quiz;
  } else if (Array.isArray(quizResult)) {
    quiz = { questions: quizResult, passingScore: 70 };
  }

  console.log(`Generated ${quiz.questions.length} questions\n`);

  // 4. Show questions for review
  quiz.questions.forEach((q, i) => {
    console.log(`Q${i + 1}: ${q.questionEn}`);
    console.log(`    ${q.questionJa}`);
    console.log(`    Options: ${q.options.join(', ')}`);
    console.log(`    Correct: ${q.options[q.correctAnswer]}`);
    console.log('');
  });

  // 5. Update EP7 with new quiz
  await db.collection('comics').doc('moshi-goes-to-japan-ep007').update({
    quiz: quiz,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('=== Quiz updated successfully! ===');
}

regenerateQuiz().catch(console.error);
