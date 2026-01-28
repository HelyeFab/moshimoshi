# Grammar Stall Data Schema

**Project**: Moshimoshi Grammar Guide Stall
**Version**: 1.0.0
**Last Updated**: 2026-01-16

---

## 📋 Overview

This document defines the **JSON structure** and **TypeScript interfaces** for all grammar data files. Agent 1 (Data) will use these schemas to create the 80 N5 grammar point files.

---

## 🗂️ File Organization

```
/public/data/grammar/
├── n5-index.json              # Index of all 80 grammar points
├── points/                    # Individual grammar point data
│   ├── 001-x-wa-y-desu.json
│   ├── 002-particles-wa.json
│   ├── 003-particles-ga.json
│   └── ... (80 files total)
└── exercises/                 # Exercise data per grammar point
    ├── 001-x-wa-y-desu.json
    ├── 002-particles-wa.json
    ├── 003-particles-ga.json
    └── ... (80 files total)
```

### File Naming Convention

**Pattern**: `{number}-{slug}.json`

- **Number**: 3-digit zero-padded (001, 002, ..., 080)
- **Slug**: Kebab-case identifier (lowercase, hyphens)

**Examples**:
- `001-x-wa-y-desu.json` ✅
- `015-particles-ni.json` ✅
- `042-te-form-conjugation.json` ✅

**Bad Examples**:
- `1-x-wa-y-desu.json` ❌ (not zero-padded)
- `particles_wa.json` ❌ (no number)
- `015-Particles-Ni.json` ❌ (uppercase)

---

## 📚 Schema 1: Grammar Index

**File**: `/public/data/grammar/n5-index.json`

### Purpose
Lists all 80 N5 grammar points for the grid view.

### JSON Structure

```json
{
  "version": "1.0.0",
  "jlptLevel": "N5",
  "totalPoints": 80,
  "lastUpdated": "2026-01-16",
  "points": [
    {
      "id": "001-x-wa-y-desu",
      "order": 1,
      "category": "basic-sentences",
      "title": {
        "ja": "XはYです",
        "romaji": "X wa Y desu",
        "en": "X is Y"
      },
      "shortDescription": "Basic identity and description sentences",
      "jlptLevel": "N5",
      "difficulty": "beginner"
    },
    {
      "id": "002-particles-wa",
      "order": 2,
      "category": "particles",
      "title": {
        "ja": "は (topic marker)",
        "romaji": "wa",
        "en": "Topic Particle は"
      },
      "shortDescription": "Marks the topic of the sentence",
      "jlptLevel": "N5",
      "difficulty": "beginner"
    }
    // ... 78 more points
  ]
}
```

### TypeScript Interface

```typescript
// src/lib/grammar/types.ts

export interface GrammarPointIndex {
  id: string // Unique slug (e.g., "001-x-wa-y-desu")
  order: number // Display order (1-80)
  category: string // Category slug (e.g., "particles", "verbs")
  title: {
    ja: string // Japanese title
    romaji: string // Romanized title
    en: string // English title
  }
  shortDescription: string // One-line summary (50-100 chars)
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' // For MVP: always "N5"
  difficulty: 'beginner' | 'intermediate' | 'advanced' // For MVP: always "beginner"
}

export interface GrammarIndexFile {
  version: string
  jlptLevel: string
  totalPoints: number
  lastUpdated: string // ISO date
  points: GrammarPointIndex[]
}
```

### Validation Rules

- `id`: Must match filename slug (without number prefix)
- `order`: Unique integers 1-80
- `category`: One of predefined categories (see Categories section)
- `title.ja`: Required, non-empty
- `title.romaji`: Required, non-empty
- `title.en`: Required, non-empty
- `shortDescription`: 50-100 characters
- `jlptLevel`: Always "N5" for MVP
- `difficulty`: Always "beginner" for MVP

---

## 📄 Schema 2: Grammar Point Detail

**File**: `/public/data/grammar/points/{id}.json`

### Purpose
Full grammar point data including explanation, examples, and structure.

### JSON Structure

