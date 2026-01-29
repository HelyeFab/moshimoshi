# Agent C Deliverables - Blast Mode Distractors & Tiles

**Status:** COMPLETE
**Date:** 2026-01-29
**Agent:** Agent C - Distractor & Tile Logic

---

## Summary

Agent C has successfully implemented all distractor and tile logic for Blast Mode. All utilities are pure functions with comprehensive test coverage (88 tests, 100% passing).

---

## Deliverables

### 1. Phonetics Utility (`phonetics.ts`)

**Purpose:** Generate phonetic neighbor readings for distractor generation

**Exports:**
- `countMora(reading: string): number` - Count mora in Japanese reading
- `getPhoneticNeighbor(kana: string): string | null` - Get phonetically similar kana
- `generatePhoneticNeighbors(reading: string, count: number): string[]` - Generate multiple phonetic neighbors
- `arePhoneticallySimilar(reading1: string, reading2: string, threshold: number): boolean` - Check phonetic similarity
- `normalizeReading(reading: string): string` - Normalize katakana/hiragana for comparison
- `filterByMoraCount(readings: string[], targetMora: number): string[]` - Filter by mora count

**Features:**
- Full hiragana/katakana support
- Phonetic neighbor generation (same vowel, different consonant)
- Mora counting (handles small tsu, small ya/yu/yo, long vowel markers)
- Character swap detection (common mistakes)
- Similarity scoring with configurable thresholds

**Test Coverage:** 30 tests, all passing

---

### 2. Tile Splitter (`tile-splitter.ts`)

**Purpose:** Split Japanese text into tiles for reassembly exercises

