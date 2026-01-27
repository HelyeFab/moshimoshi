# Adding New Grammar Content to Grammar Stall

**Status:** ACTIVE
**Last Updated:** 2026-01-27
**Author:** Claude (Grammar Stall Expert)

---

## Overview

This guide explains how to add new grammar content to the Grammar Stall feature. The system uses static JSON files served from `/public/data/grammar/` which are loaded at runtime.

**What you'll create:**
1. Grammar Point file (explanation, structure, examples)
2. Exercise file (10 exercises: multiple-choice, fill-in-blank, sentence-matching)
3. Index entries (for discovery, search, and navigation)

---

## File Locations

```
/public/data/grammar/
├── n5-index.json                    # List of all N5 grammar points
├── n4-index.json                    # List of all N4 grammar points
├── points-index.json                # Maps pointId → level (n5, n4, etc.)
├── search-index.json                # Full-text search entries
├── category-labels.json             # i18n labels for categories
├── sections/
│   ├── n5.json                      # Chapter groupings for N5
│   └── n4.json                      # Chapter groupings for N4
├── points/
│   ├── n5/
│   │   └── {pointId}.json           # Grammar point explanations
│   └── n4/
│       └── {pointId}.json
└── exercises/
    ├── n5/
    │   └── {pointId}.json           # Exercise files
    └── n4/
        └── {pointId}.json
```

---

## Step 1: Determine the Point ID and Order

### ID Format
```
{3-digit-number}-{kebab-case-slug}
```

### Finding the Next Number
1. Open the relevant index file (e.g., `n5-index.json`)
2. Find the last entry's order number
3. Use the next number

**Example:** If N5 has 80 points, the next would be `081-{slug}`

### Slug Guidelines
- Use the main grammar pattern in romaji
- Use kebab-case (hyphens, lowercase)
- Keep it short but descriptive

**Examples:**
- `081-ta-kedo` (〜たけど)
- `082-te-shimau` (〜てしまう)
- `083-you-ni-naru` (〜ようになる)

---

## Step 2: Create the Grammar Point File

**Location:** `/public/data/grammar/points/{level}/{pointId}.json`

### Schema

```typescript
interface GrammarPoint {
  id: string;                    // Must match filename (without .json)
  version: string;               // Semantic version, e.g., "1.0.0"
  title: {
    ja: string;                  // Japanese title with grammar pattern
    romaji: string;              // Romanized version
    en: string;                  // English translation/meaning
  };
  jlptLevel: "N5" | "N4" | "N3" | "N2" | "N1";
  category: string;              // See categories below
  explanation: {
    en: string;                  // Detailed English explanation
    ja: string;                  // Japanese explanation (can be empty)
  };
  structure: {
    pattern: string;             // The grammar pattern formula
    components: StructureComponent[];
  };
  examples: Example[];           // 3-5 example sentences
  relatedPoints: string[];       // IDs of related grammar points
  commonMistakes?: CommonMistake[];
  tags: string[];                // For search and categorization
}

interface StructureComponent {
  part: string;                  // The component (e.g., "Verb", "けど")
  explanation: string;           // What this part does
  examples: string[];            // Example words/forms
}

interface Example {
  japanese: string;              // Full sentence in Japanese
  romaji: string;                // Romanized version
  english: string;               // English translation
  breakdown: Record<string, string>;  // Word-by-word breakdown
  notes?: string;                // Optional usage note
}

interface CommonMistake {
  mistake: string;               // What learners do wrong
  correction: string;            // The correct approach
  example: string;               // Example showing wrong → right
}
```

### Categories

| Category | Description |
|----------|-------------|
| `basic-sentences` | Fundamental sentence patterns |
| `particles` | Particle usage (は, が, を, etc.) |
| `verbs` | Verb forms and conjugations |
| `adjectives` | Adjective usage and forms |
| `time-expressions` | Time-related grammar |
| `existence` | いる/ある patterns |
| `comparisons` | Comparison patterns |
| `questions` | Question words and patterns |
| `numbers-counters` | Counters and number expressions |
| `miscellaneous` | Other grammar points |

### Example Grammar Point File

