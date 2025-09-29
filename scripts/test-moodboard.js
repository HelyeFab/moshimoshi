#!/usr/bin/env node

/**
 * Test script for moodboard generation
 */

require('dotenv').config({ path: '.env.local' });

const { AIService } = require('../src/lib/ai/AIService.ts');

async function testMoodboard() {
  console.log('🎨 Testing Moodboard Generation...\n');

  try {
    const aiService = AIService.getInstance();

    const request = {
      task: 'generate_moodboard',
      content: {
        theme: 'Family',
        kanjiCount: 10,
        tags: ['beginner', 'common'],
        focusAreas: ['immediate family', 'relationships']
      },
      config: {
        jlptLevel: 'N5'
      }
    };

    console.log('📝 Request:', JSON.stringify(request, null, 2));
    console.log('\n⏳ Generating moodboard...\n');

    const startTime = Date.now();
    const response = await aiService.process(request);
    const processingTime = Date.now() - startTime;

    if (response.success) {
      console.log('✅ Moodboard generated successfully!');
      console.log(`⏱️ Processing time: ${processingTime}ms`);
      console.log(`💰 Cost: $${response.metadata?.totalCost?.toFixed(4) || 'N/A'}`);
      console.log(`🤖 Model: ${response.metadata?.modelUsed}`);

      if (response.data) {
        console.log('\n📊 Moodboard Details:');
        console.log(`Title: ${response.data.title}`);
        console.log(`Description: ${response.data.description}`);
        console.log(`Theme Color: ${response.data.themeColor}`);
        console.log(`Emoji: ${response.data.emoji}`);
        console.log(`Kanji Count: ${response.data.kanjiList?.length || 0}`);

        if (response.data.kanjiList && response.data.kanjiList.length > 0) {
          console.log('\n📚 Sample Kanji (first 3):');
          response.data.kanjiList.slice(0, 3).forEach((kanji, index) => {
            console.log(`\n${index + 1}. ${kanji.kanji} - ${kanji.meaning}`);
            console.log(`   Onyomi: ${kanji.onyomi.join(', ')}`);
            console.log(`   Kunyomi: ${kanji.kunyomi.join(', ')}`);
            console.log(`   JLPT: ${kanji.jlptLevel}, Strokes: ${kanji.strokeCount}`);
          });
        }
      }
    } else {
      console.error('❌ Moodboard generation failed:', response.error);
      console.error('Error details:', response.metadata);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

// Run the test
testMoodboard().then(() => {
  console.log('\n✨ Test completed!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});