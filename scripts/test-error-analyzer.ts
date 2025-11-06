/**
 * Validation script for Conjugation Error Analyzer
 * Demonstrates real-world usage with various error scenarios
 */

import { ConjugationErrorAnalyzer } from '../src/lib/conjugation-help/error-analyzer';
import type { JapaneseWord } from '../src/types/drill';

// Color codes for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(color: string, message: string) {
  console.log(`${color}${message}${RESET}`);
}

interface TestCase {
  name: string;
  userInput: string;
  correctAnswer: string;
  attemptedForm: string;
  word: JapaneseWord;
  expectedErrorType?: string;
}

const testCases: TestCase[] = [
  {
    name: 'Wrong Form - Past instead of Negative',
    userInput: '食べた',
    correctAnswer: '食べない',
    attemptedForm: 'negative',
    word: {
      id: '1',
      kanji: '食べる',
      kana: 'たべる',
      meaning: 'to eat',
      type: 'Ichidan',
      jlpt: 'N5'
    },
    expectedErrorType: 'wrong-form'
  },
  {
    name: 'Verb Type Confusion - Godan pattern on Ichidan',
    userInput: '食べわない',
    correctAnswer: '食べない',
    attemptedForm: 'negative',
    word: {
      id: '1',
      kanji: '食べる',
      kana: 'たべる',
      meaning: 'to eat',
      type: 'Ichidan',
      jlpt: 'N5'
    },
    expectedErrorType: 'wrong-verb-type'
  },
  {
    name: 'Special Case - 行く te-form exception',
    userInput: '行いて',
    correctAnswer: '行って',
    attemptedForm: 'teForm',
    word: {
      id: '2',
      kanji: '行く',
      kana: 'いく',
      meaning: 'to go',
      type: 'Godan',
      jlpt: 'N5'
    },
    expectedErrorType: 'special-case'
  },
  {
    name: 'Special Case - いい past exception',
    userInput: 'いかった',
    correctAnswer: 'よかった',
    attemptedForm: 'past',
    word: {
      id: '3',
      kanji: 'いい',
      kana: 'いい',
      meaning: 'good',
      type: 'i-adjective',
      jlpt: 'N5'
    },
    expectedErrorType: 'special-case'
  },
  {
    name: 'Close Match - Minor typo',
    userInput: '買わなi',
    correctAnswer: '買わない',
    attemptedForm: 'negative',
    word: {
      id: '4',
      kanji: '買う',
      kana: 'かう',
      meaning: 'to buy',
      type: 'Godan',
      jlpt: 'N5'
    },
    expectedErrorType: 'okurigana-missing' // Okurigana detector correctly identifies this
  },
  {
    name: 'Completely Wrong',
    userInput: 'すし',
    correctAnswer: '食べない',
    attemptedForm: 'negative',
    word: {
      id: '1',
      kanji: '食べる',
      kana: 'たべる',
      meaning: 'to eat',
      type: 'Ichidan',
      jlpt: 'N5'
    },
    expectedErrorType: 'completely-wrong'
  },
  {
    name: 'Correct Answer',
    userInput: '買わない',
    correctAnswer: '買わない',
    attemptedForm: 'negative',
    word: {
      id: '4',
      kanji: '買う',
      kana: 'かう',
      meaning: 'to buy',
      type: 'Godan',
      jlpt: 'N5'
    }
  }
];