```json
{
  "id": "081-ta-kedo",
  "version": "1.0.0",
  "title": {
    "ja": "〜たけど",
    "romaji": "~ta kedo",
    "en": "Although / But (past)"
  },
  "jlptLevel": "N5",
  "category": "miscellaneous",
  "explanation": {
    "en": "This pattern connects a past action with a contrasting result...\n\nKey points:\n• 〜た = Past tense plain form\n• けど = Conjunction meaning \"but\"\n...",
    "ja": ""
  },
  "structure": {
    "pattern": "[Verb た-form] + けど",
    "components": [
      {
        "part": "Verb (た-form)",
        "explanation": "Past tense plain form of a verb",
        "examples": ["食べた", "行った", "見た"]
      },
      {
        "part": "けど",
        "explanation": "Casual conjunction meaning 'but' or 'although'",
        "examples": ["けど", "けれど", "けれども"]
      }
    ]
  },
  "examples": [
    {
      "japanese": "映画を見たけど、よくわからなかった。",
      "romaji": "Eiga wo mita kedo, yoku wakaranakatta.",
      "english": "I watched the movie, but I didn't really understand it.",
      "breakdown": {
        "映画": "movie",
        "を": "object marker",
        "見た": "watched (past plain)",
        "けど": "but",
        "よく": "well",
        "わからなかった": "didn't understand"
      },
      "notes": "Common everyday usage showing contrast"
    }
  ],
  "relatedPoints": [
    "079-kara-because",
    "080-node-so"
  ],
  "commonMistakes": [
    {
      "mistake": "Using ます-form instead of た-form before けど",
      "correction": "けど attaches to plain form, not polite form",
      "example": "❌ 食べましたけど → ✅ 食べたけど"
    }
  ],
  "tags": ["conjunction", "contrast", "past-tense", "casual", "conversation"]
}
```

---

## Step 3: Create the Exercise File

**Location:** `/public/data/grammar/exercises/{level}/{pointId}.json`

### Schema

```typescript
interface ExerciseFile {
  grammarPointId: string;        // Must match the grammar point ID
  version: string;
  totalExercises: number;        // Should be 10
  exercises: Exercise[];
}

type Exercise =
  | MultipleChoiceExercise
  | FillInBlankExercise
  | SentenceMatchingExercise;

interface BaseExercise {
  id: string;                    // Format: {pointId}-ex-{2-digit-number}
  type: "multiple-choice" | "fill-in-blank" | "sentence-matching";
  question: string;
  questionRomaji?: string;
  correctFeedback: string;
  incorrectFeedback: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

interface MultipleChoiceExercise extends BaseExercise {
  type: "multiple-choice";
  options: { id: string; text: string; romaji?: string }[];  // 3-4 options
  correctAnswer: string;         // The id of the correct option ("a", "b", etc.)
}

interface FillInBlankExercise extends BaseExercise {
  type: "fill-in-blank";
  correctAnswer: string;
  acceptedVariations?: string[]; // Alternative correct answers
  hints?: string[];
}

interface SentenceMatchingExercise extends BaseExercise {
  type: "sentence-matching";
  pairs: {
    japanese: string;
    romaji: string;
    english: string;
  }[];                           // 3 pairs
}
```

### Exercise Distribution (10 total)

| Type | Count | Difficulty |
|------|-------|------------|
| Multiple Choice | 4 | 2 easy, 2 medium |
| Fill-in-Blank | 4 | 1 easy, 2 medium, 1 hard |
| Sentence Matching | 2 | 1 medium, 1 hard |

**Note:** Sentence matching exercises get split into individual pairs during practice (3 pairs = 3 questions), so 2 exercises become 6 questions.

### Exercise ID Format
```
{pointId}-ex-{01-10}
```

### Example Exercise File

```json
{
  "grammarPointId": "081-ta-kedo",
  "version": "1.0.0",
  "totalExercises": 10,
  "exercises": [
    {
      "id": "081-ta-kedo-ex-01",
      "type": "multiple-choice",
      "question": "Choose the correct form: 映画を（見る）＿＿、よくわからなかった。",
      "questionRomaji": "Eiga wo (miru) __, yoku wakaranakatta.",
      "options": [
        { "id": "a", "text": "見たけど", "romaji": "mita kedo" },
        { "id": "b", "text": "見ますけど", "romaji": "mimasu kedo" },
        { "id": "c", "text": "見るけど", "romaji": "miru kedo" },
        { "id": "d", "text": "見てけど", "romaji": "mite kedo" }
      ],
      "correctAnswer": "a",
      "correctFeedback": "Correct! 見た is the past plain form of 見る.",
      "incorrectFeedback": "Use the た-form (past plain) + けど.",
      "explanation": "〜たけど requires the past plain form (た-form) of the verb.",
      "difficulty": "easy"
    },
    {
      "id": "081-ta-kedo-ex-02",
      "type": "fill-in-blank",
      "question": "Fill in the blank: ケーキを（食べる）__________、まだお腹がすいています。",
      "correctAnswer": "食べたけど",
      "acceptedVariations": [
        "たべたけど",
        "tabeta kedo",
        "tabetakedo"
      ],
      "correctFeedback": "Perfect! 食べる → 食べた + けど = 食べたけど",
      "incorrectFeedback": "The answer is 食べたけど (tabeta kedo).",
      "explanation": "食べる (ru-verb) → 食べた (past plain) + けど",
      "hints": ["Convert 食べる to past plain form", "Add けど after"],
      "difficulty": "easy"
    },
    {
      "id": "081-ta-kedo-ex-08",
      "type": "sentence-matching",
      "question": "Match the Japanese with the English:",
      "pairs": [
        {
          "japanese": "勉強したけど、テストに落ちた。",
          "romaji": "Benkyou shita kedo, tesuto ni ochita.",
          "english": "I studied, but I failed the test."
        },
        {
          "japanese": "映画を見たけど、つまらなかった。",
          "romaji": "Eiga wo mita kedo, tsumaranakatta.",
          "english": "I watched the movie, but it was boring."
        },
        {
          "japanese": "薬を飲んだけど、まだ頭が痛い。",
          "romaji": "Kusuri wo nonda kedo, mada atama ga itai.",
          "english": "I took medicine, but my head still hurts."
        }
      ],
      "correctFeedback": "Perfect matching!",
      "incorrectFeedback": "Review the sentences and try again.",
      "explanation": "All sentences use [た-form verb] + けど + contrasting result.",
      "difficulty": "hard"
    }
  ]
}
```

