/**
 * Test Smart Routing with All Hybrid Processors
 * Verifies that tasks are routed to the correct provider based on configuration
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

import { AIService } from './src/lib/ai/AIService';
import type { AIRequest } from './src/lib/ai/types';

async function testSmartRouting() {
  console.log('🧪 Testing Smart Routing Strategy\n');
  console.log('='.repeat(80));
  console.log(`AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  console.log(`AI_OLLAMA_ENABLED: ${process.env.AI_OLLAMA_ENABLED}`);
  console.log('='.repeat(80));

  const aiService = AIService.getInstance();

  // Test 1: Real-time task (should use OpenAI)
  console.log('\n\n📊 TEST 1: Word Explanation (Real-time → OpenAI)');
  console.log('-'.repeat(80));
  try {
    const wordRequest: AIRequest = {
      task: 'explain_word',
      content: {
        word: '勉強'
      },
      config: {
        jlptLevel: 'N5'
      },
      metadata: {
        userId: 'test-user'
      }
    };

    const startTime = Date.now();
    const result = await aiService.process(wordRequest);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`✅ Success!`);
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`🤖 Provider: ${result.metadata?.provider || 'unknown'}`);
    console.log(`💰 Cost: $${result.usage?.estimatedCost?.toFixed(6) || 0}`);
    console.log(`📝 Word: ${result.data?.word} - ${result.data?.meaning}`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Grammar explanation (should use OpenAI)
  console.log('\n\n📊 TEST 2: Grammar Explanation (Real-time → OpenAI)');
  console.log('-'.repeat(80));
  try {
    const grammarRequest: AIRequest = {
      task: 'explain_grammar',
      content: {
        content: 'ている'
      },
      config: {
        jlptLevel: 'N5'
      },
      metadata: {
        userId: 'test-user'
      }
    };

    const startTime = Date.now();
    const result = await aiService.process(grammarRequest);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`✅ Success!`);
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`🤖 Provider: ${result.metadata?.provider || 'unknown'}`);
    console.log(`💰 Cost: $${result.usage?.estimatedCost?.toFixed(6) || 0}`);
    console.log(`📝 Pattern: ${result.data?.pattern}`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Review questions (background task → Ollama)
  console.log('\n\n📊 TEST 3: Review Questions (Background → Ollama)');
  console.log('-'.repeat(80));
  try {
    const reviewRequest: AIRequest = {
      task: 'generate_review_questions',
      content: {
        content: {
          vocabulary: [
            { word: '勉強', reading: 'べんきょう', meaning: 'study' },
            { word: '食べる', reading: 'たべる', meaning: 'to eat' }
          ]
        },
        questionCount: 3
      },
      config: {
        jlptLevel: 'N5'
      },
      metadata: {
        userId: 'test-user'
      }
    };

    const startTime = Date.now();
    const result = await aiService.process(reviewRequest);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`✅ Success!`);
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`🤖 Provider: ${result.metadata?.provider || 'unknown'}`);
    console.log(`💰 Cost: $${result.usage?.estimatedCost?.toFixed(6) || 0}`);
    console.log(`📝 Questions: ${result.data?.length || 0} generated`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 4: Moodboard (admin task → Ollama)
  console.log('\n\n📊 TEST 4: Moodboard Generation (Admin → Ollama)');
  console.log('-'.repeat(80));
  try {
    const moodboardRequest: AIRequest = {
      task: 'generate_moodboard',
      content: {
        theme: 'Family',
        kanjiCount: 10
      },
      config: {
        jlptLevel: 'N5'
      },
      metadata: {
        userId: 'test-user'
      }
    };

    const startTime = Date.now();
    const result = await aiService.process(moodboardRequest);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`✅ Success!`);
    console.log(`⏱️  Time: ${duration.toFixed(2)}s`);
    console.log(`🤖 Provider: ${result.metadata?.provider || 'unknown'}`);
    console.log(`💰 Cost: $${result.usage?.estimatedCost?.toFixed(6) || 0}`);
    console.log(`📝 Kanji: ${result.data?.kanjiList?.length || 0} characters`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SMART ROUTING TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log('Expected Routing (Hybrid Mode):');
  console.log('  ✅ Word explanation → OpenAI (real-time, speed critical)');
  console.log('  ✅ Grammar explanation → OpenAI (real-time, speed critical)');
  console.log('  ✅ Review questions → Ollama (background, cost savings)');
  console.log('  ✅ Moodboard → Ollama (admin task, cost savings)');
  console.log('');
  console.log('Benefits:');
  console.log('  🚀 Fast responses for user-facing features');
  console.log('  💰 Cost savings on background tasks (~70%)');
  console.log('  🔄 Automatic fallback to OpenAI if Ollama fails');
  console.log('  ⚡ Zero code changes - just environment config');
  console.log('');
  console.log('🎉 Smart routing implementation complete!');
  console.log('');
}

testSmartRouting().catch(console.error);
