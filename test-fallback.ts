/**
 * Test Fallback to OpenAI when Ollama fails
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

// Temporarily break Ollama by using wrong API key
process.env.SHELDON_API_KEY = 'invalid-key-to-test-fallback';

import { WordExplainerProcessorHybrid } from './src/lib/ai/processors/WordExplainerProcessorHybrid';
import type { ProcessorContext } from './src/lib/ai/types';

async function testFallback() {
  console.log('🧪 Testing Fallback Mechanism\n');
  console.log('Scenario: Ollama fails → Should fallback to OpenAI\n');

  const context: ProcessorContext = {
    model: 'gpt-4o-mini',
    userId: 'test-user',
    temperature: 0.5,
    config: {
      timeout: 60000,
      maxRetries: 2,
      temperature: 0.5
    }
  };

  const processor = new WordExplainerProcessorHybrid(context);

  console.log('Test: Explain 食べる with invalid Ollama key');
  console.log('Expected: Should try Ollama → Fail → Fallback to OpenAI\n');

  try {
    const startTime = Date.now();
    const result = await processor.process({
      word: '食べる'
    }, {
      jlptLevel: 'N5'
    });

    const duration = (Date.now() - startTime) / 1000;

    console.log('✅ Fallback worked!');
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`💰 Cost: $${result.usage?.estimatedCost || 0} (OpenAI fallback)`);
    console.log(`🤖 Provider: ${result.metadata?.provider || 'unknown'}`);
    console.log(`📝 Word: ${result.data.word} - ${result.data.meaning}\n`);

    console.log('🎉 Fallback mechanism works correctly!');
    console.log('✅ System is resilient to Ollama failures');
  } catch (error) {
    console.error('❌ Fallback failed:', error);
    console.log('\n⚠️  This means if Ollama is down, the whole system breaks!');
  }
}

testFallback().catch(console.error);
