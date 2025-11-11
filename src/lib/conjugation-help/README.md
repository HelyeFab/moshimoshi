# Conjugation Help System

Smart error analysis and contextual help for Japanese conjugation practice.

## Overview

This system analyzes conjugation errors made by users and provides intelligent, contextual help suggestions. It combines:

- **Error Classification**: 7 types of error detection (wrong-form, wrong-verb-type, special-case, etc.)
- **Smart Pattern Matching**: Levenshtein distance + Japanese text normalization
- **Relevance Scoring**: Multi-factor algorithm to rank help content
- **23 Help Bubbles**: Comprehensive coverage of all conjugation concepts

## Quick Start

```typescript
import { ConjugationErrorAnalyzer } from '@/lib/conjugation-help';

// Analyze an error
const report = ConjugationErrorAnalyzer.analyzeError(
  '食べた',        // User's answer
  '食べない',      // Correct answer
  'negative',      // Form being practiced
  word             // JapaneseWord object
);

// Use the results
console.log(report.analysis.errorType);        // 'wrong-form'
console.log(report.quickTip);                  // Quick hint message
console.log(report.relevantHelp);              // Top 3 help bubbles
console.log(report.detailedExplanation);       // Full explanation
```

## Error Types

1. **wrong-form**: User used a different valid conjugation form
2. **wrong-verb-type**: Applied wrong rules (Godan vs Ichidan confusion)
3. **special-case**: Missed exceptions (行く, いい, ある)
4. **okurigana-missing**: Incorrect okurigana (kana after kanji)
5. **close-match**: Very close, likely typo (similarity > 70%)
6. **partial-correct**: Partially right (similarity 40-70%)
7. **completely-wrong**: No similarity detected

## API Reference

### Main Function

```typescript
ConjugationErrorAnalyzer.analyzeError(
  userInput: string,
  correctAnswer: string,
  attemptedForm: keyof ExtendedConjugationForms,
  word: JapaneseWord,
  options?: AnalysisOptions
): ConjugationErrorReport
```

### Options

```typescript
interface AnalysisOptions {
  includeHelp?: boolean;         // Default: true
  maxHelpItems?: number;         // Default: 3
  similarityThreshold?: number;  // Default: 0.3
  considerRomaji?: boolean;      // Default: true
}
```

### Return Type

```typescript
interface ConjugationErrorReport {
  analysis: ErrorAnalysis;       // Classification & metrics
  relevantHelp: RankedHelp[];    // Top help bubbles
  quickTip?: string;             // One-liner hint
  detailedExplanation?: string;  // Full explanation
}
```

## Architecture

```
ConjugationErrorAnalyzer (Main API)
├── ConjugationErrorClassifier (Error Detection)
│   ├── detectConjugationForm()
│   ├── isVerbTypeConfusion()
│   ├── detectSpecialCaseError()
│   └── hasOkuriganaIssue()
├── HelpRelevanceScorer (Content Ranking)
│   ├── scoreByErrorPattern()
│   ├── scoreByWordType()
│   ├── scoreByFormType()
│   └── scoreByErrorType()
└── HELP_CONTENT (23 bubbles)
```

## Performance

- **Error Analysis**: <1ms per error (target: <10ms)
- **Help Ranking**: <1ms for top 3 results
- **Test Coverage**: 26 unit tests, all passing
- **Validation**: 7 integration tests, all passing

## Integration Example

### Drill Page

```typescript
const handleAnswer = (answer: string) => {
  const currentQuestion = session.questions[currentQuestionIndex];
  const isCorrect = answer === currentQuestion.correctAnswer;

  if (!isCorrect) {
    // Analyze the error
    const errorReport = ConjugationErrorAnalyzer.analyzeError(
      answer,
      currentQuestion.correctAnswer,
      currentQuestion.targetForm,
      currentQuestion.word
    );

    // Store for display
    setCurrentErrorReport(errorReport);

    // Show smart help modal (Phase 3)
    if (errorReport.relevantHelp.length > 0) {
      showHelpModal(errorReport.relevantHelp[0]);
    }
  }
};
```

### Conjugation Page

```typescript
// Add help icons next to each form
<HelpIcon
  formType="negative"
  wordType={word.type}
  onClick={() => {
    const help = getRelevantHelp({ word, formType: 'negative' });
    showHelpModal(help[0]);
  }}
/>
```

## Special Cases Handled

1. **行く exception**: Detects 行いて/行きて → suggests 行って
2. **いい exception**: Detects いかった/いくない → suggests よかった/よくない
3. **ある special**: Detects あっている → explains no ている form exists
4. **Verb type confusion**: Detects Godan rules on Ichidan verbs and vice versa
5. **Form confusion**: Identifies when user entered a different valid form

## Help Content Structure

Each help bubble includes:

```typescript
interface HelpContent {
  id: string;                    // Unique identifier
  category: string;              // verb-type, form, tense, etc.
  emoji: string;                 // Visual identifier
  title: string;                 // Short title
  tooltip: string;               // Hover text (brief)
  explanation: string;           // Full explanation (modal)
  examples: HelpExample[];       // Japanese + translations
  tip?: string;                  // Optional mnemonic
  triggers: {
    formTypes: string[];         // When to show
    wordTypes: string[];         // Which verb types
    errorPatterns?: string[];    // Regex for smart detection
  };
}
```

## Testing

```bash
# Run unit tests
npm test -- src/lib/conjugation-help/__tests__/error-analyzer.test.ts

# Run validation script
npx tsx scripts/test-error-analyzer.ts
```

## Next Steps (Phase 3)

- [ ] Create `HelpIcon.tsx` component (tooltip + click)
- [ ] Create `HelpModal.tsx` component (full explanation)
- [ ] Create `useConjugationHelp` hook (context provider)
- [ ] Integrate into drill page (smart error detection)
- [ ] Integrate into conjugation page (manual help icons)

## Dependencies

- `@/lib/conjugation/engine` - Conjugation generation
- `@/lib/review-engine/validation/validation-utils` - Levenshtein distance
- `@/data/conjugation-help` - Help content library

## Files

```
src/lib/conjugation-help/
├── index.ts                      # Main export
├── types.ts                      # TypeScript interfaces
├── error-analyzer.ts             # Main API
├── error-classifier.ts           # Error detection
├── relevance-scorer.ts           # Help ranking
└── __tests__/
    └── error-analyzer.test.ts    # 26 unit tests

src/data/conjugation-help/
├── index.ts                      # Export wrapper
└── help-content.ts               # 23 help bubbles

scripts/
├── test-error-analyzer.ts        # Validation script
└── validate-help-content.ts      # Content validation
```

---

**Status**: Phase 2 Complete ✅
**Next Phase**: UI Components (HelpIcon, HelpModal, Provider)
