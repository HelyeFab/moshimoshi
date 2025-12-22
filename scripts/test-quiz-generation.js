/**
 * Test quiz generation to see what OpenAI returns
 */

require('dotenv').config();
const OpenAI = require('openai').default;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY,
});

const samplePanels = [
  {
    panelNumber: 1,
    narration: { textJa: "もしはせんそうじに来ました。", textEn: "Moshi came to Senso-ji." }
  },
  {
    panelNumber: 2,
    narration: { textJa: "大きな門があります。", textEn: "There is a big gate." }
  }
];

const sampleVocab = [
  { word: "寺", reading: "てら", meaning: "temple" },
  { word: "門", reading: "もん", meaning: "gate" }
];

async function testQuizGeneration() {
  console.log('🧪 Testing Quiz Generation\n');

  const panelSummary = samplePanels.map((p, i) => ({
    panel: i + 1,
    narration: p.narration?.textJa || '',
    dialogue: ''
  }));

  const prompt = `Create a quiz for a Japanese learning comic.

Comic Content Summary:
${JSON.stringify(panelSummary, null, 2)}

Vocabulary from Comic:
${JSON.stringify(sampleVocab, null, 2)}

You MUST return a JSON object in EXACTLY this format:
{
  "questions": [
    {
      "type": "multiple-choice",
      "questionJa": "この言葉の意味は何ですか？",
      "questionEn": "What does this word mean?",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this answer is correct",
      "explanationJa": "なぜこの答えが正しいかの説明"
    }
  ],
  "passingScore": 70
}

Requirements:
- Create EXACTLY 4-5 questions
- Each question must have ALL 7 fields: type, questionJa, questionEn, options (array of 4), correctAnswer (0-3), explanation, explanationJa
- Test vocabulary, reading comprehension, and cultural understanding
- Make questions appropriate for the JLPT level
- Options must be plausible but only one correct`;

  try {
    console.log('📤 Sending request to OpenAI...\n');

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
    console.log('📥 OpenAI Response:\n');
    console.log(content);
    console.log('\n');

    const parsed = JSON.parse(content);
    console.log('📊 Parsed Structure:\n');
    console.log('  Type:', typeof parsed);
    console.log('  Keys:', Object.keys(parsed));
    console.log('  Has questions:', !!parsed.questions);
    console.log('  Questions is array:', Array.isArray(parsed.questions));
    console.log('  Questions length:', parsed.questions?.length || 0);
    console.log('\n');

    if (parsed.questions && parsed.questions.length > 0) {
      console.log('✅ SUCCESS - Generated', parsed.questions.length, 'questions');
      console.log('\nFirst question:');
      console.log(JSON.stringify(parsed.questions[0], null, 2));
    } else {
      console.log('❌ FAILED - No questions in response');
      console.log('Full parsed object:');
      console.log(JSON.stringify(parsed, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testQuizGeneration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
