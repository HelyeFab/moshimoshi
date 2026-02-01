# Comic Generation Prompts

Source: `src/app/api/admin/comics/generate/route.ts` (prompt builder functions)

## Outline Prompt

```
Create an outline for a Japanese learning comic episode with multiple characters.

Theme: {theme}
Location: {location}

{characterDesc}

This episode shows the characters exploring {location} and learning about {theme}.

Generate a JSON outline with:
{
  "title": "English title",
  "titleJa": "Japanese title",
  "synopsis": "Brief synopsis in English",
  "synopsisJa": "Brief synopsis in Japanese",
  "learningObjectives": ["objective 1", "objective 2", "objective 3"],
  "panelBreakdown": [
    {
      "panelNumber": 1,
      "description": "Scene description",
      "characters": ["character-id-1", "character-id-2"],
      "keyDialogue": "Main dialogue in this panel",
      "vocabularyFocus": ["word1", "word2"]
    }
  ]
}

Create 6 panels that tell a complete mini-story with a beginning, middle, and end.
Include useful everyday Japanese phrases appropriate for beginners.
Make sure the characters interact naturally based on their personalities.
Each panel should specify which characters appear in the "characters" array.
```

Notes:
- `{characterDesc}` is built from the character sheet when present; otherwise defaults to Moshi.

## Dialogue Prompt

```
Generate dialogues for a Japanese learning comic with multiple characters.

Outline: {outlineJson}
Theme: {theme}
Location: {location}

{characterDesc}

Return a JSON object with a "panels" array:
{
  "panels": [
    {
      "panelNumber": 1,
      "sceneDescription": "Visual description of the scene",
      "characters": ["character-id-1", "character-id-2"],
      "dialogues": [
        {
          "characterId": "moshi-master",
          "characterName": "Moshi",
          "textJa": "Japanese text (use beginner-friendly grammar/vocab)",
          "textEn": "English translation",
          "furigana": "Japanese with furigana markup like 日本(にほん)",
          "bubbleStyle": "speech|thought|shout|whisper",
          "emotion": "happy|surprised|confused|excited|neutral"
        }
      ],
      "narration": {
        "textJa": "Optional narration in Japanese",
        "textEn": "Optional narration in English"
      },
      "soundEffects": [
        {
          "textJa": "ドキドキ",
          "meaning": "heart pounding"
        }
      ]
    }
  ]
}

CRITICAL REQUIREMENTS FOR STORY STRUCTURE:
1. **NO REPETITION**: Each panel must have DIFFERENT, UNIQUE dialogue. NEVER repeat the same phrase (like すごい) across multiple panels.
2. **Story Progression**: Follow a clear narrative arc:
   - Panels 1-2: Setup/Introduction (characters arrive, observe, react to new situation)
   - Panels 3-4: Development/Action (characters interact, try something, encounter challenge)
   - Panels 5-6: Resolution/Conclusion (problem solved, lesson learned, positive ending)
3. **Dialogue Variety**: Use diverse expressions appropriate for {jlptLevel} level:
   - Examples: {levelExamples}
4. **Natural Conversation**: Characters should:
   - Ask questions and respond to each other
   - React to events in the scene
   - Express different emotions throughout the story
   - Use phrases that advance the plot

IMPORTANT:
- Use the correct characterId for each character (e.g., "moshi-master", "sensei-panda", "yuki-sloth", "koa-koala")
- Make each character speak according to their personality and speaking style
- Have natural interactions between characters with turn-taking dialogue
- Include the "characters" array listing which characters appear in each panel
- Make dialogues educational and fun! Include common phrases learners would use in real situations
- Each panel should teach 1-2 new vocabulary words or grammar patterns
- VARY the sentence patterns and vocabulary across all 6 panels
```

Notes:
- `{outlineJson}` is the outline serialized with `JSON.stringify(outline)`.
- `{levelExamples}` is a JLPT-specific list embedded in code (N5/N4/N3).

## Panel Image Prompt

