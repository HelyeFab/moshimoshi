/**
 * Ollama Integration Test Script
 * Tests the OllamaClient directly
 */

import { OllamaClient } from './src/lib/ai/clients/OllamaClient';

async function testOllamaClient() {
  console.log('🧪 Testing Ollama Client\n');

  // Initialize client
  const client = new OllamaClient({
    baseUrl: 'https://api.selfmind.dev/chat',
    apiKey: 'e7651e66-9c78-4b74-a771-5626ca99409e',
    model: 'qwen2.5:7b',
    timeout: 60000,
    maxRetries: 2
  });

  // Test 1: Health Check
  console.log('Test 1: Health Check');
  try {
    const healthy = await client.healthCheck();
    console.log(healthy ? '✅ Ollama is healthy' : '❌ Ollama is down');
    console.log();
  } catch (error) {
    console.error('❌ Health check failed:', error);
    console.log();
  }

  // Test 2: Simple Generation
  console.log('Test 2: Simple Generation (Non-streaming)');
  try {
    const startTime = Date.now();
    const response = await client.generate({
      prompt: 'Explain the Japanese word 食べる in simple English.',
      options: {
        temperature: 0.5,
        num_predict: 150
      }
    });
    const duration = (Date.now() - startTime) / 1000;

    console.log('✅ Response received');
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`📝 Response: ${response.response.substring(0, 200)}...`);
    console.log(`📊 Tokens generated: ${response.eval_count}`);
    console.log();
  } catch (error) {
    console.error('❌ Generation failed:', error);
    console.log();
  }

  // Test 3: JSON Mode
  console.log('Test 3: JSON Mode');
  try {
    const startTime = Date.now();
    const response = await client.generate({
      prompt: 'Create a JSON object for the Japanese word 食べる with fields: word, reading, romaji, meaning, partOfSpeech, jlptLevel',
      format: 'json',
      options: {
        temperature: 0.3,
        num_predict: 200
      }
    });
    const duration = (Date.now() - startTime) / 1000;

    console.log('✅ JSON response received');
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);

    // Try to parse JSON
    try {
      const parsed = JSON.parse(response.response);
      console.log('✅ Valid JSON:');
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error('❌ Invalid JSON:', response.response);
    }
    console.log();
  } catch (error) {
    console.error('❌ JSON generation failed:', error);
    console.log();
  }

  // Test 4: Streaming
  console.log('Test 4: Streaming Generation');
  try {
    console.log('🔄 Streaming response:');
    process.stdout.write('   ');

    let tokenCount = 0;
    const startTime = Date.now();

    for await (const chunk of client.generateStream({
      prompt: 'Explain ている grammar in 2 sentences.',
      options: {
        temperature: 0.5,
        num_predict: 100
      }
    })) {
      process.stdout.write(chunk);
      tokenCount++;
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log('\n');
    console.log(`✅ Streaming completed`);
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`📊 Chunks received: ${tokenCount}`);
    console.log();
  } catch (error) {
    console.error('\n❌ Streaming failed:', error);
    console.log();
  }

  console.log('🎉 All tests completed!');
}

// Run tests
testOllamaClient().catch(console.error);
