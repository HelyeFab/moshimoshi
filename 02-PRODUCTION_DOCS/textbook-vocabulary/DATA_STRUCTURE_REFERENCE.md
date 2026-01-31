# Textbook Vocabulary Data Structure Reference

**Last Updated:** 2026-01-31
**Purpose:** Technical reference for creating adapters and working with textbook vocabulary data

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Index File Schema](#index-file-schema)
4. [Vocabulary Item Schema](#vocabulary-item-schema)
5. [Field Specifications](#field-specifications)
6. [Data Variants by Source](#data-variants-by-source)
7. [Furigana Format](#furigana-format)
8. [Creating an Adapter](#creating-an-adapter)
9. [Validation Rules](#validation-rules)
10. [Common Patterns](#common-patterns)

---

## Overview

The textbook vocabulary data consists of **17,759 vocabulary items** organized across **10 textbook sources** and **2 vocabulary sources**. Each item follows a standardized JSON schema while supporting source-specific extensions.

### Key Characteristics

- **Format:** JSON (UTF-8 encoded, `ensure_ascii=false`)
- **Structure:** Flat array of vocabulary objects
- **ID Pattern:** `{source}-{lesson/chapter}-{timestamp/sequence}`
- **Total Size:** ~330MB across all files
- **Languages:** Japanese (kanji, hiragana, katakana) + English

---

## Directory Structure

```
src/data/textbooks/
├── index.json                          # Master index with metadata
├── genki-1/
│   └── all.json                        # 1,495 vocabulary items
├── genki-2/
│   └── all.json                        # 491 items
├── genki-2-complete/
│   └── all.json                        # (consolidated genki-2)
├── genki-2-new/
│   └── all.json                        # 589 items (3rd edition)
├── minna-1/
│   └── all.json                        # 2,028 items
├── minna-2/
│   └── all.json                        # 1,058 items
├── dekiru-nihongo-1/
│   └── all.json                        # 645 items
├── dekiru-nihongo-2/
│   └── all.json                        # 390 items
├── dekiru-nihongo-beginner/
│   └── all.json                        # 284 items
├── kaishi-15k/
│   └── all.json                        # 1,500 items (frequency-based)
└── kanji-in-context/
    └── all.json                        # 9,279 items
```

### File Naming Convention

- **all.json**: Contains all vocabulary for that source
- **Future expansion**: Could support `lesson-{n}.json` for per-lesson files

---

## Index File Schema

**File:** `src/data/textbooks/index.json`

```typescript
interface TextbookIndex {
  totalCards: number;                   // Sum of all vocabulary items
  textbooks: {                          // Textbook-based sources
    [textbookId: string]: {
      title: string;                    // Display name
      cardCount: number;                // Number of vocabulary items
    };
  };
  vocabularySources: {                  // Frequency/reference sources
    [sourceId: string]: {
      title: string;
      cardCount: number;
    };
  };
}
```

**Example:**

```json
{
  "totalCards": 17759,
  "textbooks": {
    "genki-1": {
      "title": "Genki 1",
      "cardCount": 1495
    }
  },
  "vocabularySources": {
    "kaishi-15k": {
      "title": "Kaishi 15K",
      "cardCount": 1500
    }
  }
}
```

---

## Vocabulary Item Schema

### Core Schema (TypeScript)

```typescript
interface VocabularyItem {
  // Required Fields
  id: string;                           // Unique identifier
  japanese: string;                     // Primary Japanese text (kanji/kana)
  reading: string;                      // Reading (hiragana/katakana)
  meaning: string;                      // English definition
  jlptLevel: JLPTLevel;                 // N5, N4, N3, N2, N1, or ""
  partOfSpeech: string[];               // ["verb", "noun", etc.]
  examples: Example[];                  // Usage examples
  tags: string[];                       // Categorization tags

  // Textbook-Specific Fields
  lesson?: number;                      // Lesson number (textbooks)
  textbook?: string;                    // Source textbook ID

  // Frequency-Based Fields
  frequency?: number;                   // Frequency rank (kaishi-15k)
  source?: string;                      // Source identifier
  chapter?: number;                     // Chapter number (kanji-in-context)
}

interface Example {
  japanese: string;                     // Example sentence in Japanese
  reading: string;                      // Reading (often empty)
  english: string;                      // English translation
}

type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1" | "";
```

### JSON Example (Minimal)

```json
{
  "id": "genki-1-1-1544776574229",
  "japanese": "わたし",
  "reading": "わたし",
  "meaning": "I",
  "jlptLevel": "N5",
  "partOfSpeech": [],
  "examples": [
    {
      "japanese": "わたし",
      "reading": "",
      "english": "1"
    }
  ],
  "tags": ["n5", "lesson-1", "genki-1"],
  "lesson": 1,
  "textbook": "genki-1"
}
```

### JSON Example (Complete)

```json
{
  "id": "kaishi-1",
  "japanese": "私",
  "reading": "わたし",
  "meaning": "I (polite, general)",
  "jlptLevel": "N5",
  "partOfSpeech": ["pronoun"],
  "examples": [
    {
      "japanese": "私はアンです。",
      "reading": "",
      "english": "I am Ann."
    }
  ],
  "tags": ["n5", "kaishi-15k", "freq-19"],
  "frequency": 19,
  "source": "kaishi-15k"
}
```

---

## Field Specifications

### 1. `id` (string, required)

**Purpose:** Unique identifier for the vocabulary item

**Format Patterns:**
- Textbooks: `{textbook}-{lesson}-{timestamp}`
  - Example: `"genki-1-5-1544776574229"`
- Frequency sources: `{source}-{sequence}`
  - Example: `"kaishi-15"`
- Kanji sources: `{source}-{chapter}-{sequence}`
  - Example: `"kic-1-0"`

**Requirements:**
- Must be globally unique across all sources
- Should be stable (don't regenerate on re-import)
- Use for deduplication and cross-referencing

**Bad Examples:**
```json
"id": "genki-1-1-1609729373877"  // ❌ Anki error (removed)
```

---

### 2. `japanese` (string, required)

**Purpose:** Primary Japanese text in kanji and/or kana

**Format:**
- Pure kanji: `"私"`
- Pure kana: `"わたし"`
- Mixed: `"食べる"`
- With furigana brackets: `"温[おん]泉[せん]"` (see [Furigana Format](#furigana-format))
- With particles: `"～さん"`, `"［お］花見"`
- English loanwords: `"CD"`, `"DVD"`, `"ATM"`

**Requirements:**
- Must contain Japanese characters (except for loanwords)
- No HTML tags or entities
- No English definitions (should be in `meaning` field)

**Good Examples:**
```json
"japanese": "私"           // Kanji
"japanese": "わたし"       // Hiragana
"japanese": "温[おん]泉[せん]"  // With furigana
"japanese": "CD"           // English loanword (acceptable)
```

**Bad Examples:**
```json
"japanese": "oneいち"      // ❌ English mixed with Japanese
"japanese": "私&nbsp;"     // ❌ HTML entity
"japanese": "<div>私</div>" // ❌ HTML tag
"japanese": "I"            // ❌ English only (should be in meaning)
```

---

### 3. `reading` (string, required)

**Purpose:** Pronunciation guide in hiragana/katakana

**Format:**
- Pure hiragana: `"わたし"`
- With furigana brackets: `"温[おん]泉[せん]"` or `"おんせん"`
- Multiple readings: `"いち、いっ、ひと"` (comma-separated)
- On'yomi + kun'yomi: `"じん、にん、ひと"`
- Katakana for loanwords: `"シーディー"` or `"CD"`

**Requirements:**
- Should match the pronunciation of `japanese` field
- No English words (except abbreviations like "CD")
- No HTML tags or entities

**Good Examples:**
```json
"japanese": "私",
"reading": "わたし"

"japanese": "一",
"reading": "いち、いっ、ひと"

"japanese": "CD",
"reading": "CD"  // or "シーディー"
```

**Bad Examples:**
```json
"reading": "oneいち"       // ❌ English mixed with Japanese
"reading": "わたし&nbsp;"  // ❌ HTML entity
```

---

### 4. `meaning` (string, required)

**Purpose:** English definition/translation

**Format:**
- Simple: `"I"`
- Detailed: `"I (polite, general)"`
- Multiple meanings: `"one, first, best"`
- With usage notes: `"to eat (informal)"`
- With particles: `"to commute (to a place に)"`
- With Japanese notes: `"who (どなた is the polite equivalent)"`

**Requirements:**
- Must be in English
- Can include Japanese text in parentheses for clarification
- No HTML tags or entities
- No furigana brackets (unless in explanatory notes)

**Good Examples:**
```json
"meaning": "I"
"meaning": "to eat"
"meaning": "one"
"meaning": "CD, compact disc"
"meaning": "who (どなた is the polite equivalent)"
```

**Bad Examples:**
```json
"meaning": "oneいち"       // ❌ Japanese mixed (not in parentheses)
"meaning": "私"            // ❌ Japanese only
"meaning": "to eat&nbsp;"  // ❌ HTML entity
"meaning": "<br>to eat"    // ❌ HTML tag
```

---

### 5. `jlptLevel` (string, required)

**Purpose:** Japanese Language Proficiency Test level classification

**Valid Values:**
- `"N5"` - Beginner (easiest)
- `"N4"` - Elementary
- `"N3"` - Intermediate
- `"N2"` - Upper intermediate
- `"N1"` - Advanced (hardest)
- `""` - Unclassified/unknown

**Usage:**
- Used for filtering by difficulty
- Used for progress tracking
- Most textbook vocab is N5-N4

**Example:**
```json
"jlptLevel": "N5"
```

---

### 6. `partOfSpeech` (array, required)

**Purpose:** Grammatical classification

**Common Values:**
- `"noun"` - 名詞
- `"verb"` - 動詞
- `"adjective"` - 形容詞
- `"adverb"` - 副詞
- `"particle"` - 助詞
- `"pronoun"` - 代名詞
- `"conjunction"` - 接続詞
- `"expression"` - 表現

**Format:**
- Array of strings
- Can be empty: `[]`
- Can have multiple values: `["noun", "verb"]`

**Example:**
```json
"partOfSpeech": ["noun"]
"partOfSpeech": ["verb", "ichidan"]
"partOfSpeech": []  // Unclassified
```

**Note:** This field is often empty in imported Anki data and may need manual enrichment.

---

### 7. `examples` (array, required)

**Purpose:** Usage examples showing the word in context

**Structure:**
```typescript
interface Example {
  japanese: string;   // Example sentence in Japanese
  reading: string;    // Reading (often empty)
  english: string;    // English translation
}
```

**Format:**
- Array of example objects
- Can be empty: `[]`
- Usually 0-3 examples per item

**Good Examples:**
```json
"examples": [
  {
    "japanese": "私はアンです。",
    "reading": "",
    "english": "I am Ann."
  }
]

"examples": []  // No examples
```

**Bad Examples:**
```json
"examples": [
  {
    "japanese": "私は<b>アン</b>です。",  // ❌ HTML tag
    "english": "I am Ann.&nbsp;"       // ❌ HTML entity
  }
]
```

---

### 8. `tags` (array, required)

**Purpose:** Categorization and filtering

**Common Tag Patterns:**
- JLPT level: `"n5"`, `"n4"`, `"n3"`, `"n2"`, `"n1"`
- Lesson/Chapter: `"lesson-1"`, `"chapter-5"`
- Source: `"genki-1"`, `"minna-1"`, `"kaishi-15k"`
- Frequency: `"freq-19"`, `"freq-100"`
- Topic: `"numbers"`, `"family"`, `"verbs"` (optional)

**Format:**
- Array of lowercase strings
- Use kebab-case for multi-word tags
- Always include source and level tags

**Example:**
```json
"tags": ["n5", "lesson-1", "genki-1"]
"tags": ["n5", "kaishi-15k", "freq-19"]
"tags": ["n4", "lesson-12", "minna-2", "verbs"]
```

---

### 9. `lesson` (number, optional)

**Purpose:** Lesson number within a textbook

**Used By:** Textbook sources (genki, minna, dekiru-nihongo)

**Format:**
- Integer starting from 1
- Corresponds to textbook lesson structure

**Example:**
```json
"lesson": 1
"lesson": 12
```

**Validation:**
- Must be positive integer if present
- Should match textbook structure

---

### 10. `textbook` (string, optional)

**Purpose:** Source textbook identifier

**Used By:** Textbook sources

**Format:**
- Must match directory name
- Must match key in `index.json`

**Valid Values:**
- `"genki-1"`, `"genki-2"`, `"genki-2-new"`, `"genki-2-complete"`
- `"minna-1"`, `"minna-2"`
- `"dekiru-nihongo-1"`, `"dekiru-nihongo-2"`, `"dekiru-nihongo-beginner"`

**Example:**
```json
"textbook": "genki-1"
```

---

### 11. `frequency` (number, optional)

**Purpose:** Frequency rank (lower = more common)

**Used By:** `kaishi-15k`

**Format:**
- Integer (typically 1-15000)
- Lower numbers = higher frequency

**Example:**
```json
"frequency": 19  // Very common word
"frequency": 5000  // Less common
```

---

### 12. `chapter` (number, optional)

**Purpose:** Chapter number within a reference source

**Used By:** `kanji-in-context`

**Format:**
- Integer starting from 1

**Example:**
```json
"chapter": 1
```

---

### 13. `source` (string, optional)

**Purpose:** Source identifier for non-textbook sources

**Used By:** Frequency/reference sources

**Valid Values:**
- `"kaishi-15k"`
- `"kanji-in-context"`

**Example:**
```json
"source": "kaishi-15k"
```

---

## Data Variants by Source

### Textbook Sources (genki, minna, dekiru-nihongo)

**Characteristics:**
- Organized by lessons
- JLPT levels mostly N5-N4
- Focus on beginner-intermediate vocabulary
- Examples often minimal

**Required Fields:**
```json
{
  "id": "genki-1-1-1544776574229",
  "lesson": 1,
  "textbook": "genki-1",
  "tags": ["n5", "lesson-1", "genki-1"]
}
```

### Frequency Sources (kaishi-15k)

**Characteristics:**
- Organized by frequency rank
- Covers all JLPT levels
- Includes frequency metadata
- More detailed examples

**Required Fields:**
```json
{
  "id": "kaishi-15",
  "frequency": 19,
  "source": "kaishi-15k",
  "tags": ["n5", "kaishi-15k", "freq-19"]
}
```

### Reference Sources (kanji-in-context)

**Characteristics:**
- Organized by chapters
- Focus on kanji and compounds
- Extensive furigana usage
- Reading field often has furigana brackets

**Required Fields:**
```json
{
  "id": "kic-1-0",
  "chapter": 1,
  "source": "kanji-in-context",
  "tags": ["n5", "kanji-in-context", "chapter-1"]
}
```

---

## Furigana Format

### Bracket Notation

Furigana (reading aids) are encoded using square brackets:

**Format:** `kanji[reading]`

**Examples:**

```json
"japanese": "温[おん]泉[せん]"
"reading": "温[おん]泉[せん]"  // or "おんせん"
```

### Parsing Algorithm

```typescript
function parseFurigana(text: string): Array<{kanji: string, reading: string}> {
  const parts = [];
  const regex = /([^[]+)\[([^\]]+)\]/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    parts.push({
      kanji: match[1],    // "温"
      reading: match[2]   // "おん"
    });
  }

  return parts;
}

// Example usage:
parseFurigana("温[おん]泉[せん]")
// Returns: [{kanji: "温", reading: "おん"}, {kanji: "泉", reading: "せん"}]
```

### Display Rendering

**HTML Rendering:**
```typescript
function renderFurigana(text: string): string {
  return text.replace(/([^[]+)\[([^\]]+)\]/g,
    '<ruby>$1<rt>$2</rt></ruby>'
  );
}

// "温[おん]泉[せん]" →
// <ruby>温<rt>おん</rt></ruby><ruby>泉<rt>せん</rt></ruby>
```

**Plain Text Extraction:**
```typescript
function extractKanji(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, '');
}
// "温[おん]泉[せん]" → "温泉"

function extractReading(text: string): string {
  return text.replace(/[^\[]+\[([^\]]+)\]/g, '$1');
}
// "温[おん]泉[せん]" → "おんせん"
```

### Common Patterns

```json
// Single kanji with reading
"japanese": "私[わたし]"

// Multiple kanji, each with reading
"japanese": "温[おん]泉[せん]"

// Mixed kanji and kana (okurigana)
"japanese": "食[た]べる"

// Multiple readings separated
"japanese": "一[いち] 日[にち]"

// Entire phrase
"japanese": "一日[ついたち]"  // Special reading
```

---

## Creating an Adapter

### Purpose

An adapter transforms vocabulary data into a format suitable for the Universal Review Engine (URE) or other systems.

### URE Adapter Example

```typescript
import { BaseContentAdapter } from '@/lib/review-engine/adapters/BaseContentAdapter';
import { ReviewableContent } from '@/lib/review-engine/core/interfaces';
import { VocabularyItem } from './types';

export class TextbookVocabularyAdapter extends BaseContentAdapter<VocabularyItem> {
  /**
   * Transform vocabulary item to ReviewableContent
   */
  transform(item: VocabularyItem): ReviewableContent {
    return {
      // Unique identifier
      id: item.id,

      // Content type for routing
      contentType: 'vocabulary',

      // What to show (question)
      primaryDisplay: item.meaning,        // "hot spring"
      secondaryDisplay: item.reading,      // "おんせん"

      // What to answer (answer)
      primaryAnswer: item.japanese,        // "温泉"
      alternativeAnswers: [
        item.reading,                      // "おんせん" also acceptable
        this.stripFurigana(item.japanese)  // "温泉" without brackets
      ],

      // Review modes supported
      supportedModes: ['recognition', 'listening'],

      // Additional metadata
      metadata: {
        japanese: item.japanese,
        reading: item.reading,
        meaning: item.meaning,
        jlptLevel: item.jlptLevel,
        partOfSpeech: item.partOfSpeech,
        examples: item.examples,
        lesson: item.lesson,
        textbook: item.textbook,
        tags: item.tags
      }
    };
  }

  /**
   * Remove furigana brackets for clean text
   */
  private stripFurigana(text: string): string {
    return text.replace(/\[([^\]]+)\]/g, '');
  }

  /**
   * Validate item structure
   */
  validate(item: VocabularyItem): boolean {
    return !!(
      item.id &&
      item.japanese &&
      item.reading &&
      item.meaning &&
      item.jlptLevel !== undefined &&
      Array.isArray(item.partOfSpeech) &&
      Array.isArray(item.examples) &&
      Array.isArray(item.tags)
    );
  }
}
```

### Data Loader Example

```typescript
import { VocabularyItem } from './types';

export class TextbookVocabularyLoader {
  /**
   * Load all vocabulary from a textbook
   */
  async loadTextbook(textbookId: string): Promise<VocabularyItem[]> {
    const response = await fetch(`/data/textbooks/${textbookId}/all.json`);
    const data = await response.json();

    // Validate each item
    return data.filter(item => this.validate(item));
  }

  /**
   * Load vocabulary for specific lesson
   */
  async loadLesson(textbookId: string, lessonNumber: number): Promise<VocabularyItem[]> {
    const all = await this.loadTextbook(textbookId);
    return all.filter(item => item.lesson === lessonNumber);
  }

  /**
   * Load vocabulary by JLPT level
   */
  async loadByJLPT(jlptLevel: string): Promise<VocabularyItem[]> {
    // Load from multiple sources
    const sources = ['genki-1', 'minna-1', 'kaishi-15k'];
    const items = await Promise.all(
      sources.map(source => this.loadTextbook(source))
    );

    return items
      .flat()
      .filter(item => item.jlptLevel === jlptLevel);
  }

  /**
   * Validate vocabulary item
   */
  private validate(item: any): item is VocabularyItem {
    return !!(
      item.id &&
      item.japanese &&
      item.reading &&
      item.meaning &&
      typeof item.jlptLevel === 'string' &&
      Array.isArray(item.partOfSpeech) &&
      Array.isArray(item.examples) &&
      Array.isArray(item.tags)
    );
  }
}
```

### Export Adapter Example

```typescript
/**
 * Export vocabulary to Anki format
 */
export class AnkiExportAdapter {
  /**
   * Convert to Anki CSV format
   */
  toAnkiCSV(items: VocabularyItem[]): string {
    const lines = items.map(item => {
      const front = item.japanese;
      const back = `${item.reading}\n${item.meaning}`;
      const tags = item.tags.join(' ');

      // CSV format: Front, Back, Tags
      return `"${front}","${back}","${tags}"`;
    });

    return lines.join('\n');
  }

  /**
   * Convert to Anki JSON format (for .apkg import)
   */
  toAnkiJSON(items: VocabularyItem[]): any {
    return items.map(item => ({
      deckName: item.textbook || 'Default',
      modelName: 'Basic',
      fields: {
        Front: item.japanese,
        Back: `${item.reading}<br>${item.meaning}`,
      },
      tags: item.tags
    }));
  }
}
```

---

## Validation Rules

### Required Field Validation

```typescript
function validateRequired(item: VocabularyItem): string[] {
  const errors: string[] = [];

  if (!item.id) errors.push('Missing id');
  if (!item.japanese) errors.push('Missing japanese');
  if (!item.reading) errors.push('Missing reading');
  if (!item.meaning) errors.push('Missing meaning');
  if (item.jlptLevel === undefined) errors.push('Missing jlptLevel');
  if (!Array.isArray(item.partOfSpeech)) errors.push('Invalid partOfSpeech');
  if (!Array.isArray(item.examples)) errors.push('Invalid examples');
  if (!Array.isArray(item.tags)) errors.push('Invalid tags');

  return errors;
}
```

### Content Quality Validation

```typescript
function validateQuality(item: VocabularyItem): string[] {
  const errors: string[] = [];

  // No HTML tags
  if (/<[^>]+>/.test(item.japanese)) {
    errors.push('japanese contains HTML tags');
  }
  if (/<[^>]+>/.test(item.meaning)) {
    errors.push('meaning contains HTML tags');
  }

  // No HTML entities
  if (/&\w+;/.test(item.japanese)) {
    errors.push('japanese contains HTML entities');
  }
  if (/&\w+;/.test(item.meaning)) {
    errors.push('meaning contains HTML entities');
  }

  // Japanese field should contain Japanese (unless loanword)
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(item.japanese);
  const isLoanword = /^[A-Z]{2,5}$/.test(item.japanese.trim());

  if (!hasJapanese && !isLoanword) {
    errors.push('japanese field should contain Japanese characters');
  }

  // No error messages
  if (/please update|import.*apkg/i.test(item.japanese)) {
    errors.push('japanese contains error message');
  }

  return errors;
}
```

### Field Swap Detection

```typescript
function detectFieldSwap(item: VocabularyItem): boolean {
  const hasJapanese = (text: string) =>
    /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);

  const isPrimarilyEnglish = (text: string) => {
    const clean = text.replace(/[^a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
    if (clean.length === 0) return false;
    const english = (text.match(/[a-zA-Z]/g) || []).length;
    return english / clean.length > 0.5;
  };

  // Red flags:
  // 1. Japanese field has English, meaning field has Japanese
  if (isPrimarilyEnglish(item.japanese) && hasJapanese(item.meaning)) {
    return true;
  }

  // 2. Reading field starts with English word
  if (/^[a-z]+[\u3040-\u309F\u30A0-\u30FF]/i.test(item.reading)) {
    return true;
  }

  return false;
}
```

---

## Common Patterns

### Pattern 1: Simple Vocabulary

```json
{
  "id": "genki-1-1-1544776574229",
  "japanese": "わたし",
  "reading": "わたし",
  "meaning": "I",
  "jlptLevel": "N5",
  "partOfSpeech": ["pronoun"],
  "examples": [],
  "tags": ["n5", "lesson-1", "genki-1"],
  "lesson": 1,
  "textbook": "genki-1"
}
```

### Pattern 2: Kanji with Multiple Readings

```json
{
  "id": "genki-1-1-1178",
  "japanese": "一",
  "reading": "いち、いっ、ひと",
  "meaning": "one",
  "jlptLevel": "N5",
  "partOfSpeech": ["numeral"],
  "examples": [],
  "tags": ["n5", "lesson-1", "genki-1", "numbers"],
  "lesson": 1,
  "textbook": "genki-1"
}
```

### Pattern 3: Verb with Examples

```json
{
  "id": "kaishi-42",
  "japanese": "食べる",
  "reading": "たべる",
  "meaning": "to eat",
  "jlptLevel": "N5",
  "partOfSpeech": ["verb", "ichidan"],
  "examples": [
    {
      "japanese": "私は朝ごはんを食べる。",
      "reading": "",
      "english": "I eat breakfast."
    }
  ],
  "tags": ["n5", "kaishi-15k", "freq-42", "verbs"],
  "frequency": 42,
  "source": "kaishi-15k"
}
```

### Pattern 4: Compound with Furigana

```json
{
  "id": "kic-1-42",
  "japanese": "温[おん]泉[せん]",
  "reading": "温[おん]泉[せん]",
  "meaning": "hot spring",
  "jlptLevel": "N3",
  "partOfSpeech": ["noun"],
  "examples": [],
  "tags": ["n3", "kanji-in-context", "chapter-1"],
  "chapter": 1,
  "source": "kanji-in-context"
}
```

### Pattern 5: English Loanword

```json
{
  "id": "genki-1-2-58",
  "japanese": "CD",
  "reading": "CD",
  "meaning": "CD, compact disc",
  "jlptLevel": "N5",
  "partOfSpeech": ["noun"],
  "examples": [],
  "tags": ["n5", "lesson-2", "genki-1"],
  "lesson": 2,
  "textbook": "genki-1"
}
```

### Pattern 6: Expression with Particles

```json
{
  "id": "genki-1-1-1544776574232",
  "japanese": "～さん",
  "reading": "～さん",
  "meaning": "Mr., Ms. (suffix added to a name for expressing politeness)",
  "jlptLevel": "N5",
  "partOfSpeech": ["suffix"],
  "examples": [
    {
      "japanese": "田中さん",
      "reading": "",
      "english": "Mr. Tanaka"
    }
  ],
  "tags": ["n5", "lesson-1", "genki-1"],
  "lesson": 1,
  "textbook": "genki-1"
}
```

---

## Best Practices

### 1. Data Loading

- **Lazy load:** Only load textbooks when needed
- **Cache:** Cache loaded data in memory
- **Validate:** Always validate after loading
- **Error handling:** Gracefully handle missing files

```typescript
class VocabularyCache {
  private cache = new Map<string, VocabularyItem[]>();

  async load(textbookId: string): Promise<VocabularyItem[]> {
    if (this.cache.has(textbookId)) {
      return this.cache.get(textbookId)!;
    }

    const data = await this.fetchAndValidate(textbookId);
    this.cache.set(textbookId, data);
    return data;
  }
}
```

### 2. Furigana Handling

- **Parse once:** Parse furigana when loading, not on every render
- **Cache results:** Cache parsed furigana structures
- **Provide fallbacks:** Support both bracket and plain formats

### 3. Search and Filtering

- **Index tags:** Create indices for efficient tag-based filtering
- **Normalize:** Normalize Japanese text for search (handle full/half-width)
- **Multi-field:** Search across japanese, reading, and meaning fields

```typescript
function normalizeJapanese(text: string): string {
  // Convert full-width to half-width
  return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
  );
}
```

### 4. Performance

- **Pagination:** Don't load all 17,759 items at once
- **Virtual scrolling:** Use virtual lists for large datasets
- **Web Workers:** Parse large files in background threads
- **Compression:** Consider gzip compression for JSON files

---

## Migration Guide

### From Anki Decks

If importing new Anki decks:

1. **Export from Anki:** Export as JSON or CSV
2. **Parse fields:** Map Anki fields to vocabulary schema
3. **Generate IDs:** Create unique IDs using timestamp
4. **Clean HTML:** Strip all HTML tags and entities
5. **Validate:** Run validation before committing
6. **Update index:** Update `index.json` with new card counts

### From Other Sources

1. **Map fields:** Create field mapping document
2. **Transform:** Write transformation script
3. **Validate:** Ensure all required fields present
4. **Test:** Test with small sample first
5. **Deduplicate:** Check for duplicate IDs

---

## Troubleshooting

### Common Issues

**1. HTML Corruption**
```bash
# Find entries with HTML
grep -r "<br>" src/data/textbooks/*/all.json
grep -r "&nbsp;" src/data/textbooks/*/all.json
```

**2. Field Swaps**
```bash
# Use the field swap detection script
python scripts/detect-field-swaps.py
```

**3. Invalid JSON**
```bash
# Validate JSON structure
python -m json.tool src/data/textbooks/genki-1/all.json > /dev/null
```

**4. Character Encoding**
```bash
# Ensure UTF-8 encoding
file -i src/data/textbooks/*/all.json
```

---

## Related Documentation

- [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) - Implementation and URE integration
- [DATA_PIPELINE_GUIDE.md](./DATA_PIPELINE_GUIDE.md) - Anki import process
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions

---

**Last Updated:** 2026-01-31
**Maintainer:** Development Team
**Version:** 1.0.0
