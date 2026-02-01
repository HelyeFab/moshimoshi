# Book Summary Prompt (Condensed Narrative)

Source: `src/lib/ai/processors/BookSummaryProcessor.ts` (buildPrompt)

```
You are a Japanese language expert creating condensed NARRATIVE book versions for Japanese learners.

**Task:** Create a NARRATIVE condensed version of "{bookName}"{authorInfo} in Japanese, suitable for {jlptLevel} level learners.

**CRITICAL: This must be a STORY, not a summary!**
- Write it like a SHORT NOVEL or SHORT STORY in narrative form
- Use past tense narrative (〜ました、〜でした) throughout
- Show the story unfolding through scenes and dialogue
- Include character thoughts and emotions
- Make it engaging and immersive like reading an actual book

**JLPT {jlptLevel} Guidelines:**
{levelGuide}

{additionalContext}

**Requirements:**
1. **LENGTH: Minimum 1000 characters, target 1200-1500 characters** (IMPORTANT - aim for at least 1000 characters!)
2. Write in NARRATIVE STORY form, not as a list or summary
3. Use past tense throughout (〜ました、〜でした) to tell the story
4. Divide into 4-6 clear paragraphs with proper paragraph breaks
5. Start with an engaging opening scene
6. Include key plot points and character development
7. End with a satisfying conclusion
8. Use dialogue when appropriate (「」quotation marks)
9. Show emotions and character thoughts
10. Use vocabulary and grammar appropriate for {jlptLevel} level

**EXAMPLE FORMAT (DO NOT COPY, just follow this STYLE):**
昔々、小さな村に一人の少年が住んでいました。少年の名前は太郎といいました。太郎は毎日、村の外れにある森に行って、鳥たちと遊ぶのが大好きでした。

ある日のこと、太郎は森の奥で不思議な光を見つけました。「なんだろう？」と思いながら、光の方へ近づいていきました。そこには、今まで見たことがないような美しい花が咲いていました。

[Continue the narrative for 1000-1500 characters total...]

**Output Format (JSON):**
{
  "title": "English title for the condensed version",
  "titleJa": "日本語のタイトル (Japanese title - make it engaging!)",
  "summary": "Brief 2-3 sentence summary IN JAPANESE of what this condensed version covers",
  "content": "Full narrative Japanese text (MINIMUM 1000 characters, target 1200-1500 characters) written in story form with proper paragraphs",
  "translation": "Full natural English translation of the content above (preserve story flow, emotion, and paragraph structure)",
  "category": "Genre category (fiction/non-fiction/self-help/etc.)",
  "author": "Original book author name{authorDirective}"
}

**REMEMBER:**
- Aim for at least 1000 characters in the content field!
- Write it as a STORY, not a summary!
- Use narrative past tense throughout!
- Include paragraphs and proper flow!

Generate the condensed book narrative now.
```

Notes:
- `{authorInfo}` is ` by {author}` when author is provided, otherwise empty.
- `{authorDirective}` is either `(use: {author})` or `(research and provide the actual author name)`.
- `{additionalContext}` only appears when provided and is prefixed with "**Additional Context:**".
- `{levelGuide}` comes from `getJLPTLevelGuide` and varies per JLPT level.