```json
{
  "id": "001-x-wa-y-desu",
  "version": "1.0.0",
  "title": {
    "ja": "XはYです",
    "romaji": "X wa Y desu",
    "en": "X is Y"
  },
  "jlptLevel": "N5",
  "category": "basic-sentences",
  "explanation": {
    "en": "This is the most basic sentence structure in Japanese. It is used to state that X is Y, where X is the topic (marked by は) and Y is the description or identity. です makes the sentence polite.\n\nKey points:\n- は (wa) marks the topic of the sentence\n- です (desu) is the copula (like 'is' in English)\n- This pattern is used for identity, occupation, nationality, etc.",
    "ja": ""
  },
  "structure": {
    "pattern": "X は Y です",
    "components": [
      {
        "part": "X",
        "explanation": "Topic (person, thing, concept)",
        "examples": ["私", "これ", "田中さん"]
      },
      {
        "part": "は",
        "explanation": "Topic marker particle (pronounced 'wa')",
        "examples": ["は"]
      },
      {
        "part": "Y",
        "explanation": "Description or identity",
        "examples": ["学生", "本", "日本人"]
      },
      {
        "part": "です",
        "explanation": "Polite copula ('is')",
        "examples": ["です"]
      }
    ]
  },
  "examples": [
    {
      "japanese": "私は学生です。",
      "romaji": "Watashi wa gakusei desu.",
      "english": "I am a student.",
      "breakdown": {
        "私": "I, me",
        "は": "topic marker (pronounced 'wa')",
        "学生": "student",
        "です": "am (polite)"
      },
      "notes": "Basic self-introduction pattern"
    },
    {
      "japanese": "これは本です。",
      "romaji": "Kore wa hon desu.",
      "english": "This is a book.",
      "breakdown": {
        "これ": "this",
        "は": "topic marker",
        "本": "book",
        "です": "is (polite)"
      },
      "notes": "Identifying objects"
    },
    {
      "japanese": "田中さんは日本人です。",
      "romaji": "Tanaka-san wa nihonjin desu.",
      "english": "Tanaka-san is Japanese.",
      "breakdown": {
        "田中さん": "Mr./Ms. Tanaka",
        "は": "topic marker",
        "日本人": "Japanese person",
        "です": "is (polite)"
      },
      "notes": "Describing nationality"
    }
  ],
  "relatedPoints": [
    "002-particles-wa",
    "005-x-wa-y-de-wa-arimasen"
  ],
  "commonMistakes": [
    {
      "mistake": "Using を instead of は",
      "correction": "は marks the topic, を marks the object",
      "example": "私を学生です ❌ → 私は学生です ✅"
    }
  ],
  "tags": ["basic", "identity", "polite", "beginner-friendly"]
}
```

### TypeScript Interface

```typescript
export interface GrammarPoint {
  id: string
  version: string
  title: {
    ja: string
    romaji: string
    en: string
  }
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  category: string
  explanation: {
    en: string
    ja: string // Empty for MVP
  }
  structure: {
    pattern: string // e.g., "X は Y です"
    components: StructureComponent[]
  }
  examples: Example[]
  relatedPoints: string[] // Array of grammar point IDs
  commonMistakes?: CommonMistake[] // Optional
  tags: string[] // Searchable keywords (post-MVP)
}

export interface StructureComponent {
  part: string // e.g., "X", "は", "Y", "です"
  explanation: string
  examples: string[]
}

export interface Example {
  japanese: string
  romaji: string
  english: string
  breakdown: Record<string, string> // Word-by-word translation
  notes?: string // Optional additional context
}

export interface CommonMistake {
  mistake: string
  correction: string
  example: string
}
```

### Content Guidelines

**Explanation**:
- Write for absolute beginners (no assumed Japanese knowledge)
- Use simple English (avoid linguistic jargon)
- Length: 150-300 words
- Include key points as bullet list
- Explain WHY, not just WHAT

**Examples**:
- Minimum 3, maximum 5 examples
- Progress from simple to complex
- Use only N5 vocabulary
- Provide complete word-by-word breakdown
- Include romaji for pronunciation help

**Related Points**:
- Link to 1-3 related grammar points
- Must reference other points by their exact ID

---

## 🎯 Schema 3: Exercises

**File**: `/public/data/grammar/exercises/{id}.json`

### Purpose
Interactive exercises for practicing the grammar point.

### JSON Structure