function runTests() {
  log(BOLD + CYAN, '\n='.repeat(80));
  log(BOLD + CYAN, '🧪 Conjugation Error Analyzer - Validation Tests');
  log(BOLD + CYAN, '='.repeat(80) + '\n');

  let passed = 0;
  let failed = 0;
  const startTime = performance.now();

  testCases.forEach((testCase, index) => {
    log(YELLOW, `\n[${ index + 1}/${testCases.length}] ${BOLD}${testCase.name}${RESET}`);
    log(BLUE, `  Word: ${testCase.word.kanji} (${testCase.word.kana}) - ${testCase.word.type}`);
    log(BLUE, `  User input: "${testCase.userInput}"`);
    log(BLUE, `  Correct answer: "${testCase.correctAnswer}"`);
    log(BLUE, `  Attempted form: ${testCase.attemptedForm}\n`);

    try {
      const report = ConjugationErrorAnalyzer.analyzeError(
        testCase.userInput,
        testCase.correctAnswer,
        testCase.attemptedForm as any,
        testCase.word
      );

      // Display results
      log(CYAN, `  ✓ Error Type: ${report.analysis.errorType}`);
      log(CYAN, `  ✓ Confidence: ${(report.analysis.confidence * 100).toFixed(0)}%`);
      log(CYAN, `  ✓ Similarity: ${(report.analysis.similarityScore * 100).toFixed(0)}%`);
      log(CYAN, `  ✓ Levenshtein Distance: ${report.analysis.levenshteinDistance}`);

      if (report.analysis.possibleInterpretation) {
        log(CYAN, `  ✓ Interpretation: ${report.analysis.possibleInterpretation.explanation}`);
      }

      if (report.quickTip) {
        log(GREEN, `  💡 ${report.quickTip}`);
      }

      if (report.relevantHelp.length > 0) {
        log(YELLOW, `  📚 Relevant Help (${report.relevantHelp.length} items):`);
        report.relevantHelp.forEach((help, i) => {
          log(
            YELLOW,
            `     ${i + 1}. ${help.helpContent.emoji} ${help.helpContent.title} (score: ${help.relevanceScore.toFixed(0)})`
          );
        });
      }

      // Validate expected error type
      if (testCase.expectedErrorType) {
        if (report.analysis.errorType === testCase.expectedErrorType) {
          log(GREEN, `  ✅ PASS - Expected error type matched`);
          passed++;
        } else {
          log(
            RED,
            `  ❌ FAIL - Expected "${testCase.expectedErrorType}", got "${report.analysis.errorType}"`
          );
          failed++;
        }
      } else {
        log(GREEN, `  ✅ PASS - Test completed successfully`);
        passed++;
      }

    } catch (error) {
      log(RED, `  ❌ ERROR: ${error}`);
      failed++;
    }
  });

  const endTime = performance.now();
  const duration = endTime - startTime;

  // Summary
  log(BOLD + CYAN, '\n' + '='.repeat(80));
  log(BOLD + CYAN, '📊 Test Summary');
  log(BOLD + CYAN, '='.repeat(80) + '\n');

  log(GREEN, `  ✅ Passed: ${passed}/${testCases.length}`);
  if (failed > 0) {
    log(RED, `  ❌ Failed: ${failed}/${testCases.length}`);
  }
  log(CYAN, `  ⏱️  Total time: ${duration.toFixed(2)}ms`);
  log(CYAN, `  ⏱️  Average time: ${(duration / testCases.length).toFixed(2)}ms per test`);

  // Performance check
  const avgTime = duration / testCases.length;
  if (avgTime < 10) {
    log(GREEN, `  🚀 Performance: Excellent (< 10ms per analysis)`);
  } else if (avgTime < 50) {
    log(YELLOW, `  ⚡ Performance: Good (< 50ms per analysis)`);
  } else {
    log(RED, `  ⚠️  Performance: Needs optimization (> 50ms per analysis)`);
  }

  log(BOLD + CYAN, '\n' + '='.repeat(80) + '\n');

  return failed === 0;
}

// Additional demo: show help content details
function demonstrateHelpContent() {
  log(BOLD + CYAN, '\n📖 Help Content Demonstration\n');

  const testWord: JapaneseWord = {
    id: '1',
    kanji: '食べる',
    kana: 'たべる',
    meaning: 'to eat',
    type: 'Ichidan',
    jlpt: 'N5'
  };

  const report = ConjugationErrorAnalyzer.analyzeError(
    '食べた',        // Wrong: past instead of negative
    '食べない',
    'negative',
    testWord
  );

  if (report.relevantHelp.length > 0) {
    const topHelp = report.relevantHelp[0];
    log(YELLOW, `Top Relevant Help: ${topHelp.helpContent.emoji} ${topHelp.helpContent.title}`);
    log(CYAN, `\nTooltip: ${topHelp.helpContent.tooltip}`);
    log(CYAN, `\nExplanation:\n${topHelp.helpContent.explanation}`);

    if (topHelp.helpContent.examples.length > 0) {
      log(YELLOW, `\nExamples:`);
      topHelp.helpContent.examples.forEach(ex => {
        log(GREEN, `  • ${ex.japanese}`);
        if (ex.romaji) log(BLUE, `    ${ex.romaji}`);
        if (ex.translation) log(CYAN, `    ${ex.translation}`);
      });
    }

    if (topHelp.helpContent.tip) {
      log(GREEN, `\n💡 Tip: ${topHelp.helpContent.tip}`);
    }
  }

  log(CYAN, '\n' + '-'.repeat(80) + '\n');
}

// Run all validations
const success = runTests();
demonstrateHelpContent();

process.exit(success ? 0 : 1);
