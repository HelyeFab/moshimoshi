# Japanese Learning Data Resources

This document describes the data resources available in the `/data` directory for the Moshimoshi Japanese learning platform.

## Directory Structure

```
data/
├── dictionary/          # JMDict Japanese-English dictionary files
├── kanji/              # Kanji-related data
│   ├── strokes/        # Stroke order SVG files
│   └── jlpt/           # JLPT level-organized kanji data
├── audio/              # Audio pronunciation files
│   ├── hiragana/       # Hiragana pronunciation MP3s
│   └── katakana/       # Katakana pronunciation MP3s
├── sentences/          # Example sentences
│   └── tatoeba/        # Tatoeba corpus examples
├── textbooks/          # Textbook vocabulary data
├── achievements/       # Achievement system data
├── kanaData.ts         # TypeScript kana data structures
└── pokemonData.ts      # Pokemon names in Japanese
```

## Data Sources

### 1. Dictionary Data (`/dictionary`)

**JMDict (Japanese-English Dictionary)**
- `jmdict-eng-common-3.6.1.json` (16MB) - Full common words dictionary
- `jmdict-eng-common.json` (16MB) - Alternative version
- `jmdict-examples-eng-3.6.1+20250623122643.json.zip` (14MB) - Example sentences
- `kanjidic2-en-3.6.1+20250623122643.json.zip` (1.3MB) - Kanji dictionary
- Compressed versions available for optimization

**Usage**: Core dictionary lookups, word definitions, readings, and translations.

### 2. Kanji Resources (`/kanji`)

#### Stroke Patterns (`/strokes/kanjivg`)
- SVG files for kanji stroke order animations
- Files named by Unicode codepoint (e.g., `04e00.svg` for 一)
- Covers all common kanji characters
- **Usage**: Teaching proper kanji writing stroke order

#### JLPT Data (`/jlpt`)
Organized by JLPT levels and sub-sections:
- `jlpt_5/` - N5 level kanji (beginner)
- `jlpt_4/` - N4 level kanji
- `jlpt_3/` - N3 level kanji (with subsections 3_1, 3_2, 3_3)
- `jlpt_2/` - N2 level kanji (with subsections 2_1, 2_2, 2_3)
- `jlpt_1/` - N1 level kanji (with subsections 1_1 through 1_10)

Each folder contains a JSON file with kanji data including:
- Character
- Readings (on'yomi, kun'yomi)
- Meanings
- Example words
- JLPT level

### 3. Audio Files (`/audio`)

#### Kana Pronunciation
- `/hiragana/` - 71 MP3 files for all hiragana sounds
- `/katakana/` - 71 MP3 files for all katakana sounds
- `index.json` - Metadata mapping kana to audio files

**File naming**: Direct romanization (e.g., `ka.mp3`, `shi.mp3`, `kya.mp3`)

**Coverage**:
- Basic kana (あ-ん, ア-ン)
- Dakuten/Handakuten variations (が, ぱ, etc.)
- Combination kana (きゃ, しゅ, etc.)

### 4. Example Sentences (`/sentences/tatoeba`)

- 247 JSON files with example sentences
- Files numbered: `examples-1.json` through `examples-247.json`
- Each file contains sentences with:
  - Japanese text
  - English translation
  - Furigana readings
  - Difficulty level
  - Word breakdowns

**Source**: Tatoeba Project - crowd-sourced sentence corpus

### 5. Textbook Vocabulary (`/textbooks`)

Structured vocabulary lists from popular Japanese textbooks:

#### Genki Series
- `/genki-1/` - Genki I vocabulary (lessons 1-12)
- `/genki-2-new/` - Genki II vocabulary (lessons 13-23)
- `/genki-2-complete/` - Complete Genki II vocabulary

#### Minna no Nihongo Series
- `/minna-1/` - Minna no Nihongo I vocabulary
- `/minna-2/` - Minna no Nihongo II vocabulary

#### Kanji in Context
- `/kanji-in-context/` - Vocabulary from Kanji in Context textbook
- Organized by chapters (chapter-1.json through chapter-40.json)

Each vocabulary file includes:
- Japanese word
- Reading (hiragana)
- English meaning
- Part of speech
- Lesson/chapter number
- Additional notes

