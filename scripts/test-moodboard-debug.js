#!/usr/bin/env node

/**
 * Debug test script for moodboard generation
 */

require('dotenv').config({ path: '.env.local' });

async function testMoodboardDebug() {
  console.log('🎨 Testing Moodboard Generation (Debug Mode)...\n');

  const OpenAI = require('openai');

  const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY
  });

  const systemPrompt = `You are a Japanese language expert creating educational kanji mood boards. Generate a list of kanji related to the given theme. Always respond with valid json.

Rules:
1. Include both common and less common kanji for the theme
2. Each kanji should have accurate readings and meanings
3. Generate exactly the requested number of kanji entries

Return your response as valid json in this exact format:
{
  "title": "Theme Name in English",
  "description": "Brief description of the theme",
  "themeColor": "#hexcolor",
  "emoji": "appropriate emoji",
  "kanjiList": [
    {
      "kanji": "漢",
      "meaning": "English meaning",
      "onyomi": ["カン"],
      "kunyomi": ["から"],
      "jlptLevel": "N5",
      "strokeCount": 13,
      "tags": ["tag1", "tag2"],
      "examples": [
        {"sentence": "漢字を書く。", "translation": "Write kanji."},
        {"sentence": "漢字は難しい。", "translation": "Kanji is difficult."}
      ]
    }
  ]
}`;

  const userPrompt = `Generate a kanji mood board for the theme: "Family"
Number of kanji: 5
JLPT Level: N5

Include kanji related to family members and relationships.`;

  try {
    console.log('📡 Calling OpenAI API...\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;

    if (response) {
      console.log('✅ Got response from OpenAI');
      console.log('📝 Raw response:', response.substring(0, 500) + '...\n');

      try {
        const parsed = JSON.parse(response);
        console.log('✅ Successfully parsed JSON');
        console.log('📊 Moodboard Details:');
        console.log(`Title: ${parsed.title}`);
        console.log(`Description: ${parsed.description}`);
        console.log(`Theme Color: ${parsed.themeColor}`);
        console.log(`Emoji: ${parsed.emoji}`);
        console.log(`Kanji Count: ${parsed.kanjiList?.length || 0}`);

        if (parsed.kanjiList && parsed.kanjiList.length > 0) {
          console.log('\n📚 Kanji:');
          parsed.kanjiList.forEach((kanji, index) => {
            console.log(`${index + 1}. ${kanji.kanji} - ${kanji.meaning} (${kanji.jlptLevel})`);
          });
        }
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError.message);
        console.log('Response was:', response);
      }
    } else {
      console.error('❌ No response from OpenAI');
    }

    console.log('\n💰 Token Usage:', completion.usage);

  } catch (error) {
    console.error('❌ API call failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testMoodboardDebug().then(() => {
  console.log('\n✨ Test completed!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});