/**
 * Test AI formatting of transcripts
 */

require('dotenv').config();
const { AIService } = require('../dist/lib/ai/AIService');

async function testAIFormatting() {
  try {
    console.log('\n🧪 Testing AI Service transcript formatting...\n');

    const aiService = AIService.getInstance();

    // Test transcript segments
    const testTranscript = [
      {
        text: "みなさんこんにちは、たなかです。",
        startTime: 0,
        endTime: 4.28
      },
      {
        text: "突然ですがみなさん、日本語で自己紹介をしてください。",
        startTime: 4.28,
        endTime: 10.52
      },
      {
        text: "って、急に言われても困りますよね。",
        startTime: 13.6,
        endTime: 17.44
      }
    ];

    console.log('📝 Input transcript:', testTranscript.length, 'segments');
    console.log('First segment:', testTranscript[0].text);

    // Test the improved processTranscript method
    const result = await aiService.processTranscript({
      content: {
        transcript: testTranscript,
        videoTitle: 'Test Video',
        language: 'ja'
      },
      splitForShadowing: true,
      maxSegmentLength: 20,
      addFurigana: false
    }, {
      jlptLevel: 'N4'
    });

    if (result.success && result.data) {
      console.log('\n✅ Success! Formatted transcript:');
      console.log('================================');
      console.log('Total segments:', result.data.segments.length);

      // Show first 5 segments
      result.data.segments.slice(0, 5).forEach((seg, idx) => {
        console.log(`\nSegment ${idx + 1}:`);
        console.log(`  Text: "${seg.text}"`);
        console.log(`  Length: ${seg.text.length} chars`);
      });

      // Check for any undefined text
      const invalidSegments = result.data.segments.filter(s => !s || !s.text);
      if (invalidSegments.length > 0) {
        console.error('\n⚠️ Warning: Found', invalidSegments.length, 'invalid segments!');
      } else {
        console.log('\n✅ All segments have valid text!');
      }

      // Show usage
      if (result.usage) {
        console.log('\n💰 Cost:', '$' + result.usage.estimatedCost.toFixed(4));
        console.log('📊 Tokens:', result.usage.totalTokens);
      }

      if (result.cached) {
        console.log('\n💾 Response was cached');
      }
    } else {
      console.error('\n❌ Failed:', result.error);
      if (result.metadata) {
        console.error('Error code:', result.metadata.errorCode);
        console.error('Details:', result.metadata.errorDetails);
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }

  process.exit();
}

testAIFormatting();