```
Kawaii manga-style comic panel illustration.

Scene: {sceneDesc}
Location: {location}, Japan
Theme: {theme}

⚠️ CRITICAL: GENERATE A COMPLETELY TEXT-FREE IMAGE ⚠️
The image must contain ZERO text elements. This is a pure visual illustration only.
Text overlays will be added separately in post-processing.
Generate only visual elements: characters, scenery, objects, colors, expressions.
No Japanese characters (hiragana, katakana, kanji), no English letters, no numbers, no symbols, no signs, no labels.

Characters in this panel:
{characterDescs}

CRITICAL CHARACTER REQUIREMENTS:
- This panel contains EXACTLY {uniqueCharCount} character(s)
- Each character listed above should appear ONLY ONCE in the image
- DO NOT duplicate or mirror any character
- If multiple characters are listed, they should be clearly distinguishable as DIFFERENT individuals
- Position characters at different locations in the scene (e.g., left/right, foreground/background)
- Each character has UNIQUE visual features as described above - maintain those differences

Style: Soft pastel colors, clean lines, children's book illustration, Japanese manga influences, safe for children.

OUTPUT FORMAT:
- Generate ONLY a single complete comic panel scene
- DO NOT add "ACCESSORY DETAILS" sections below the main image
- DO NOT add detail breakdowns, side views, turnarounds, or item catalogs
- DO NOT add supplementary diagrams, labels, or reference sheets
- The output must be ONLY the comic panel scene itself

The scene should clearly show {location} with authentic Japanese details. Show the characters interacting naturally with each other and the environment.

⚠️ FINAL REMINDER: Generate a completely text-free image with no text, speech bubbles, or sound effects of any kind. ⚠️
```

## Vocabulary Extraction Prompt

```
Extract vocabulary from this Japanese text for beginner learners:

{text}

Return a JSON array of vocabulary items:
[
  {
    "word": "kanji/kana word",
    "reading": "hiragana reading",
    "meaning": "English meaning",
    "partOfSpeech": "noun/verb/adjective/etc",
    "exampleFromComic": "sentence from the comic using this word"
  }
]

Focus on the most useful and relevant vocabulary for beginner learners.
Include 8-12 vocabulary items.
```

## Cultural Notes Prompt

```
Create cultural notes for a Japanese learning comic about {theme} at {location}.

You MUST return a JSON object with a "notes" array in EXACTLY this format:
{
  "notes": [
    {
      "title": "Cultural topic title in English",
      "titleJa": "文化トピックのタイトル",
      "content": "2-3 sentences explaining this cultural aspect in English",
      "contentJa": "この文化的側面を説明する日本語の文章",
      "iconEmoji": "🏯"
    }
  ]
}

Requirements:
- Include EXACTLY 2-3 cultural notes
- Each note must have all 5 fields: title, titleJa, content, contentJa, iconEmoji
- Focus on practical, interesting facts about {location} and Japanese culture
- Make it educational for language learners
- Use relevant emojis (🏯 🗾 🍱 ⛩️ 🎌 etc.)
```

## Quiz Prompt

```
Create a quiz for a Japanese learning comic.

Comic Content Summary:
{panelSummary}

Vocabulary from Comic:
{vocabList}

You MUST return a JSON object in EXACTLY this format:
{
  "questions": [
    {
      "type": "multiple-choice",
      "questionJa": "この<ruby>言葉<rt>ことば</rt></ruby>の<ruby>意味<rt>いみ</rt></ruby>は<ruby>何<rt>なに</rt></ruby>ですか？祭り",
      "questionEn": "What does this word mean?",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this answer is correct",
      "explanationJa": "なぜこの<ruby>答え<rt>こたえ</rt></ruby>が<ruby>正<rt>ただ</rt></ruby>しいかの<ruby>説明<rt>せつめい</rt></ruby>"
    }
  ],
  "passingScore": 70
}

CRITICAL RULES TO AVOID REVEALING ANSWERS:
1. **questionEn must NOT contain the answer, meaning, or translation of the word being tested**
   - WRONG: "What does this word mean? Festival" (reveals the answer!)
   - CORRECT: "What does this word mean?"

2. **For reading/pronunciation questions, do NOT add furigana to the target word**
   - WRONG: "<ruby>焼き鳥<rt>やきとり</rt></ruby>" when asking "What is the reading?"
   - CORRECT: "焼き鳥" (no furigana on the word being tested)

3. **The target word in questionJa should have NO furigana if asking about its reading**

Requirements:
- Create EXACTLY 4-5 questions
- Each question must have ALL 7 fields: type, questionJa, questionEn, options (array of 4), correctAnswer (0-3), explanation, explanationJa
- For questionJa and explanationJa, wrap kanji in <ruby> tags EXCEPT for the target word in reading questions
- Test vocabulary, reading comprehension, and cultural understanding
- Make questions appropriate for the JLPT level
- Options must be plausible but only one correct
```