### 6. TypeScript Data Files

#### kanaData.ts
Structured TypeScript data containing:
- Complete hiragana chart with romanization
- Complete katakana chart with romanization
- Stroke order information
- Character groupings (gojuon, dakuten, combination)
- Learning order recommendations

#### pokemonData.ts
- All Pokemon names in Japanese (katakana)
- Romanized versions
- English names
- Pokemon types in Japanese
- Useful for gamification and engagement

### 7. Achievements (`/achievements`)

Achievement system configuration and data:
- Achievement definitions
- Progress tracking structures
- Milestone configurations
- Reward systems

## Data Formats

### JSON Structure Examples

#### Dictionary Entry
```json
{
  "word": "食べる",
  "reading": "たべる",
  "meanings": ["to eat", "to consume"],
  "jlpt": 5,
  "common": true
}
```

#### Kanji Entry
```json
{
  "kanji": "日",
  "onyomi": ["ニチ", "ジツ"],
  "kunyomi": ["ひ", "び"],
  "meanings": ["day", "sun", "Japan"],
  "jlpt": 5,
  "strokes": 4
}
```

#### Sentence Example
```json
{
  "japanese": "今日は天気がいいですね。",
  "english": "The weather is nice today, isn't it?",
  "furigana": "きょうはてんきがいいですね。",
  "difficulty": "N5"
}
```

## Usage Guidelines

### Performance Considerations
1. **Large Files**: Dictionary files are 16MB+ - implement lazy loading
2. **Audio Files**: Preload only necessary audio files
3. **SVG Files**: Consider caching frequently used kanji strokes
4. **Compression**: Use compressed versions when available

### Best Practices
1. **Progressive Loading**: Start with essential data, load advanced content as needed
2. **Caching Strategy**: Cache frequently accessed data (common kanji, basic kana)
3. **Offline Support**: Essential data should be available offline via service workers
4. **Data Validation**: Validate data structure when loading JSON files

### Integration Tips

#### Dictionary Lookup
```typescript
import dictionary from '@/data/dictionary/jmdict-eng-common.json';

function lookupWord(word: string) {
  return dictionary.words.find(entry => entry.word === word);
}
```

#### Audio Playback
```typescript
function playKanaSound(kana: string, type: 'hiragana' | 'katakana') {
  const audio = new Audio(`/data/audio/${type}/${kana}.mp3`);
  audio.play();
}
```

#### Kanji Stroke Animation
```typescript
function loadKanjiStroke(kanji: string) {
  const codePoint = kanji.charCodeAt(0).toString(16).padStart(5, '0');
  return `/data/kanji/strokes/kanjivg/${codePoint}.svg`;
}
```

## Data Statistics

- **Dictionary Entries**: ~180,000 common words
- **Kanji Coverage**: 2,136 Jōyō kanji + additional
- **Audio Files**: 142 kana pronunciation files
- **Example Sentences**: ~50,000 sentences
- **Textbook Vocabulary**: ~8,000 words across all textbooks
- **SVG Stroke Files**: Complete coverage of common kanji

## Maintenance Notes

### Update Schedule
- Dictionary data: Check JMDict updates quarterly
- Textbook vocabulary: Update when new editions release
- Audio files: Stable, no regular updates needed
- Stroke patterns: Stable, sourced from KanjiVG project

### Data Sources & Attribution
- **JMDict**: Electronic Dictionary Research and Development Group
- **KanjiVG**: Ulrich Apel
- **Tatoeba**: Tatoeba Project (CC BY 2.0)
- **Audio Files**: Various open-source contributors
- **Textbook Vocabulary**: Derived from published textbooks (educational use)

## License Information

Different data sources have different licenses:
- JMDict: Creative Commons Attribution-ShareAlike 3.0
- KanjiVG: Creative Commons Attribution-ShareAlike 3.0
- Tatoeba: CC BY 2.0 (with attribution)
- Audio files: Various open licenses
- Textbook vocabulary: Educational fair use

Ensure proper attribution when using this data in production.

## Contact & Updates

For data updates or corrections:
- Report issues in the project repository
- Check original sources for the latest versions
- Maintain data versioning for updates

---

*Last Updated: September 2025*
*Data Version: 3.6.1*