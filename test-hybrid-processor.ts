/**
 * Test Hybrid Processor with Ollama
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

import { WordExplainerProcessorHybrid } from './src/lib/ai/processors/WordExplainerProcessorHybrid';
import type { ProcessorContext } from './src/lib/ai/types';

async function testHybridProcessor() {
  console.log('🧪 Testing Hybrid Word Explainer Processor\n');

  // Create processor context (use OpenAI model name for context, Ollama uses its own config)
  const context: ProcessorContext = {
    model: 'gpt-4o-mini',  // OpenAI model (for fallback)
    userId: 'test-user',
    temperature: 0.5,
    config: {
      timeout: 60000,
      maxRetries: 2,
      temperature: 0.5
    }
  };

  const processor = new WordExplainerProcessorHybrid(context);

  // Test 1: Explain a simple word with Ollama
  console.log('Test 1: Explain 食べる (with Ollama)');
  console.log('Expected: Should use Ollama and return valid word explanation\n');

  try {
    const startTime = Date.now();
    const result = await processor.process({
      word: '食べる'
    }, {
      jlptLevel: 'N5'
    });

    const duration = (Date.now() - startTime) / 1000;

    console.log('✅ Success!');
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`💰 Cost: $${result.usage?.estimatedCost || 0} (FREE with Ollama!)`);
    console.log(`🤖 Provider: ${result.metadata?.provider || 'unknown'}`);
    console.log(`📊 Tokens: ${result.usage?.totalTokens || 0}\n`);

    // Display result
    console.log('📝 Word Explanation:');
    console.log(`   Word: ${result.data.word}`);
    console.log(`   Reading: ${result.data.reading}`);
    console.log(`   Romaji: ${result.data.romaji}`);
    console.log(`   Meaning: ${result.data.meaning}`);
    console.log(`   Part of Speech: ${result.data.partOfSpeech}`);
    console.log(`   JLPT Level: ${result.data.jlptLevel}`);

    if (result.data.examples && result.data.examples.length > 0) {
      console.log(`   Examples: ${result.data.examples.length} provided`);
    }

    console.log();
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log();
  }

  // Test 2: Explain a more complex word
  console.log('Test 2: Explain 勉強する (with context)');
  try {
    const startTime = Date.now();
    const result = await processor.process({
      word: '勉強する',
      context: '私は毎日日本語を勉強します。'
    }, {
      jlptLevel: 'N5'
    });

    const duration = (Date.now() - startTime) / 1000;

    console.log('✅ Success!');
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`🤖 Provider: ${result.metadata?.provider || 'unknown'}`);
    console.log(`📝 Word: ${result.data.word} - ${result.data.meaning}\n`);
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log();
  }

  console.log('🎉 Hybrid processor tests completed!');
  console.log('\n💡 Next: Integrate into AIService.ts to use in production');
}

testHybridProcessor().catch(console.error);
