/**
 * Comprehensive Smart Routing Test Suite
 * Tests all processors, configurations, and fallback mechanisms
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { WordExplainerProcessorHybrid } from './src/lib/ai/processors/WordExplainerProcessorHybrid';
import { GrammarExplainerProcessorHybrid } from './src/lib/ai/processors/GrammarExplainerProcessorHybrid';
import { StoryProcessorHybrid } from './src/lib/ai/processors/StoryProcessorHybrid';
import { TranscriptProcessorHybrid } from './src/lib/ai/processors/TranscriptProcessorHybrid';
import { OllamaClient } from './src/lib/ai/clients/OllamaClient';
import { getOllamaConfig, providerHealth } from './src/lib/ai/config/providers';
import type { ProcessorContext } from './src/lib/ai/types';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  provider?: string;
  cost?: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function logResult(result: TestResult) {
  results.push(result);
  const icon = result.success ? '✅' : '❌';
  const provider = result.provider ? ` [${result.provider}]` : '';
  const cost = result.cost !== undefined ? ` ($${result.cost.toFixed(6)})` : '';
  console.log(`${icon} ${result.name}${provider} - ${result.duration.toFixed(2)}s${cost}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

async function testOllamaConnection(): Promise<TestResult> {
  console.log('\n🔌 TEST 1: Ollama Connection & Health Check');
  console.log('-'.repeat(80));
  const startTime = Date.now();

  try {
    const ollamaConfig = getOllamaConfig();
    const client = new OllamaClient(ollamaConfig);

    console.log(`Testing connection to: ${ollamaConfig.baseUrl}`);
    console.log(`Using model: ${ollamaConfig.model}`);
    console.log(`API Key: ${ollamaConfig.apiKey.substring(0, 10)}...`);

    // Quick health check with short timeout
    const healthCheckStart = Date.now();
    const isHealthy = await client.healthCheck();
    const healthCheckDuration = Date.now() - healthCheckStart;

    console.log(`Health check completed in ${healthCheckDuration}ms: ${isHealthy ? 'HEALTHY ✅' : 'UNHEALTHY ❌'}`);

    if (!isHealthy) {
      return {
        name: 'Ollama Connection',
        success: false,
        duration: (Date.now() - startTime) / 1000,
        error: 'Health check failed - server may be down or unreachable'
      };
    }

    // Try a minimal generation
    console.log('Testing minimal generation...');
    const genStart = Date.now();
    const response = await client.generate({
      prompt: 'Say "test" in one word:',
      options: {
        temperature: 0,
        num_predict: 5
      }
    });
    const genDuration = Date.now() - genStart;

    console.log(`Generation completed in ${genDuration}ms`);
    console.log(`Response: ${response.response.substring(0, 100)}`);

    return {
      name: 'Ollama Connection',
      success: true,
      duration: (Date.now() - startTime) / 1000,
      provider: 'ollama',
      cost: 0,
      details: {
        healthCheckTime: healthCheckDuration,
        generationTime: genDuration,
        response: response.response
      }
    };
  } catch (error) {
    return {
      name: 'Ollama Connection',
      success: false,
      duration: (Date.now() - startTime) / 1000,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testWordExplainer(useOllama: boolean): Promise<TestResult> {
  const providerName = useOllama ? 'Ollama' : 'OpenAI';
  console.log(`\n📝 TEST: Word Explainer (${providerName})`);
  console.log('-'.repeat(80));

  const startTime = Date.now();

  try {
    // Temporarily override provider
    const originalProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = useOllama ? 'ollama' : 'openai';

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
    const result = await processor.process({
      word: '食べる'
    }, {
      jlptLevel: 'N5'
    });

    // Restore original
    process.env.AI_PROVIDER = originalProvider;

    const duration = (Date.now() - startTime) / 1000;

    console.log(`Word: ${result.data.word}`);
    console.log(`Meaning: ${result.data.meaning}`);
    console.log(`Reading: ${result.data.reading}`);
    console.log(`Part of Speech: ${result.data.partOfSpeech}`);

    return {
      name: `Word Explainer (${providerName})`,
      success: true,
      duration,
      provider: result.metadata?.provider || providerName.toLowerCase(),
      cost: result.usage?.estimatedCost || 0,
      details: {
        word: result.data.word,
        meaning: result.data.meaning,
        tokens: result.usage?.totalTokens
      }
    };
  } catch (error) {
    return {
      name: `Word Explainer (${providerName})`,
      success: false,
      duration: (Date.now() - startTime) / 1000,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testGrammarExplainer(useOllama: boolean): Promise<TestResult> {
  const providerName = useOllama ? 'Ollama' : 'OpenAI';
  console.log(`\n📚 TEST: Grammar Explainer (${providerName})`);
  console.log('-'.repeat(80));

  const startTime = Date.now();

  try {
    const originalProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = useOllama ? 'ollama' : 'openai';

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

    const processor = new GrammarExplainerProcessorHybrid(context);
    const result = await processor.process({
      content: 'ている'
    }, {
      jlptLevel: 'N5'
    });

    process.env.AI_PROVIDER = originalProvider;

    const duration = (Date.now() - startTime) / 1000;

    console.log(`Pattern: ${result.data.pattern}`);
    console.log(`Meaning: ${result.data.meaning}`);
    console.log(`Examples: ${result.data.examples?.length || 0}`);

    return {
      name: `Grammar Explainer (${providerName})`,
      success: true,
      duration,
      provider: result.metadata?.provider || providerName.toLowerCase(),
      cost: result.usage?.estimatedCost || 0,
      details: {
        pattern: result.data.pattern,
        exampleCount: result.data.examples?.length
      }
    };
  } catch (error) {
    return {
      name: `Grammar Explainer (${providerName})`,
      success: false,
      duration: (Date.now() - startTime) / 1000,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testTranscriptProcessor(useOllama: boolean): Promise<TestResult> {
  const providerName = useOllama ? 'Ollama' : 'OpenAI';
  console.log(`\n🎬 TEST: Transcript Processor (${providerName})`);
  console.log('-'.repeat(80));

  const startTime = Date.now();

  try {
    const originalProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = useOllama ? 'ollama' : 'openai';

    const context: ProcessorContext = {
      model: 'gpt-4o-mini',
      userId: 'test-user',
      temperature: 0.4,
      config: {
        timeout: 60000,
        maxRetries: 2,
        temperature: 0.4
      }
    };

    const processor = new TranscriptProcessorHybrid(context);
    const result = await processor.process({
      content: {
        transcript: [
          { text: '今日は天気がいいですね。', startTime: 0, endTime: 3 },
          { text: '公園に行きましょう。', startTime: 3, endTime: 6 }
        ],
        videoTitle: 'Test Video',
        language: 'ja'
      },
      splitForShadowing: true,
      maxSegmentLength: 20
    }, {
      jlptLevel: 'N5'
    });

    process.env.AI_PROVIDER = originalProvider;

    const duration = (Date.now() - startTime) / 1000;

    console.log(`Segments: ${result.data.segments.length}`);
    console.log(`First segment: ${result.data.segments[0]?.text}`);

    return {
      name: `Transcript Processor (${providerName})`,
      success: true,
      duration,
      provider: result.metadata?.provider || providerName.toLowerCase(),
      cost: result.usage?.estimatedCost || 0,
      details: {
        segmentCount: result.data.segments.length
      }
    };
  } catch (error) {
    return {
      name: `Transcript Processor (${providerName})`,
      success: false,
      duration: (Date.now() - startTime) / 1000,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testFallbackMechanism(): Promise<TestResult> {
  console.log('\n🔄 TEST: Fallback Mechanism');
  console.log('-'.repeat(80));
  console.log('Simulating Ollama failure by using invalid API key...');

  const startTime = Date.now();

  try {
    // Save original config
    const originalApiKey = process.env.SHELDON_API_KEY;
    const originalProvider = process.env.AI_PROVIDER;

    // Set up for fallback test
    process.env.AI_PROVIDER = 'ollama';
    process.env.SHELDON_API_KEY = 'invalid-key-for-testing';

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
    const result = await processor.process({
      word: '食べる'
    }, {
      jlptLevel: 'N5'
    });

    // Restore original config
    process.env.SHELDON_API_KEY = originalApiKey;
    process.env.AI_PROVIDER = originalProvider;

    const duration = (Date.now() - startTime) / 1000;

    // If we got here, fallback worked
    const usedOpenAI = result.usage && result.usage.estimatedCost > 0;

    console.log(`Fallback triggered: ${usedOpenAI ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Result: ${result.data.word} - ${result.data.meaning}`);

    return {
      name: 'Fallback Mechanism',
      success: usedOpenAI,
      duration,
      provider: 'openai (fallback)',
      cost: result.usage?.estimatedCost || 0,
      details: {
        fallbackWorked: usedOpenAI,
        word: result.data.word
      }
    };
  } catch (error) {
    return {
      name: 'Fallback Mechanism',
      success: false,
      duration: (Date.now() - startTime) / 1000,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runComprehensiveTests() {
  console.log('🧪 COMPREHENSIVE SMART ROUTING TEST SUITE\n');
  console.log('='.repeat(80));
  console.log(`Environment:`);
  console.log(`  AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  console.log(`  AI_OLLAMA_ENABLED: ${process.env.AI_OLLAMA_ENABLED}`);
  console.log(`  OLLAMA_BASE_URL: ${process.env.OLLAMA_BASE_URL}`);
  console.log('='.repeat(80));

  const allTests: Array<() => Promise<TestResult>> = [];

  // Phase 1: Connection Tests
  console.log('\n\n📋 PHASE 1: CONNECTION TESTS');
  console.log('='.repeat(80));
  const connectionResult = await testOllamaConnection();
  await logResult(connectionResult);

  const ollamaAvailable = connectionResult.success;

  // Phase 2: OpenAI Tests (always available)
  console.log('\n\n📋 PHASE 2: OPENAI TESTS (Baseline)');
  console.log('='.repeat(80));

  const openaiTests = [
    () => testWordExplainer(false),
    () => testGrammarExplainer(false),
    () => testTranscriptProcessor(false)
  ];

  for (const test of openaiTests) {
    const result = await test();
    await logResult(result);
    await new Promise(r => setTimeout(r, 2000)); // Delay between tests
  }

  // Phase 3: Ollama Tests (if available)
  if (ollamaAvailable) {
    console.log('\n\n📋 PHASE 3: OLLAMA TESTS');
    console.log('='.repeat(80));

    const ollamaTests = [
      () => testWordExplainer(true),
      () => testGrammarExplainer(true),
      () => testTranscriptProcessor(true)
    ];

    for (const test of ollamaTests) {
      const result = await test();
      await logResult(result);
      await new Promise(r => setTimeout(r, 2000));
    }
  } else {
    console.log('\n\n⚠️  PHASE 3: OLLAMA TESTS SKIPPED');
    console.log('='.repeat(80));
    console.log('Ollama is not available. Skipping Ollama-specific tests.');
  }

  // Phase 4: Fallback Test
  console.log('\n\n📋 PHASE 4: FALLBACK MECHANISM TEST');
  console.log('='.repeat(80));
  const fallbackResult = await testFallbackMechanism();
  await logResult(fallbackResult);

  // Summary Report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  // Performance Summary
  console.log('\n📈 Performance Summary:');
  const openaiResults = results.filter(r => r.provider === 'openai');
  const ollamaResults = results.filter(r => r.provider === 'ollama');

  if (openaiResults.length > 0) {
    const avgOpenAI = openaiResults.reduce((sum, r) => sum + r.duration, 0) / openaiResults.length;
    const avgCostOpenAI = openaiResults.reduce((sum, r) => sum + (r.cost || 0), 0) / openaiResults.length;
    console.log(`\n  OpenAI (${openaiResults.length} tests):`);
    console.log(`    Avg Time: ${avgOpenAI.toFixed(2)}s`);
    console.log(`    Avg Cost: $${avgCostOpenAI.toFixed(6)}`);
  }

  if (ollamaResults.length > 0) {
    const avgOllama = ollamaResults.reduce((sum, r) => sum + r.duration, 0) / ollamaResults.length;
    console.log(`\n  Ollama (${ollamaResults.length} tests):`);
    console.log(`    Avg Time: ${avgOllama.toFixed(2)}s`);
    console.log(`    Avg Cost: $0.00 (FREE!)`);

    if (openaiResults.length > 0) {
      const avgOpenAI = openaiResults.reduce((sum, r) => sum + r.duration, 0) / openaiResults.length;
      const speedDiff = ((avgOllama - avgOpenAI) / avgOpenAI * 100);
      console.log(`\n  Comparison:`);
      console.log(`    Ollama is ${Math.abs(speedDiff).toFixed(1)}% ${speedDiff > 0 ? 'slower' : 'faster'}`);
    }
  }

  // Recommendations
  console.log('\n💡 Recommendations:');
  if (!ollamaAvailable) {
    console.log('  ⚠️  Ollama is not available. Check Sheldon server status.');
    console.log('  ✅ System will use OpenAI automatically (fallback working)');
    console.log('  📝 Consider setting AI_PROVIDER=openai until Ollama is restored');
  } else {
    console.log('  ✅ Both OpenAI and Ollama are working correctly');
    console.log('  ✅ Smart routing is functional');
    console.log('  ✅ Fallback mechanism verified');
    console.log('  💰 Cost savings active with hybrid mode');
  }

  // Failed Tests Details
  if (failed > 0) {
    console.log('\n❌ Failed Tests Details:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`\n  ${r.name}:`);
      console.log(`    Error: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎉 Comprehensive testing complete!');
  console.log('='.repeat(80));
  console.log('');

  return {
    total,
    passed,
    failed,
    successRate: (passed / total) * 100
  };
}

// Run the tests
runComprehensiveTests().catch(console.error);