### Accepted Variations Guidelines

For fill-in-blank exercises, include these variations:
- Kanji version: `食べたけど`
- Hiragana version: `たべたけど`
- Romaji versions: `tabeta kedo`, `tabetakedo`
- With/without punctuation: `食べたけど。`

---

## Step 4: Update Index Files

### 4a. Update Level Index (`n5-index.json` or `n4-index.json`)

Add to the `points` array:

```json
{
  "id": "081-ta-kedo",
  "order": 81,
  "category": "miscellaneous",
  "title": {
    "ja": "〜たけど",
    "romaji": "~ta kedo",
    "en": "Although / But (past)"
  },
  "shortDescription": "Connect past actions with contrasting results using た-form + けど.",
  "jlptLevel": "N5",
  "difficulty": "beginner"
}
```

Also update `totalPoints` at the top of the file.

### 4b. Update Points Index (`points-index.json`)

Add to the `points` object:

```json
"081-ta-kedo": "n5"
```

### 4c. Update Search Index (`search-index.json`)

Add to the `entries` array:

```json
{
  "id": "081-ta-kedo",
  "level": "n5",
  "jlptLevel": "N5",
  "category": "miscellaneous",
  "title": {
    "ja": "〜たけど",
    "romaji": "~ta kedo",
    "en": "Although / But (past)"
  },
  "shortDescription": "Connect past actions with contrasting results using た-form + けど.",
  "tags": ["conjunction", "contrast", "past-tense", "casual", "conversation"],
  "searchText": "〜たけど ~ta kedo although but past connect past actions with contrasting results miscellaneous conjunction contrast casual conversation けど kedo"
}
```

**searchText should include:**
- Japanese title
- Romaji
- English meaning
- Key words from description
- Category
- All tags
- Key vocabulary (けど, etc.)

Also update `totalPoints` at the top.

### 4d. Update Sections File (`sections/{level}.json`)

Add the point ID to the appropriate chapter's `points` array:

```json
{
  "id": "n5-ch14",
  "order": 14,
  "title": { "en": "Giving Reasons & Explanations", ... },
  "points": [
    "079-kara-because",
    "080-node-so",
    "081-ta-kedo"     // <-- Add here
  ]
}
```

---

## Step 5: Validation Checklist

Before deploying, verify:

### File Existence
- [ ] `/public/data/grammar/points/{level}/{pointId}.json` exists
- [ ] `/public/data/grammar/exercises/{level}/{pointId}.json` exists

### Grammar Point File
- [ ] `id` matches filename
- [ ] All required fields present
- [ ] 3-5 examples with breakdowns
- [ ] Related points are valid IDs
- [ ] Tags are relevant and searchable

### Exercise File
- [ ] `grammarPointId` matches grammar point `id`
- [ ] Exactly 10 exercises
- [ ] Mix of difficulties (easy/medium/hard)
- [ ] Mix of types (MC/FIB/SM)
- [ ] All exercise IDs follow format `{pointId}-ex-{01-10}`
- [ ] Accepted variations include hiragana and romaji

### Index Files
- [ ] `n{level}-index.json` - entry added, `totalPoints` updated
- [ ] `points-index.json` - mapping added
- [ ] `search-index.json` - entry added, `totalPoints` updated
- [ ] `sections/{level}.json` - added to chapter

### JSON Validation
```bash
# Validate all JSON files
node -e "JSON.parse(require('fs').readFileSync('public/data/grammar/points/n5/{pointId}.json'))"
node -e "JSON.parse(require('fs').readFileSync('public/data/grammar/exercises/n5/{pointId}.json'))"
node -e "JSON.parse(require('fs').readFileSync('public/data/grammar/n5-index.json'))"
node -e "JSON.parse(require('fs').readFileSync('public/data/grammar/points-index.json'))"
node -e "JSON.parse(require('fs').readFileSync('public/data/grammar/search-index.json'))"
node -e "JSON.parse(require('fs').readFileSync('public/data/grammar/sections/n5.json'))"
```

