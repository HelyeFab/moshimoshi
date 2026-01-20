/**
 * Test OpenAI Structured Outputs to see if it actually enforces required fields
 *
 * This tests whether OpenAI's structured outputs guarantee all required fields
 * or if there's a bug that allows missing fields to pass through.
 */

const OpenAI = require('openai');
const { z } = require('zod');
const { zodResponseFormat } = require('openai/helpers/zod');

// Test schema - exactly like StoryPageSchema but simpler
const TestStoryPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string().min(1),
  textWithFurigana: z.string().min(1), // REQUIRED
  translation: z.string().min(1),
});

async function testStructuredOutputs() {
  console.log('=== Testing OpenAI Structured Outputs ===\n');

  const apiKey = process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  // Test 1: Ask OpenAI to generate a story page with our schema
  console.log('TEST 1: Generating page with structured outputs\n');

  const systemPrompt = 'You are an expert in creating Japanese learning materials.';

  const userPrompt = `Generate a simple story page for Japanese learners:

Response format (JSON only):
{
  "pageNumber": 1,
  "text": "Japanese text for the page (plain text, no furigana)",
  "textWithFurigana": "Same text but with furigana in HTML ruby tags <ruby>漢字<rt>かんじ</rt></ruby>",
  "translation": "Natural English translation"
}

Make it very short (1 sentence) for testing.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: zodResponseFormat(TestStoryPageSchema, 'test_story_page')
    });

    const responseContent = completion.choices[0]?.message?.content;
    console.log('Raw OpenAI Response:');
    console.log(responseContent);
    console.log('');

    // Parse and check
    const parsed = JSON.parse(responseContent);
    console.log('Parsed JSON:');
    console.log(JSON.stringify(parsed, null, 2));
    console.log('');

    console.log('Field presence:');
    console.log('  pageNumber:', 'pageNumber' in parsed ? '✅ Present' : '❌ Missing');
    console.log('  text:', 'text' in parsed ? '✅ Present' : '❌ Missing');
    console.log('  textWithFurigana:', 'textWithFurigana' in parsed ? '✅ Present' : '❌ Missing');
    console.log('  translation:', 'translation' in parsed ? '✅ Present' : '❌ Missing');
    console.log('');

    // Validate with Zod
    const result = TestStoryPageSchema.safeParse(parsed);
    if (result.success) {
      console.log('✅ Zod validation PASSED - all required fields present');
    } else {
      console.log('❌ Zod validation FAILED:');
      console.log(result.error.errors);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }

  // Test 2: Intentionally try to break it by asking to omit a field
  console.log('\nTEST 2: Trying to make OpenAI omit textWithFurigana\n');

  const maliciousPrompt = `Generate a story page but INTENTIONALLY OMIT the textWithFurigana field:

{
  "pageNumber": 2,
  "text": "これは日本語です。",
  "translation": "This is Japanese."
}

Do NOT include textWithFurigana.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: maliciousPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: zodResponseFormat(TestStoryPageSchema, 'test_story_page_malicious')
    });

    const responseContent = completion.choices[0]?.message?.content;
    console.log('Raw OpenAI Response:');
    console.log(responseContent);
    console.log('');

    const parsed = JSON.parse(responseContent);
    console.log('Field presence:');
    console.log('  textWithFurigana:', 'textWithFurigana' in parsed ? '✅ Present (enforced by OpenAI!)' : '❌ Missing (OpenAI bypassed schema!)');
    console.log('');

    if ('textWithFurigana' in parsed) {
      console.log('✅ CONCLUSION: OpenAI Structured Outputs DOES enforce required fields');
      console.log('   Even when explicitly told to omit it, OpenAI included it.');
    } else {
      console.log('❌ CRITICAL BUG: OpenAI Structured Outputs DOES NOT enforce required fields!');
      console.log('   This explains why validation was bypassed during story generation.');
    }

  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }

  console.log('\n=== Test Complete ===');
}

testStructuredOutputs()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
