# Textbook Vocabulary Data Pipeline Guide

**Status:** ACTIVE
**Last Updated:** 2026-01-31
**Target Audience:** Developers adding new textbooks or maintaining the dataset

---

## Table of Contents

1. [Overview](#overview)
2. [Anki to JSON Conversion](#anki-to-json-conversion)
3. [Data Format Specification](#data-format-specification)
4. [Converter Scripts](#converter-scripts)
5. [Integration Workflow](#integration-workflow)
6. [Data Quality & Validation](#data-quality--validation)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Topics](#advanced-topics)

---

## Overview

### Data Source Philosophy

**Why Anki decks?**
- ✅ Community-vetted content (thousands of hours of curation)
- ✅ Structured data (SQLite database)
- ✅ Standardized format (`.apkg` files)
- ✅ Rich metadata (tags, examples, audio)
- ✅ Existing textbook alignment (Genki, Minna, etc.)

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Data Creation Pipeline                  │
└─────────────────────────────────────────────────────────┘

   Anki Deck (.apkg file)
          │
          ├─> User downloads from AnkiWeb/community
          │
          ▼
   Converter Script (anki-deck-to-json.mjs)
          │
          ├─> Extracts: Japanese, Reading, Meaning
          ├─> Parses: Tags, Lessons, JLPT levels
          ├─> Processes: Furigana, HTML sanitization
          │
          ▼
   JSON Output (src/data/textbooks/{id}/)
          │
          ├─> all.json (complete dataset)
          ├─> metadata.json (stats, distribution)
          └─> lesson-N.json (per-lesson splits)
          │
          ▼
   Manual Integration Steps
          │
          ├─> Update index.json (registry)
          ├─> Add TextbookSelector UI config
          └─> Test in development
          │
          ▼
   Production Deployment
          │
          └─> Static JSON bundled with app (12MB total)
```

---

## Anki to JSON Conversion

### Anki `.apkg` File Structure

```
deck_name.apkg (ZIP archive)
├── collection.anki21  (SQLite database - Anki 2.1+)
│   OR
├── collection.anki2   (SQLite database - Anki 2.0)
├── media              (JSON manifest of media files)
└── [media files]      (Audio, images referenced in cards)
```

### SQLite Database Schema (Relevant Tables)

```sql
-- Notes table (vocabulary data)
CREATE TABLE notes (
  id    INTEGER PRIMARY KEY,
  flds  TEXT,     -- Fields separated by \x1f (Unit Separator)
  tags  TEXT,     -- Space-separated tags
  mid   INTEGER,  -- Model ID (card template)
  ...
);

-- Example row:
-- id: 1544776574229
-- flds: "温[おん]泉[せん]\x1fhot spring\x1f"
-- tags: "Lesson4 N4 Genki1"
```

### Field Mapping

Most Anki vocabulary decks follow this pattern:

```
Field 0: Japanese (with furigana brackets)
         Example: "温[おん]泉[せん]"

Field 1: English meaning
         Example: "hot spring"

Field 2: Additional info (optional)
         Example: Part of speech, example sentence, etc.
```

**Furigana Format:** `漢字[reading]`
- `温[おん]泉[せん]` → Japanese: "温泉", Reading: "おんせん"
- `食[た]べる` → Japanese: "食べる", Reading: "たべる"

---

## Data Format Specification

### VocabularyItem Interface

```typescript
interface VocabularyItem {
  // Unique identifier (composite)
  id: string  // Format: "{textbook-id}-{index}-{timestamp}"
              // Example: "genki-1-1-1544776574229"

  // Core fields (REQUIRED)
  japanese: string     // "温泉" (clean, no HTML)
  reading: string      // "おんせん" (hiragana/katakana)
  meaning: string      // "hot spring" (English definition)

  // Metadata (OPTIONAL)
  jlptLevel?: string        // "N5" | "N4" | "N3" | "N2" | "N1"
  partOfSpeech?: string[]   // ["noun", "verb", "adjective", etc.]
  examples?: Array<{        // Example sentences
    japanese: string
    reading?: string
    english: string
  }>

  // Organization (OPTIONAL but recommended)
  tags?: string[]      // ["Lesson4", "n4", "genki-1"]
  lesson?: number      // 4
  chapter?: number     // 2
  textbook?: string    // "genki-1"
  source?: string      // "Anki deck converter"
  frequency?: number   // Word frequency ranking (if available)
}
```

### Metadata File Structure

```json
{
  "title": "Genki 1",
  "totalCards": 1496,
  "lessons": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  "chapters": null,
  "jlptDistribution": {
    "N5": 1200,
    "N4": 296
  },
  "partOfSpeechDistribution": {},
  "source": "Anki deck converter (MJS)",
  "importDate": "2026-01-12T15:30:00.000Z"
}
```

### Index File Structure

```json
{
  "totalCards": 17761,
  "textbooks": {
    "genki-1": {
      "title": "Genki 1",
      "cardCount": 1496
    },
    "genki-2": {
      "title": "Genki 2",
      "cardCount": 491
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

## Converter Scripts

### Recommended: anki-deck-to-json.mjs (Pure JavaScript)

**File:** `scripts/anki-deck-to-json.mjs`
**Dependencies:** `jszip`, `sql.js` (already in package.json)

#### Usage

```bash
node scripts/anki-deck-to-json.mjs <apkg-path> <textbook-id> <title>

# Example:
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/Genki_1_Vocabulary.apkg \
  genki-1 \
  "Genki 1"
```

#### Key Features

1. **Furigana Processing**
   ```javascript
   // Input:  "温[おん]泉[せん]"
   // Output: { japanese: "温泉", reading: "おんせん" }

   function processFurigana(text) {
     const readings = []
     const readingMatches = text.matchAll(/\[([^\]]+)\]/g)
     for (const match of readingMatches) {
       readings.push(match[1])
     }
     const japanese = text.replace(/\[([^\]]+)\]/g, '')
     const reading = readings.length > 0 ? readings.join('') : japanese
     return { japanese, reading }
   }
   ```

2. **HTML Sanitization**
   ```javascript
   function cleanHTML(text) {
     return String(text)
       .replace(/<[^>]*>/g, '')        // Remove tags
       .replace(/&nbsp;/g, ' ')        // Decode entities
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/\s+/g, ' ')           // Normalize whitespace
       .trim()
   }
   ```

3. **Tag Parsing**
   ```javascript
   // Lesson detection: "Lesson1", "lesson-2", "lesson_3"
   function extractLessonChapter(tags) {
     const result = {}
     for (const tag of tags) {
       const lessonMatch = tag.match(/lesson[-_]?(\d+)/i)
       const chapterMatch = tag.match(/chapter[-_]?(\d+)/i)
       if (lessonMatch) result.lesson = parseInt(lessonMatch[1])
       if (chapterMatch) result.chapter = parseInt(chapterMatch[1])
     }
     return result
   }

   // JLPT level: "N5", "n4", "JLPT-N3"
   function extractJLPTLevel(tags) {
     for (const tag of tags) {
       const match = tag.match(/n[1-5]/i)
       if (match) return match[0].toUpperCase()
     }
     return 'N5'  // Default
   }
   ```

#### Output Files

```bash
src/data/textbooks/genki-1/
├── all.json           # All 1,496 vocabulary items
├── metadata.json      # Statistics and distribution
├── lesson-1.json      # 125 items from lesson 1
├── lesson-2.json      # 118 items from lesson 2
└── ...                # lesson-3.json through lesson-12.json
```

### Alternative: convert-anki-to-textbook.ts (TypeScript)

**File:** `scripts/convert-anki-to-textbook.ts`
**Dependencies:** Requires `AnkiParser` from `src/lib/anki/parser`

#### Usage

```bash
npx ts-node scripts/convert-anki-to-textbook.ts <apkg-path> <textbook-id> <title>
```

#### Advantages
- More sophisticated field detection
- Uses existing `AnkiParser` library
- Better example sentence extraction

#### Disadvantages
- Requires TypeScript compilation
- Slower execution
- More complex dependencies

**Recommendation:** Use `anki-deck-to-json.mjs` for simplicity and speed.

---

## Integration Workflow

### Step 1: Convert Anki Deck

```bash
# Download deck from AnkiWeb or receive from community
# File: ~/Downloads/New_Textbook_Vocab.apkg

# Run converter
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/New_Textbook_Vocab.apkg \
  new-textbook \
  "New Textbook"

# Expected output:
# ✅ Found 850 notes
# ✅ Converted 845 items
# ✅ Wrote all.json (845 items)
# ✅ Wrote metadata.json
# ✅ Wrote lesson-1.json (72 items)
# ...
```

### Step 2: Review Generated Data

```bash
# Check output directory
ls -la src/data/textbooks/new-textbook/

# Inspect data quality
cat src/data/textbooks/new-textbook/all.json | head -50

# Verify metadata
cat src/data/textbooks/new-textbook/metadata.json
```

**Quality Checklist:**
- [ ] Japanese and reading fields are correctly separated
- [ ] No HTML tags in any fields
- [ ] Lesson numbers detected correctly
- [ ] JLPT levels assigned appropriately
- [ ] Examples formatted correctly

### Step 3: Update Textbook Registry

```typescript
// src/data/textbooks/index.json

{
  "totalCards": 18606,  // Add new textbook's cardCount
  "textbooks": {
    // ... existing textbooks
    "new-textbook": {
      "title": "New Textbook",
      "cardCount": 845
    }
  }
}
```

### Step 4: Add UI Configuration

```typescript
// src/app/[locale]/textbook-vocabulary/components/TextbookSelector.tsx
// Line ~57 (textbookInfo object)

const textbookInfo = {
  // ... existing configs
  'new-textbook': {
    icon: '📖',  // Choose appropriate emoji
    color: 'from-blue-400 to-cyan-500',
    shadowColor: 'shadow-cyan-200 dark:shadow-cyan-500/50',
    hoverShadow: 'hover:shadow-cyan-300 dark:hover:shadow-cyan-400/60',
    level: 'N4-N5',  // JLPT range
    description: 'Short description',
    lessons: 15  // Number from metadata.json
  }
}
```

**Available Color Palettes:**
- Pink-Purple: `from-pink-400 to-purple-500`
- Purple-Indigo: `from-purple-400 to-indigo-500`
- Indigo-Blue: `from-indigo-400 to-blue-500`
- Green-Teal: `from-green-400 to-teal-500`
- Teal-Blue: `from-teal-400 to-blue-500`
- Emerald-Teal: `from-emerald-400 to-teal-500`
- Lime-Green: `from-lime-400 to-green-500`
- Yellow-Amber: `from-yellow-400 to-amber-500`
- Orange-Red: `from-orange-400 to-red-500`
- Blue-Cyan: `from-blue-400 to-cyan-500`

### Step 5: Test in Development

```bash
npm run dev

# Navigate to http://localhost:3000/textbook-vocabulary
# Verify:
# - Textbook appears in grid
# - Card count is correct
# - Lessons load properly
# - Search works
# - Audio playback functions
# - Progress tracking works
```

### Step 6: Commit & Deploy

```bash
git add src/data/textbooks/new-textbook/
git add src/data/textbooks/index.json
git add src/app/[locale]/textbook-vocabulary/components/TextbookSelector.tsx

git commit -m "feat: Add New Textbook vocabulary (845 items)

- Convert Anki deck to JSON format
- Add 15 lessons with N4-N5 vocabulary
- Configure UI with blue-cyan gradient
- Total vocabulary now 18,606 items"

git push origin main
```

---

## Data Quality & Validation

### Common Data Issues

#### 1. HTML Tags in Fields

**Problem:**
```json
{
  "japanese": "温泉<br>",
  "meaning": "hot spring<b>(onsen)</b>"
}
```

**Solution:**
Converter already strips HTML, but double-check with:

```bash
# Search for HTML tags in generated data
grep -r '<[^>]*>' src/data/textbooks/new-textbook/all.json
```

**Runtime Safeguard:**
```typescript
// VocabularyDisplay.tsx has additional sanitization
function sanitizeVocabularyItem(item: VocabularyItem): VocabularyItem {
  return {
    ...item,
    japanese: stripHtmlTags(item.japanese),
    reading: stripHtmlTags(item.reading),
    meaning: stripHtmlTags(item.meaning)
  }
}
```

#### 2. Swapped Fields (Japanese ↔ Reading)

**Problem:**
```json
{
  "japanese": "おんせん",  // Should be reading
  "reading": "温泉"         // Should be japanese
}
```

**Detection:**
```javascript
// Check if "japanese" field contains only kana
const hasKanji = /[\u4e00-\u9faf]/.test(item.japanese)
if (!hasKanji && item.japanese.length > 1) {
  console.warn('Possible field swap:', item.id)
}
```

**Fix:**
Manually edit `all.json` or adjust converter field indices.

#### 3. Missing Lesson Numbers

**Problem:**
```json
{
  "lesson": null,
  "tags": ["Genki1", "N5"]  // No "Lesson4" tag
}
```

**Solution:**
Add tags to Anki deck before conversion, or manually add lesson numbers post-conversion.

### Build-Time Validation (Recommended)

```typescript
// scripts/validate-textbook-data.ts

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateTextbookData(textbookId: string): ValidationResult {
  const result = { valid: true, errors: [], warnings: [] }

  // Load data
  const allJson = require(`../src/data/textbooks/${textbookId}/all.json`)
  const metadata = require(`../src/data/textbooks/${textbookId}/metadata.json`)

  // Check 1: All items have required fields
  allJson.forEach((item, index) => {
    if (!item.japanese || !item.reading || !item.meaning) {
      result.errors.push(`Item ${index}: Missing required field`)
      result.valid = false
    }
  })

  // Check 2: No HTML tags
  allJson.forEach((item, index) => {
    const htmlPattern = /<[^>]*>/
    if (htmlPattern.test(item.japanese) ||
        htmlPattern.test(item.reading) ||
        htmlPattern.test(item.meaning)) {
      result.errors.push(`Item ${index}: Contains HTML tags`)
      result.valid = false
    }
  })

  // Check 3: Card count matches
  if (allJson.length !== metadata.totalCards) {
    result.errors.push(`Card count mismatch: ${allJson.length} vs ${metadata.totalCards}`)
    result.valid = false
  }

  // Check 4: Lesson files exist
  if (metadata.lessons) {
    metadata.lessons.forEach(lessonNum => {
      const lessonPath = `../src/data/textbooks/${textbookId}/lesson-${lessonNum}.json`
      if (!fs.existsSync(lessonPath)) {
        result.warnings.push(`Missing lesson file: lesson-${lessonNum}.json`)
      }
    })
  }

  return result
}

// Usage in CI/CD
const result = validateTextbookData('genki-1')
if (!result.valid) {
  console.error('Validation failed:', result.errors)
  process.exit(1)
}
```

---

## Troubleshooting

### Issue: "No notes found in deck"

**Cause:** Empty deck or corrupted file

**Solution:**
1. Re-export from Anki desktop app
2. Verify file size (should be > 1KB)
3. Try opening in Anki to confirm it's valid

### Issue: Wrong field mapping

**Symptoms:**
- Japanese field contains English
- Reading field contains kanji

**Solution:**

```javascript
// Edit converter script around line 136-142
// Current mapping:
const field0 = cleanHTML(fieldList[0] || '')  // Japanese
const field1 = cleanHTML(fieldList[1] || '')  // Meaning

// If fields are swapped, change to:
const field0 = cleanHTML(fieldList[1] || '')  // Swap
const field1 = cleanHTML(fieldList[0] || '')  // Swap
```

### Issue: No lessons detected

**Cause:** Anki deck lacks lesson tags

**Solution 1:** Add tags to Anki deck
```
In Anki:
1. Select all cards
2. Add tags: "Lesson1", "Lesson2", etc.
3. Export deck
4. Re-run converter
```

**Solution 2:** Manually add lesson numbers
```typescript
// Edit all.json
items.forEach((item, index) => {
  // Assign lessons based on index (e.g., 100 items per lesson)
  item.lesson = Math.floor(index / 100) + 1
})
```

### Issue: Furigana not parsing correctly

**Problem:**
```json
{
  "japanese": "温[おん]泉[せん]",  // Brackets not removed
  "reading": "温[おん]泉[せん]"     // Same as japanese
}
```

**Cause:** Converter furigana regex not matching

**Debug:**
```javascript
const text = "温[おん]泉[せん]"
const matches = text.matchAll(/\[([^\]]+)\]/g)
console.log('Matches:', Array.from(matches))
// Should output: ["おん", "せん"]
```

**Fix:**
Check for different bracket styles:
- Square brackets: `[おん]`
- Curly brackets: `{おん}`
- Parentheses: `(おん)`

---

## Advanced Topics

### Custom Field Extraction

Some Anki decks use non-standard field layouts. You may need to customize the converter.

**Example:** Deck with 4 fields (Japanese, Reading, Meaning, Example)

```javascript
// In anki-deck-to-json.mjs, around line 132

const fieldList = String(fields).split('\x1f')

// Custom extraction
const { japanese, reading } = processFurigana(fieldList[0] || '')
const meaning = cleanHTML(fieldList[2] || '')  // Skip field 1
const exampleSentence = cleanHTML(fieldList[3] || '')

return {
  id: `${textbookId}-${index + 1}-${Date.now()}`,
  japanese,
  reading,
  meaning,
  examples: exampleSentence ? [{
    japanese: exampleSentence,
    reading: '',
    english: ''
  }] : [],
  // ... rest of fields
}
```

### Handling Audio Files

Some Anki decks include audio. To extract:

```javascript
// After loading ZIP
const mediaFile = zip.file('media')
const mediaManifest = JSON.parse(await mediaFile.async('text'))

// mediaManifest maps filenames to media indices
// Example: {"0": "audio_1.mp3", "1": "audio_2.mp3"}

// Extract audio for each note
const audioData = {}
for (const [key, filename] of Object.entries(mediaManifest)) {
  const audioFile = zip.file(filename)
  if (audioFile) {
    const audioBlob = await audioFile.async('blob')
    // Upload to storage or save locally
    audioData[key] = audioBlob
  }
}
```

**Note:** Current implementation uses TTS instead of pre-recorded audio.

### Bulk Conversion

Convert multiple decks at once:

```bash
#!/bin/bash
# scripts/bulk-convert.sh

DECKS=(
  "~/Downloads/Genki_3.apkg:genki-3:Genki 3"
  "~/Downloads/Tobira.apkg:tobira:Tobira"
  "~/Downloads/JLPT_N3.apkg:jlpt-n3:JLPT N3"
)

for deck in "${DECKS[@]}"; do
  IFS=':' read -r path id title <<< "$deck"
  echo "Converting: $title"
  node scripts/anki-deck-to-json.mjs "$path" "$id" "$title"
done

echo "✅ Bulk conversion complete!"
```

### Merging Multiple Decks

Combine vocabulary from multiple sources:

```javascript
// scripts/merge-textbooks.js
const fs = require('fs')

const sources = [
  'src/data/textbooks/genki-1/all.json',
  'src/data/textbooks/genki-1-supplemental/all.json'
]

const merged = []
const seen = new Set()

sources.forEach(source => {
  const data = JSON.parse(fs.readFileSync(source, 'utf-8'))
  data.forEach(item => {
    // Deduplicate by japanese + meaning
    const key = `${item.japanese}:${item.meaning}`
    if (!seen.has(key)) {
      merged.push(item)
      seen.add(key)
    }
  })
})

fs.writeFileSync(
  'src/data/textbooks/genki-1-combined/all.json',
  JSON.stringify(merged, null, 2)
)

console.log(`✅ Merged ${merged.length} unique items`)
```

---

## Best Practices

### Do's ✅

1. **Always review generated data** before committing
2. **Validate against a sample** - Check first 10-20 items manually
3. **Preserve source Anki files** - Keep originals for re-conversion
4. **Document deck source** - Note where deck was downloaded from
5. **Test in development** before deploying to production
6. **Use semantic commit messages** when adding new textbooks

### Don'ts ❌

1. **Don't commit without testing** - Ensure UI loads correctly
2. **Don't skip HTML sanitization** - Even if deck looks clean
3. **Don't ignore validation warnings** - Investigate before proceeding
4. **Don't overwrite existing textbooks** without backup
5. **Don't use decks with unclear licensing** - Ensure redistribution is allowed

---

## Dataset Statistics (Current)

```
Total Textbooks: 10
Total Vocabulary: 17,761 items
Total Size: ~12MB (minified JSON)

Breakdown:
├─ Genki Series (3 textbooks): 2,576 items (14.5%)
├─ Minna Series (2 textbooks): 3,087 items (17.4%)
├─ Dekiru Series (3 textbooks): 1,319 items (7.4%)
├─ Kaishi 15K (1 source): 1,500 items (8.4%)
└─ Kanji in Context (1 source): 9,279 items (52.2%)

JLPT Distribution:
├─ N5: 6,245 items (35.2%)
├─ N4: 4,892 items (27.5%)
├─ N3: 3,124 items (17.6%)
├─ N2: 2,167 items (12.2%)
└─ N1: 1,333 items (7.5%)

Lesson Organization:
├─ Organized by lessons: 8 textbooks (80%)
└─ Flat (no lessons): 2 sources (20%)
```

---

## Related Documentation

- [README.md](./README.md) - Feature overview
- [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) - Implementation guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [Anki Converter Guide](../../scripts/ANKI_CONVERTER_GUIDE.md) - Quick reference

---

**Last Updated:** 2026-01-31
**Maintainer:** Development Team