---

## Transforming Raw Content to JSON

### Input Format (What You Receive)

Typically raw content looks like this:

```
🧠 Structure: 〜たけど (ta kedo)
🧩 Grammar Breakdown
〜た = Past tense plain form
けど = Conjunction meaning "but"

📚 Example Verbs
食べる → 食べた
行く → 行った

🧪 Example Sentences
映画を見たけど、よくわからなかった。
えいが を みた けど、よく わからなかった。
I watched the movie, but I didn't really understand it.

📝 Practice Exercises
...
```

### Transformation Process

1. **Extract the title**
   - Japanese: `〜たけど`
   - Romaji: `~ta kedo`
   - English: Derive from the meaning ("Although / But (past)")

2. **Parse the structure**
   - Identify components from the breakdown section
   - Create pattern formula: `[Verb た-form] + けど`

3. **Convert examples**
   - Split into japanese/romaji/english
   - Create word-by-word breakdown
   - Add contextual notes

4. **Create exercises from practice section**
   - Convert fill-in prompts to fill-in-blank exercises
   - Convert "choose correct" to multiple-choice
   - Convert matching to sentence-matching

5. **Generate metadata**
   - Pick appropriate category
   - Create searchable tags
   - Build search text string

---

## Quick Reference: Files to Create/Update

| File | Action | Required Fields |
|------|--------|-----------------|
| `points/{level}/{id}.json` | CREATE | id, title, explanation, structure, examples, tags |
| `exercises/{level}/{id}.json` | CREATE | grammarPointId, exercises (10) |
| `{level}-index.json` | UPDATE | Add to points[], update totalPoints |
| `points-index.json` | UPDATE | Add "{id}": "{level}" |
| `search-index.json` | UPDATE | Add entry, update totalPoints |
| `sections/{level}.json` | UPDATE | Add id to chapter points[] |

---

## Troubleshooting

### Content Not Appearing

1. **Hard refresh browser** (`Ctrl+Shift+R`)
2. Check JSON validity with node commands above
3. Verify `points-index.json` has the mapping
4. Check browser console for 404 errors

### Search Not Finding Content

1. Verify `search-index.json` entry exists
2. Check `searchText` includes the search terms
3. Ensure `level` field is lowercase (`n5`, not `N5`)

### Practice Page Error

1. Check `grammarPointId` matches exactly
2. Verify exercise file path is correct
3. Check exercises array has valid structure

---

## Practice Page Features

The grammar practice page (`/learn/grammar/{pointId}/practice`) includes several user experience features:

### Furigana Toggle

Japanese text in grammar practice cards displays with furigana (reading hints) above kanji characters. Users can toggle this on/off using the **ふりがな** button at the top-right of the card area.

- **Default:** Furigana enabled (`showFurigana: true`)
- **Toggle button:** BookOpen icon with ふりがな label
- **Behavior:** Applies to both question text (`primaryDisplay`) and answer text (`primaryAnswer`)

The furigana is generated dynamically using the `FuriganaText` component (`/src/components/grammar/FuriganaText.tsx`) which uses `generateFuriganaWithCache` from the furigana utility.

### Input Behavior

- Text input field **hides after submission** to reduce clutter
- Confidence slider appears before submission
- Answer feedback (correct/incorrect) displays after submission
- Next button appears to advance to the next question

### Component Architecture

```
PracticePage
  └── ReviewSessionUI
        ├── ProgressBar
        ├── Furigana Toggle (ふりがな button)
        ├── ReviewCard
        │     └── CustomCard (with FuriganaText for grammar)
        ├── AnswerInput → TextInput
        └── Action Buttons (Cancel, Skip, Next)
```

Key files:
- `/src/components/review-engine/ReviewSessionUI.tsx` - Session UI with furigana toggle
- `/src/components/review-engine/ReviewCard.tsx` - Card wrapper with showFurigana prop
- `/src/components/review-engine/cards/CustomCard.tsx` - Grammar card with FuriganaText
- `/src/components/grammar/FuriganaText.tsx` - Furigana rendering component

---

## Related Documentation

- `/src/lib/grammar/types.ts` - TypeScript interfaces
- `/src/lib/grammar/grammarService.ts` - File loading service
- `/src/lib/grammar/exerciseValidator.ts` - Answer validation
- `/01_PRE-PRODUCTION_DOCS/grammar-stall-mvp/` - Original MVP specs

---

*This guide ensures consistent, high-quality grammar content that integrates seamlessly with the Grammar Stall system.*
