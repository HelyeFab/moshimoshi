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

async function regenerateAllQuizzes() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Regenerating All Episode Quizzes ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`);

  // 1. Get all published episodes (simple query, sort in code)
  const snapshot = await db.collection('comics').get();

  const episodes = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.status === 'published') {
      episodes.push({ id: doc.id, ...data });
    }
  });

  // Sort by episode number
  episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));

  console.log(`Found ${episodes.length} published episodes:\n`);

  episodes.forEach(ep => {
    console.log(`  EP${ep.episodeNumber}: ${ep.title} (${ep.id})`);
    console.log(`    - Panels: ${ep.panels?.length || 0}, Vocab: ${ep.vocabulary?.length || 0}, Quiz: ${ep.quiz?.questions?.length || 0} questions`);
  });
  console.log('');

  if (dryRun) {
    console.log('DRY RUN - Exiting without changes.\n');
    console.log('Run without --dry-run to regenerate quizzes.');
    return;
  }

  // 2. Regenerate each quiz
  const results = [];

  for (const ep of episodes) {
    console.log(`\n--- Processing EP${ep.episodeNumber}: ${ep.title} ---`);

    if (!ep.panels || ep.panels.length === 0) {
      console.log('  ⚠️  Skipping - no panels data');
      results.push({ id: ep.id, status: 'skipped', reason: 'no panels' });
      continue;
    }

    if (!ep.vocabulary || ep.vocabulary.length === 0) {
      console.log('  ⚠️  Skipping - no vocabulary data');
      results.push({ id: ep.id, status: 'skipped', reason: 'no vocabulary' });
      continue;
    }

    try {
      // Build and generate quiz
      const prompt = buildQuizPrompt(ep.panels, ep.vocabulary, ep.outline);
      console.log('  Calling OpenAI...');

      const quizResult = await generateJSON(prompt);

      let quiz = { questions: [], passingScore: 70 };
      if (quizResult?.questions && Array.isArray(quizResult.questions)) {
        quiz = quizResult;
      } else if (Array.isArray(quizResult)) {
        quiz = { questions: quizResult, passingScore: 70 };
      }

      if (quiz.questions.length === 0) {
        console.log('  ⚠️  Generated empty quiz, skipping update');
        results.push({ id: ep.id, status: 'error', reason: 'empty quiz generated' });
        continue;
      }

      // Update Firestore
      await db.collection('comics').doc(ep.id).update({
        quiz: quiz,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`  ✅ Updated with ${quiz.questions.length} questions`);
      results.push({ id: ep.id, status: 'success', questions: quiz.questions.length });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ id: ep.id, status: 'error', reason: error.message });
    }
  }

  // 3. Summary
  console.log('\n\n=== Summary ===');
  const success = results.filter(r => r.status === 'success');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');

  console.log(`✅ Success: ${success.length}`);
  console.log(`⚠️  Skipped: ${skipped.length}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.id}: ${e.reason}`));
  }
}

regenerateAllQuizzes().catch(console.error);