```json
{
  "grammarPointId": "001-x-wa-y-desu",
  "version": "1.0.0",
  "totalExercises": 10,
  "exercises": [
    {
      "id": "001-x-wa-y-desu-ex-1",
      "type": "multiple-choice",
      "question": "Choose the correct particle to complete the sentence: 私＿＿学生です。",
      "questionRomaji": "Watashi __ gakusei desu.",
      "options": [
        { "id": "a", "text": "は", "romaji": "wa" },
        { "id": "b", "text": "が", "romaji": "ga" },
        { "id": "c", "text": "を", "romaji": "wo" },
        { "id": "d", "text": "に", "romaji": "ni" }
      ],
      "correctAnswer": "a",
      "correctFeedback": "Correct! は (wa) is the topic marker used to introduce the topic of the sentence.",
      "incorrectFeedback": "Not quite. は (wa) is the correct particle because it marks '私' as the topic of the sentence.",
      "explanation": "In the pattern XはYです, は always marks the topic X. Here, '私' (I) is the topic.",
      "difficulty": "easy"
    },
    {
      "id": "001-x-wa-y-desu-ex-2",
      "type": "fill-in-blank",
      "question": "Translate 'This is a pen.' into Japanese: ＿＿＿＿＿",
      "questionRomaji": "Kore wa pen desu.",
      "correctAnswer": "これはペンです",
      "acceptedVariations": [
        "これはペンです。",
        "これはぺんです",
        "これはぺんです。",
        "kore wa pen desu",
        "kore wa pen desu."
      ],
      "correctFeedback": "Perfect! これはペンです uses the XはYです pattern correctly.",
      "incorrectFeedback": "The correct answer is: これはペンです (kore wa pen desu)",
      "explanation": "これ = this, は = topic marker, ペン = pen, です = is (polite)",
      "hints": ["Remember the pattern: X は Y です", "これ means 'this'"],
      "difficulty": "medium"
    },
    {
      "id": "001-x-wa-y-desu-ex-3",
      "type": "sentence-matching",
      "question": "Match the Japanese sentences with their English translations",
      "pairs": [
        {
          "japanese": "これは本です。",
          "romaji": "Kore wa hon desu.",
          "english": "This is a book."
        },
        {
          "japanese": "私は先生です。",
          "romaji": "Watashi wa sensei desu.",
          "english": "I am a teacher."
        },
        {
          "japanese": "田中さんは学生です。",
          "romaji": "Tanaka-san wa gakusei desu.",
          "english": "Tanaka-san is a student."
        }
      ],
      "correctFeedback": "Excellent! You correctly matched all sentences.",
      "incorrectFeedback": "Not quite. Review the XはYです pattern and try again.",
      "explanation": "All sentences follow the basic pattern: Topic は Description です",
      "difficulty": "easy"
    }
    // ... 7 more exercises (total 10 per grammar point)
  ]
}
```

### TypeScript Interface

```typescript
export interface ExerciseFile {
  grammarPointId: string
  version: string
  totalExercises: number
  exercises: Exercise[]
}

export type ExerciseType = 'multiple-choice' | 'fill-in-blank' | 'sentence-matching'

export interface BaseExercise {
  id: string
  type: ExerciseType
  question: string
  questionRomaji?: string
  correctFeedback: string
  incorrectFeedback: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface MultipleChoiceExercise extends BaseExercise {
  type: 'multiple-choice'
  options: MultipleChoiceOption[]
  correctAnswer: string // Option ID (e.g., "a", "b", "c", "d")
}

export interface MultipleChoiceOption {
  id: string // "a", "b", "c", "d"
  text: string // Japanese text
  romaji?: string // Optional romanization
}

export interface FillInBlankExercise extends BaseExercise {
  type: 'fill-in-blank'
  correctAnswer: string
  acceptedVariations?: string[] // Alternative correct answers
  hints?: string[]
}

export interface SentenceMatchingExercise extends BaseExercise {
  type: 'sentence-matching'
  pairs: SentencePair[]
}

export interface SentencePair {
  japanese: string
  romaji: string
  english: string
}

export type Exercise = MultipleChoiceExercise | FillInBlankExercise | SentenceMatchingExercise

export interface ExerciseResult {
  isCorrect: boolean
  message: string
  correctAnswer?: string
  explanation?: string
}
```

### Exercise Guidelines

**Distribution per Grammar Point**:
- **Total**: 10 exercises
- **Multiple Choice**: 4-5 exercises
- **Fill-in-Blank**: 3-4 exercises
- **Sentence Matching**: 1-2 exercises

**Difficulty Progression**:
- Exercises 1-3: Easy (direct application)
- Exercises 4-7: Medium (requires thinking)
- Exercises 8-10: Hard (creative application)

**Multiple Choice**:
- Always 4 options (A, B, C, D)
- One correct answer
- Distractors should be plausible (common mistakes)
- Explain WHY correct answer is right

**Fill-in-Blank**:
- Must accept multiple valid formats (kanji, hiragana, romaji)
- List all accepted variations
- Provide 1-2 hints if difficult
- Normalize input (trim, lowercase for romaji)

