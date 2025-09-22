/**
 * AI Service Test Script
 * Tests various AI service capabilities with different content types
 */

import { AIService } from '../src/lib/ai/AIService';
import {
  AIRequest,
  ReviewQuestionRequest,
  GrammarExplanationRequest
} from '../src/lib/ai/types';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(`✨ ${title}`, colors.bright + colors.blue);
  console.log('='.repeat(60));
}

function logJson(obj: any) {
  console.log(JSON.stringify(obj, null, 2));
}

async function testAIService() {
  log('\n🚀 Starting AI Service Tests\n', colors.bright + colors.green);

  // Initialize AI Service
  const aiService = AIService.getInstance();

  // Test 1: Review Questions for Kanji
  logSection('Test 1: Generate Review Questions for Kanji');
  try {
    const kanjiRequest: AIRequest<ReviewQuestionRequest> = {
      task: 'generate_review_questions',
      content: {
        content: {
          kanji: ['日', '本', '語'],
          vocabulary: [
            { word: '日本', reading: 'にほん', meaning: 'Japan' },
            { word: '日本語', reading: 'にほんご', meaning: 'Japanese language' },
            { word: '本', reading: 'ほん', meaning: 'book' }
          ]
        },
        questionCount: 5,
        questionTypes: ['multiple_choice', 'fill_blank']
      },
      config: {
        jlptLevel: 'N5',
        difficulty: 'easy'
      }
    };

    log('Request:', colors.yellow);
    logJson(kanjiRequest);

    const result = await aiService.process(kanjiRequest);

    log('\n✅ Response:', colors.green);
    logJson({
      success: result.success,
      questionCount: result.data?.length,
      sampleQuestion: result.data?.[0],
      usage: result.usage,
      cached: result.cached,
      processingTime: result.processingTime
    });

  } catch (error) {
    log(`❌ Error: ${error}`, colors.red);
  }

  // Test 2: Grammar Explanation
  logSection('Test 2: Explain Japanese Grammar Pattern');
  try {
    const grammarRequest: AIRequest<GrammarExplanationRequest> = {
      task: 'explain_grammar',
      content: {
        content: '私は毎日学校に行きます',
        focusPoints: ['に particle usage', 'ます form']
      },
      config: {
        jlptLevel: 'N5',
        style: 'casual',
        includeExamples: true
      }
    };

    log('Request:', colors.yellow);
    logJson(grammarRequest);

    const result = await aiService.process(grammarRequest);

    log('\n✅ Response:', colors.green);
    logJson({
      success: result.success,
      pattern: result.data?.pattern,
      meaning: result.data?.meaning,
      structure: result.data?.structure,
      exampleCount: result.data?.examples?.length,
      firstExample: result.data?.examples?.[0],
      usage: result.usage,
      cached: result.cached
    });

  } catch (error) {
    log(`❌ Error: ${error}`, colors.red);
  }

  // Test 3: Complex Vocabulary Review Questions
  logSection('Test 3: Generate Complex Vocabulary Questions');
  try {
    const vocabRequest: AIRequest<ReviewQuestionRequest> = {
      task: 'generate_review_questions',
      content: {
        content: {
          vocabulary: [
            { word: '食べる', reading: 'たべる', meaning: 'to eat' },
            { word: '飲む', reading: 'のむ', meaning: 'to drink' },
            { word: '見る', reading: 'みる', meaning: 'to see/watch' },
            { word: '聞く', reading: 'きく', meaning: 'to listen/ask' },
            { word: '話す', reading: 'はなす', meaning: 'to speak' }
          ],
          grammar: ['て-form', 'past tense', 'negative form']
        },
        questionCount: 8,
        questionTypes: ['multiple_choice', 'fill_blank', 'true_false']
      },
      config: {
        jlptLevel: 'N4',
        difficulty: 'medium'
      }
    };

    log('Request:', colors.yellow);
    logJson(vocabRequest);

    const result = await aiService.process(vocabRequest);

    log('\n✅ Response:', colors.green);

    // Show question type distribution
    const questionTypes = result.data?.reduce((acc: any, q: any) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {});

    logJson({
      success: result.success,
      totalQuestions: result.data?.length,
      questionTypes,
      difficulties: result.data?.map((q: any) => q.difficulty),
      usage: result.usage,
      processingTime: result.processingTime
    });

    // Show a sample of each question type
    log('\n📝 Sample Questions:', colors.magenta);
    const types = ['multiple_choice', 'fill_blank', 'true_false'];
    types.forEach(type => {
      const sample = result.data?.find((q: any) => q.type === type);
      if (sample) {
        log(`\n${type.toUpperCase()}:`, colors.yellow);
        logJson({
          question: sample.question,
          options: sample.options,
          correctAnswer: sample.correctAnswer,
          difficulty: sample.difficulty
        });
      }
    });

  } catch (error) {
    log(`❌ Error: ${error}`, colors.red);
  }

  // Test 4: Grammar Pattern Comparison
  logSection('Test 4: Compare Similar Grammar Patterns');
  try {
    const comparisonRequest: AIRequest<GrammarExplanationRequest> = {
      task: 'explain_grammar',
      content: {
        content: 'たい form (want to)',
        compareWith: ['ほしい (want something)', 'たがる (someone else wants to)']
      },
      config: {
        jlptLevel: 'N4',
        style: 'formal'
      }
    };

    log('Request:', colors.yellow);
    logJson(comparisonRequest);

    const result = await aiService.process(comparisonRequest);

    log('\n✅ Response:', colors.green);
    logJson({
      success: result.success,
      pattern: result.data?.pattern,
      meaning: result.data?.meaning,
      relatedPatterns: result.data?.relatedPatterns,
      commonMistakes: result.data?.commonMistakes,
      formality: result.data?.formality,
      usage: result.usage
    });

  } catch (error) {
    log(`❌ Error: ${error}`, colors.red);
  }

  // Test 5: Batch Processing
  logSection('Test 5: Batch Processing Multiple Requests');
  try {
    const batchRequests: AIRequest[] = [
      {
        task: 'generate_review_questions',
        content: {
          content: { kanji: ['水', '火', '木'] },
          questionCount: 3,
          questionTypes: ['multiple_choice']
        },
        config: { jlptLevel: 'N5' }
      },
      {
        task: 'explain_grammar',
        content: {
          content: 'ている (continuous form)'
        },
        config: { jlptLevel: 'N5' }
      }
    ];

    log('Batch Requests:', colors.yellow);
    logJson(batchRequests);

    const results = await aiService.processBatch(batchRequests);

    log('\n✅ Batch Results:', colors.green);
    results.forEach((result, index) => {
      log(`\nRequest ${index + 1}:`, colors.yellow);
      logJson({
        success: result.success,
        dataType: result.data ? (Array.isArray(result.data) ? 'questions' : 'explanation') : 'none',
        error: result.error,
        usage: result.usage
      });
    });

  } catch (error) {
    log(`❌ Error: ${error}`, colors.red);
  }

  // Test 6: Usage Statistics
  logSection('Test 6: Usage Statistics');
  try {
    const stats = await aiService.getUsageStats();

    log('📊 Current Usage Stats:', colors.green);
    logJson({
      totalRequests: stats.totalRequests,
      totalCost: `$${stats.totalCost.toFixed(4)}`,
      totalTokens: stats.totalTokens,
      byTask: stats.byTask,
      byModel: stats.byModel
    });

  } catch (error) {
    log(`❌ Error: ${error}`, colors.red);
  }

  // Test 7: Health Check
  logSection('Test 7: Service Health Check');
  try {
    const health = await aiService.healthCheck();

    log('🏥 Health Status:', colors.green);
    logJson(health);

  } catch (error) {
    log(`❌ Error: ${error}`, colors.red);
  }

  log('\n✨ All tests completed!\n', colors.bright + colors.green);
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAIService().catch(error => {
    log(`\n❌ Fatal error: ${error}`, colors.red);
    process.exit(1);
  });
}

export { testAIService };