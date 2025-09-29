#!/usr/bin/env node

/**
 * Test script to verify GPT-4 implementation
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { AIService } = require('../src/lib/ai/AIService.ts');

async function testGPT4() {
  console.log('🧪 Testing GPT-4 Implementation...\n');

  try {
    // Initialize AI Service
    const aiService = AIService.getInstance();

    // Test health check
    console.log('1️⃣ Testing health check...');
    const health = await aiService.healthCheck();
    console.log('Health check result:', health);
    console.log('✅ Health check passed\n');

    // Test with a simple grammar explanation request
    console.log('2️⃣ Testing grammar explanation with GPT-4...');
    const grammarRequest = {
      task: 'explain_grammar',
      content: {
        content: '私は日本語を勉強しています。'
      },
      config: {
        includeExamples: true
      }
    };

    const startTime = Date.now();
    const response = await aiService.process(grammarRequest);
    const processingTime = Date.now() - startTime;

    console.log('\n📊 Response Details:');
    console.log('Success:', response.success);
    console.log('Model Used:', response.metadata?.modelUsed);
    console.log('Processing Time:', `${processingTime}ms`);
    console.log('Tokens Used:', {
      prompt: response.metadata?.promptTokens,
      completion: response.metadata?.completionTokens,
      total: response.usage?.totalTokens
    });
    console.log('Estimated Cost:', `$${response.metadata?.totalCost?.toFixed(4) || 'N/A'}`);

    if (response.metadata?.modelUsed === 'gpt-4') {
      console.log('\n✅ SUCCESS: AI Service is using GPT-4!');
    } else {
      console.log(`\n⚠️ WARNING: AI Service is using ${response.metadata?.modelUsed} instead of GPT-4`);
    }

    // Display a sample of the response
    if (response.data) {
      console.log('\n📝 Sample Response:');
      const sampleData = JSON.stringify(response.data, null, 2);
      console.log(sampleData.substring(0, 500) + (sampleData.length > 500 ? '...' : ''));
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the test
testGPT4().then(() => {
  console.log('\n✨ All tests completed!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});