**Sentence Matching**:
- 3-4 pairs per exercise
- All sentences use same grammar pattern
- Vary vocabulary to prevent pattern matching

---

## 📂 Grammar Categories

### Category List (12 categories, ~80 points)

```typescript
export type GrammarCategory =
  | 'basic-sentences'       // ~5 points
  | 'particles'             // ~15 points
  | 'verbs'                 // ~20 points
  | 'adjectives'            // ~10 points
  | 'time-expressions'      // ~8 points
  | 'existence'             // ~5 points
  | 'comparisons'           // ~4 points
  | 'questions'             // ~6 points
  | 'numbers-counters'      // ~5 points
  | 'necessity-ability'     // ~4 points
  | 'giving-receiving'      // ~3 points
  | 'miscellaneous'         // ~5 points
```

### Category Metadata

```json
{
  "categories": [
    {
      "id": "basic-sentences",
      "name": {
        "en": "Basic Sentences",
        "ja": "基本文型"
      },
      "description": "Foundational sentence structures",
      "order": 1,
      "color": "#3b82f6"
    },
    {
      "id": "particles",
      "name": {
        "en": "Particles",
        "ja": "助詞"
      },
      "description": "Particles that mark grammatical function",
      "order": 2,
      "color": "#10b981"
    }
    // ... 10 more categories
  ]
}
```

**Note**: Category metadata is optional for MVP. Just use category IDs as strings.

---

## 🔢 Complete N5 Grammar Point List (80 points)

### Basic Sentences (5)
1. `001-x-wa-y-desu` - XはYです (X is Y)
2. `002-x-wa-y-de-wa-arimasen` - XはYではありません (X is not Y)
3. `003-kore-sore-are` - これ/それ/あれ (this/that/that over there)
4. `004-basic-word-order` - Basic SOV word order
5. `005-sentence-ending-particles` - ね、よ、か

### Particles (15)
6. `006-particle-wa` - は (topic marker)
7. `007-particle-ga` - が (subject marker)
8. `008-particle-wo` - を (object marker)
9. `009-particle-ni-location` - に (location/time)
10. `010-particle-ni-indirect-object` - に (indirect object)
11. `011-particle-de-location` - で (location of action)
12. `012-particle-de-means` - で (means/method)
13. `013-particle-e` - へ (direction)
14. `014-particle-to-and` - と (and - for nouns)
15. `015-particle-to-with` - と (with - doing together)
16. `016-particle-no-possessive` - の (possessive)
17. `017-particle-no-explanation` - の (nominalizer)
18. `018-particle-ka-question` - か (question marker)
19. `019-particle-mo` - も (also, too)
20. `020-particle-ya` - や (and - non-exhaustive list)

