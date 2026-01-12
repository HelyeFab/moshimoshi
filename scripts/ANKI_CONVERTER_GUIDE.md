# Anki to Textbook Converter Guide

## 🎯 Quick Start

Convert any Anki `.apkg` deck to Moshimoshi textbook format:

```bash
node scripts/anki-deck-to-json.mjs <path-to-apkg> <textbook-id> <title>
```

## 📖 Examples

### Dekiru Nihongo (Already Done ✅)
```bash
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/Dekiru_Nihongo__-_Vocabulary.apkg \
  dekiru-nihongo-1 \
  "Dekiru Nihongo 1"
```

### Your Other Anki Decks in Downloads
```bash
# Dekiru Nihongo Part 2
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/Dekiru_Nihongo__-_Vocabulary_Part_2.apkg \
  dekiru-nihongo-2 \
  "Dekiru Nihongo 2"

# Dekiru Nihongo Beginner/Intermediate
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/Dekiru_Nihongo_Beginner_Intermediate__-_Vocabulary.apkg \
  dekiru-nihongo-beginner \
  "Dekiru Nihongo Beginner"

# Japanese Core 2000
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/Japanese_Core_2000_Step_01_Listening_Sentence_Vocab__Images.apkg \
  core-2000 \
  "Core 2000 Vocabulary"

# Tae Kim Grammar
node scripts/anki-deck-to-json.mjs \
  ~/Downloads/Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg \
  tae-kim \
  "Tae Kim Grammar"
```

## 🔧 What the Converter Does

1. **Extracts** vocabulary from Anki `.apkg` file
2. **Parses** SQLite database (supports anki2 and anki21 formats)
3. **Converts** to Moshimoshi vocabulary JSON format
4. **Generates**:
   - `all.json` - All vocabulary items
   - `metadata.json` - Stats, JLPT distribution, lessons
   - `lesson-N.json` - Per-lesson files (if lessons detected)

## 📊 Output Structure

```json
{
  "id": "textbook-id-1-timestamp",
  "japanese": "温泉",
  "reading": "おんせん",
  "meaning": "hot spring",
  "jlptLevel": "N4",
  "partOfSpeech": [],
  "examples": [],
  "tags": ["Lesson4", "n4", "textbook-id"],
  "lesson": 4,
  "textbook": "textbook-id"
}
```

## 🎨 Integration Steps

After running the converter, you need to make it visible in the UI:

### 1. Update `src/data/textbooks/index.json`

Add your textbook to the `textbooks` section:

```json
{
  "totalCards": 17087,  // Update total count
  "textbooks": {
    "your-textbook-id": {
      "title": "Your Textbook Title",
      "cardCount": 645
    }
  }
}
```

### 2. Update `src/app/[locale]/textbook-vocabulary/components/TextbookSelector.tsx`

Add UI configuration to the `textbookInfo` object (around line 57):

```typescript
'your-textbook-id': {
  icon: '🎌',  // Choose an emoji
  color: 'from-emerald-400 to-teal-500',  // Gradient colors
  shadowColor: 'shadow-emerald-200 dark:shadow-emerald-500/50',
  hoverShadow: 'hover:shadow-emerald-300 dark:hover:shadow-emerald-400/60',
  level: 'N4-N5',  // JLPT level range
  description: 'Short description',
  lessons: 3  // Number of lessons
}
```

### 3. Test

Visit `/textbook-vocabulary` and you should see your new textbook card!

## 🎨 Available Icon & Color Combinations

**Used:**
- 🌸 Pink-Purple (Genki 1)
- 🌺 Purple-Indigo (Genki 2)
- 🌷 Indigo-Blue (Genki 2 New)
- 🌿 Green-Teal (Minna 1)
- 🌊 Teal-Blue (Minna 2)
- 🎌 Emerald-Teal (Dekiru Nihongo 1)
- 🔥 Orange-Red (Kaishi 15K)
- 📚 Blue-Cyan (Kanji in Context)

**Available:**
- 🎋 Lime-Green (`from-lime-400 to-green-500`)
- 🌟 Yellow-Amber (`from-yellow-400 to-amber-500`)
- 🎭 Violet-Purple (`from-violet-400 to-purple-500`)
- 🌙 Slate-Blue (`from-slate-400 to-blue-500`)
- 🎪 Fuchsia-Pink (`from-fuchsia-400 to-pink-500`)
- 🏮 Rose-Red (`from-rose-400 to-red-500`)

## 🔍 How It Detects Lessons/Chapters

The converter looks for tags in your Anki deck:
- `Lesson1`, `lesson-1`, `lesson_1` → `lesson: 1`
- `Chapter5`, `chapter-5` → `chapter: 5`
- `N5`, `n4`, `JLPT-N3` → `jlptLevel: "N5"`

## 📝 Data Quality Tips

1. **Anki Deck Preparation:**
   - Ensure cards have consistent field ordering:
     - Field 0: Japanese (expression)
     - Field 1: Reading (hiragana/katakana)
     - Field 2: Meaning (English)
   - Use tags for lesson numbers: `Lesson1`, `Lesson2`, etc.
   - Use JLPT tags: `N5`, `N4`, `N3`, etc.

2. **After Conversion:**
   - Review `all.json` for data quality
   - Check if `japanese` and `reading` are correctly assigned
   - Verify JLPT levels make sense
   - Ensure lesson numbers are detected

3. **Manual Cleanup (if needed):**
   - Edit `all.json` directly if fields are swapped
   - Update `metadata.json` if totals are wrong

## 🐛 Troubleshooting

**"No notes found in deck"**
- Deck might be empty or corrupted
- Try exporting again from Anki

**Wrong field mapping (japanese/reading swapped)**
- Edit the converter script around line 105-108
- Swap field indices: `fieldList[0]` ↔ `fieldList[1]`

**No lessons detected**
- Add tags to your Anki cards: `Lesson1`, `Lesson2`, etc.
- Or manually add lesson numbers to JSON after conversion

**HTML tags in output**
- The converter strips most HTML, but some might remain
- `VocabularyDisplay.tsx` has additional sanitization

## 📂 File Locations

- **Converter Script:** `scripts/anki-deck-to-json.mjs`
- **Output Directory:** `src/data/textbooks/{textbook-id}/`
- **Index File:** `src/data/textbooks/index.json`
- **UI Config:** `src/app/[locale]/textbook-vocabulary/components/TextbookSelector.tsx`

## ✅ Current Textbooks

1. Genki 1 (1,496 cards)
2. Genki 2 (491 cards)
3. Genki 2 New (589 cards)
4. Minna 1 (2,029 cards)
5. Minna 2 (1,058 cards)
6. **Dekiru Nihongo 1 (645 cards)** ← New!
7. Kaishi 15K (1,500 cards)
8. Kanji in Context (9,279 cards)

**Total:** 17,087 vocabulary items

---

**Last Updated:** 2026-01-12
**Original MCP Tool:** `anki-word-generator` (July 2025)
**Current Tool:** `anki-deck-to-json.mjs` (Pure JavaScript)