**Exports:**
- `splitByMorpheme(text: string, tokens?: string[]): TileSplitResult` - Morpheme boundary split (priority #1)
- `splitByKanaChunk(text: string): TileSplitResult` - 2-3 mora kana chunks (priority #2)
- `splitByKanjiOrder(text: string): TileSplitResult` - Individual kanji characters (priority #3)
- `splitByCharacter(text: string): TileSplitResult` - Character split (fallback)
- `splitIntoTiles(item: BlastItem): TileSplitResult` - Main entry point with automatic strategy selection
- `shuffleTiles(tiles: string[]): string[]` - Shuffle tiles for reassembly
- `validateTileAnswer(userTiles: string[], correctTiles: string[]): boolean` - Validate user answer

**Features:**
- Automatic strategy selection based on text type
- Confidence scoring (high/medium/low)
- Kanji + okurigana handling (keeps together)
- Particle detection and separation
- Verb ending recognition
- Metadata tracking (original text, token count)

**Test Coverage:** 29 tests, all passing

---

### 3. Distractor Generator (`distractors.ts`)

**Purpose:** Generate MCQ distractors for meaning, Japanese text, and reading screens

**Exports:**
- `generateMeaningDistractors(correctMeaning: string, options: DistractorOptions): string[]` - English meaning distractors
- `generateJapaneseDistractors(correctText: string, options: DistractorOptions): string[]` - Japanese text distractors
- `generateReadingDistractors(correctReading: string, type: 'onyomi' | 'kunyomi', options: DistractorOptions): string[]` - Reading distractors
- `buildMcqOptions(correctAnswer: string, distractors: string[]): { options: string[], correctIndex: number }` - Build complete MCQ with shuffling
- `generateMeaningMcq(item: BlastItem, pool?: DistractorPool): { options: string[], correctIndex: number }` - High-level meaning MCQ
- `generateJapaneseMcq(item: BlastItem, pool?: DistractorPool): { options: string[], correctIndex: number }` - High-level Japanese MCQ
- `generateReadingMcq(reading: string, type: 'onyomi' | 'kunyomi', pool?: DistractorPool): { options: string[], correctIndex: number }` - High-level reading MCQ

**Features:**
- **Meaning Distractors:** Same POS, similar length, avoid synonyms
- **Japanese Distractors:** Same length, same script type (kanji/kana), phonetic variety
- **Reading Distractors:** Same mora count, phonetic neighbors, avoid trivial overlap
- Configurable distractor pools (for Agent B integration)
- Fallback distractors when pool is limited
- Similarity filtering (Levenshtein distance)
- Automatic shuffling with correct index tracking

**Test Coverage:** 29 tests, all passing

---

## Integration Points for Agent B

### DistractorPool Interface

```typescript
export interface DistractorPool {
  kanji?: string[]
  vocabulary?: Array<{
    kanji?: string
    kana: string
    meaning: string
    pos?: string  // Part of speech
  }>
  readings?: Array<{
    reading: string
    type: 'onyomi' | 'kunyomi'
  }>
}
```

**Agent B should provide:**
1. Populate `DistractorPool` from JMdict, kanji database, and list sources
2. Pass pool to distractor generation functions
3. Use `splitIntoTiles()` when building `BlastStep` objects
4. Call high-level MCQ functions (`generateMeaningMcq`, etc.) in step generator

---

## Usage Examples

### Example 1: Generate Tiles for Reassembly

```typescript
import { splitIntoTiles, shuffleTiles } from '@/lib/blast-mode'

const item: BlastItem = {
  id: '1',
  contentType: 'vocabulary',
  kanji: '食べる',
  kana: 'たべる',
  meaningEn: 'to eat',
  tokens: ['食', 'べる']  // Optional: Agent B can provide from tokenizer
}

const result = splitIntoTiles(item)
// result.tiles = ['食', 'べる']
// result.strategy = 'morpheme'
// result.confidence = 'high'

const shuffled = shuffleTiles(result.tiles)
// shuffled = ['べる', '食'] (randomized)
```

### Example 2: Generate MCQ for Meaning Screen

```typescript
import { generateMeaningMcq } from '@/lib/blast-mode'

const item: BlastItem = {
  id: '2',
  contentType: 'vocabulary',
  kanji: '食べる',
  kana: 'たべる',
  meaningEn: 'to eat'
}

const pool: DistractorPool = {
  vocabulary: [
    { kanji: '飲む', kana: 'のむ', meaning: 'to drink', pos: 'verb' },
    { kanji: '行く', kana: 'いく', meaning: 'to go', pos: 'verb' },
    // ... more from JMdict
  ]
}

const mcq = generateMeaningMcq(item, pool)
// mcq.options = ['to go', 'to drink', 'to eat', 'to come']  (shuffled)
// mcq.correctIndex = 2  (where 'to eat' is located)
```

### Example 3: Generate Reading Distractors

```typescript
import { generateReadingMcq } from '@/lib/blast-mode'

const pool: DistractorPool = {
  readings: [
    { reading: 'せい', type: 'onyomi' },
    { reading: 'がく', type: 'onyomi' },
    { reading: 'こう', type: 'onyomi' },
    // ... more from kanji database
  ]
}

const mcq = generateReadingMcq('しょう', 'onyomi', pool)
// mcq.options = ['こう', 'せい', 'しょう', 'がく']  (shuffled, same mora count)
// mcq.correctIndex = 2
```

---

## Performance Characteristics

- **Phonetics:** O(n) where n = reading length
- **Tile Splitting:** O(n) where n = text length
- **Distractor Generation:** O(m) where m = pool size
- **Memory:** Minimal (no caching, pure functions)

All operations complete in <10ms for typical inputs.

---

## Testing

```bash
npm test -- src/lib/blast-mode/__tests__/

# Results:
# ✓ phonetics.test.ts (30 tests)
# ✓ tile-splitter.test.ts (29 tests)
# ✓ distractors.test.ts (29 tests)
# Total: 88 tests, 100% passing
```

---

## Next Steps for Agent B

1. Create data adapters to populate `DistractorPool` from:
   - `kanjiService` for kanji and readings
   - `jmdictLocalSearch` for vocabulary
   - List pools for user content

2. Integrate tile splitter in step generator:
   ```typescript
   const tiles = splitIntoTiles(item).tiles
   const shuffledTiles = shuffleTiles(tiles)
   ```

3. Use high-level MCQ functions in step generation:
   ```typescript
   const meaningMcq = generateMeaningMcq(item, pool)
   const japaneseMcq = generateJapaneseMcq(item, pool)
   const readingMcq = generateReadingMcq(reading, 'onyomi', pool)
   ```

4. Pass MCQ options to `BlastStep`:
   ```typescript
   {
     stepType: 'meaning_to_jp_mcq',
     options: mcq.options,
     answer: mcq.options[mcq.correctIndex]
   }
   ```

---

## Files Delivered

- ✅ `src/lib/blast-mode/phonetics.ts` (210 lines)
- ✅ `src/lib/blast-mode/tile-splitter.ts` (320 lines)
- ✅ `src/lib/blast-mode/distractors.ts` (360 lines)
- ✅ `src/lib/blast-mode/__tests__/phonetics.test.ts` (165 lines)
- ✅ `src/lib/blast-mode/__tests__/tile-splitter.test.ts` (295 lines)
- ✅ `src/lib/blast-mode/__tests__/distractors.test.ts` (300 lines)
- ✅ `src/lib/blast-mode/index.ts` (50 lines)
- ✅ `src/lib/blast-mode/AGENT_C_DELIVERABLES.md` (this file)

**Total:** ~1,700 lines of production code + tests + documentation

---

## Agent C - Mission Complete ✅