### Verbs (20)
21. `021-verb-groups` - Verb groups (う、る、irregular)
22. `022-masu-form-present` - ます form (present/future)
23. `023-masu-form-negative` - ません form (negative)
24. `024-masu-form-past` - ました form (past)
25. `025-masu-form-past-negative` - ませんでした (past negative)
26. `026-te-form-basics` - て form basics
27. `027-te-iru-progressive` - ～ている (continuous/progressive)
28. `028-te-kudasai` - ～てください (please do)
29. `029-tai-want-to` - ～たい (want to)
30. `030-mashou-lets` - ～ましょう (let's)
31. `031-masen-ka-invitation` - ～ませんか (won't you...?)
32. `032-te-mo-ii` - ～てもいい (may, it's okay to)
33. `033-te-wa-ikenai` - ～てはいけない (must not)
34. `034-nakute-wa-ikenai` - ～なくてはいけない (must)
35. `035-koto-ga-dekiru` - ～ことができる (can, able to)
36. `036-plain-form-present` - Plain form (present)
37. `037-plain-form-past` - Plain form (past)
38. `038-plain-form-negative` - Plain form (negative)
39. `039-nai-form` - ない form (negative plain)
40. `040-dictionary-form` - Dictionary form

### Adjectives (10)
41. `041-i-adjectives-present` - い-adjectives (present)
42. `042-i-adjectives-past` - い-adjectives (past)
43. `043-i-adjectives-negative` - い-adjectives (negative)
44. `044-i-adjectives-past-negative` - い-adjectives (past negative)
45. `045-na-adjectives-present` - な-adjectives (present)
46. `046-na-adjectives-past` - な-adjectives (past)
47. `047-na-adjectives-negative` - な-adjectives (negative)
48. `048-na-adjectives-past-negative` - な-adjectives (past negative)
49. `049-adjective-modification` - Adjective + noun modification
50. `050-i-adjective-adverb` - い-adjective → adverb (く form)

### Time Expressions (8)
51. `051-time-particle-ni` - Time に (at specific time)
52. `052-duration-particle-kan` - Duration 間
53. `053-made-until` - まで (until)
54. `054-kara-from` - から (from - time)
55. `055-mae-ni-before` - 前に (before)
56. `056-ato-de-after` - 後で (after)
57. `057-frequency-adverbs` - いつも、時々、etc. (frequency)
58. `058-toki-when` - 時 (when, at the time)

### Existence (5)
59. `059-iru-animate` - いる (existence - animate)
60. `060-aru-inanimate` - ある (existence - inanimate)
61. `061-imasu-arimasu` - います/あります (polite existence)
62. `062-location-ni-iru-aru` - Location に いる/ある
63. `063-possession-ga-aru` - Possession が ある

### Comparisons (4)
64. `064-yori-than` - より (than)
65. `065-hou-ga-more-than` - ～方が～ (more than)
66. `066-ichiban-most` - 一番 (most, best)
67. `067-onaji-same` - 同じ (same as)

### Questions (6)
68. `068-question-nani-what` - 何 (what)
69. `069-question-dare-who` - 誰 (who)
70. `070-question-doko-where` - どこ (where)
71. `071-question-itsu-when` - いつ (when)
72. `072-question-naze-doushite-why` - なぜ/どうして (why)
73. `073-question-dou-how` - どう (how)

### Numbers & Counters (5)
74. `074-counter-tsu` - ～つ (general counter)
75. `075-counter-nin` - ～人 (people counter)
76. `076-counter-hon` - ～本 (long objects counter)
77. `077-counter-mai` - ～枚 (flat objects counter)
78. `078-age-sai` - ～歳 (age)

### Miscellaneous (2)
79. `079-kara-because` - ～から (because)
80. `080-node-so` - ～ので (so, therefore)

---

## ✅ Data Validation Checklist

Before committing any JSON file, verify:

### Index File (`n5-index.json`)
- [ ] All 80 points present
- [ ] IDs are unique
- [ ] Orders are sequential (1-80)
- [ ] All required fields present
- [ ] No duplicate IDs or orders

### Grammar Point Files (`points/*.json`)
- [ ] ID matches filename
- [ ] All required fields present
- [ ] 3-5 examples provided
- [ ] Explanation is 150-300 words
- [ ] Related points reference valid IDs
- [ ] No empty strings in required fields

### Exercise Files (`exercises/*.json`)
- [ ] Grammar point ID matches
- [ ] Exactly 10 exercises
- [ ] All exercise types represented
- [ ] Correct answers are valid
- [ ] Accepted variations for fill-in-blank
- [ ] Feedback messages are helpful

### JSON Syntax
- [ ] Valid JSON (no trailing commas)
- [ ] Proper escaping of quotes
- [ ] UTF-8 encoding for Japanese characters
- [ ] No BOM (byte order mark)

---

## 🛠️ Example Creation Workflow (Agent 1)

### Step 1: Create Index Entry

```json
// Add to n5-index.json
{
  "id": "001-x-wa-y-desu",
  "order": 1,
  "category": "basic-sentences",
  "title": {
    "ja": "XはYです",
    "romaji": "X wa Y desu",
    "en": "X is Y"
  },
  "shortDescription": "Basic identity and description sentences",
  "jlptLevel": "N5",
  "difficulty": "beginner"
}
```

### Step 2: Create Grammar Point File

```bash
touch /public/data/grammar/points/001-x-wa-y-desu.json
```

Fill with complete grammar point data (see Schema 2).

### Step 3: Create Exercise File

```bash
touch /public/data/grammar/exercises/001-x-wa-y-desu.json
```

Create 10 exercises (4-5 MC, 3-4 fill-in, 1-2 matching).

### Step 4: Validate

```bash
# Use a JSON validator
cat 001-x-wa-y-desu.json | jq '.'

# If valid, no errors
# If invalid, shows syntax error
```

### Step 5: Commit

```bash
git add .
git commit -m "feat: add grammar point 001-x-wa-y-desu"
```

---

## 📞 Support

**Questions about data schema?**
- Technical Lead: See `AGENT_PROMPTS/TECHNICAL_LEAD.md`
- Agent 1: See `AGENT_PROMPTS/AGENT_1_DATA.md`

**Document Version**: 1.0.0
**Status**: Ready for Implementation
