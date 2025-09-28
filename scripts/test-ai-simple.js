#!/usr/bin/env node

/**
 * Simple test of AI transcript formatting
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Set environment variable properly
if (!process.env.OPEN_AI_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error('❌ No OpenAI API key found in environment');
  process.exit(1);
}

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY,
});

async function testSimpleFormatting() {
  try {
    console.log('\n🧪 Testing simple AI formatting...\n');

    const testText = "みなさんこんにちは、たなかです。突然ですがみなさん、日本語で自己紹介をしてください。って、急に言われても困りますよね。";

    const systemPrompt = `You are an expert Japanese language educator. Split this Japanese text into SHORT segments for shadowing practice.

CRITICAL RULES:
1. MAXIMUM 20 characters per segment (essential for comfortable repetition)
2. NEVER split です/ます/でした/ました/だ/だった from their stems
3. Aim for 8-15 characters ideally (2-3 seconds when spoken)
4. Break long sentences at natural points:
   - After て-form (して、見て、食べて)
   - After connectors (から、けど、が、のに、ので)
   - Between clauses
5. Return ONLY a JSON array of strings (not objects, just strings)
6. Each string must contain actual Japanese text, not empty

Example output: ["昨日友達と", "映画を見て", "楽しかったです"]

IMPORTANT: Return a simple array of strings, NOT an array of objects.`;

    console.log('📝 Input text:', testText);
    console.log('📏 Length:', testText.length, 'characters\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: testText }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const response = completion.choices[0].message.content?.trim();

    console.log('🤖 AI Response:', response);
    console.log('\n');

    // Try to parse
    try {
      const segments = JSON.parse(response);

      if (Array.isArray(segments)) {
        console.log('✅ Successfully parsed as array!');
        console.log('📊 Total segments:', segments.length);
        console.log('\nFormatted segments:');
        console.log('================================');

        segments.forEach((seg, idx) => {
          if (typeof seg === 'string') {
            console.log(`${idx + 1}. "${seg}" (${seg.length} chars)`);
          } else if (seg && typeof seg === 'object' && seg.text) {
            console.log(`${idx + 1}. "${seg.text}" (${seg.text.length} chars) - OBJECT FORMAT`);
          } else {
            console.log(`${idx + 1}. INVALID:`, seg);
          }
        });

        // Check for long segments
        const longSegments = segments.filter(s => {
          const text = typeof s === 'string' ? s : s?.text;
          return text && text.length > 20;
        });

        if (longSegments.length > 0) {
          console.log('\n⚠️ Warning:', longSegments.length, 'segments exceed 20 characters');
        } else {
          console.log('\n✅ All segments are within 20 character limit!');
        }

      } else {
        console.error('❌ Response is not an array:', typeof segments);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError.message);
      console.error('Raw response:', response);
    }

    // Calculate cost
    const usage = completion.usage;
    if (usage) {
      const inputCost = (usage.prompt_tokens / 1000) * 0.00015;
      const outputCost = (usage.completion_tokens / 1000) * 0.0006;
      const totalCost = inputCost + outputCost;

      console.log('\n💰 Cost Analysis:');
      console.log(`  Input: ${usage.prompt_tokens} tokens ($${inputCost.toFixed(5)})`);
      console.log(`  Output: ${usage.completion_tokens} tokens ($${outputCost.toFixed(5)})`);
      console.log(`  Total: $${totalCost.toFixed(5)}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testSimpleFormatting();