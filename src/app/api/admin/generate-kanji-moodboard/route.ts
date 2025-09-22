import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface GenerateMoodboardRequest {
  theme: string;
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  kanjiCount?: number;
  tags?: string[];
}

// Configure for API route
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max execution time

export async function POST(request: NextRequest) {
  try {
    // Check for admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey,
      timeout: 50000, // 50 second timeout
      maxRetries: 2
    });

    const body: GenerateMoodboardRequest = await request.json();
    const { theme, jlptLevel = 'N5', kanjiCount = 15, tags = [] } = body;

    if (!theme) {
      return NextResponse.json({ error: 'Theme is required' }, { status: 400 });
    }

    // Generate kanji list using GPT-4
    const systemPrompt = `You are a Japanese language expert creating educational kanji mood boards. Generate a list of kanji related to the given theme.

Rules:
1. Include both common and less common kanji for the theme
2. For family members, include both formal and informal terms (e.g., 兄/お兄さん, 姉/お姉さん)
3. CRITICAL: You MUST include kanji from ${jlptLevel} level specifically, not just N5!
4. Each kanji should have accurate readings and meanings
5. Provide stroke count and relevant tags
6. Generate exactly ${kanjiCount} kanji entries
7. IMPORTANT: Each kanji character must be unique - no duplicates allowed
8. IMPORTANT: The majority of kanji should be from the ${jlptLevel} level

Return ONLY valid JSON in this exact format:
{
  "title": "Theme Name in English",
  "description": "Brief description of the theme",
  "themeColor": "#hexcolor",
  "emoji": "appropriate emoji",
  "kanjiList": [
    {
      "kanji": "漢",
      "meaning": "English meaning",
      "onyomi": ["カン"],
      "kunyomi": ["から"],
      "jlptLevel": "N5",
      "strokeCount": 13,
      "tags": ["tag1", "tag2"],
      "examples": [
        "漢字を書く。",
        "漢字は難しい。"
      ]
    }
  ]
}

IMPORTANT:
- onyomi must be an array of katakana readings
- kunyomi must be an array of hiragana readings
- examples must be an array of exactly 2 Japanese sentences`;

    const userPrompt = `Generate a kanji mood board for the theme: "${theme}"
${tags.length > 0 ? `Include these tags where relevant: ${tags.join(', ')}` : ''}
JLPT Level: ${jlptLevel}
Number of kanji: ${kanjiCount}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    const moodboardData = JSON.parse(result);

    // Transform to match our internal format
    const transformedData = {
      title: moodboardData.title,
      category: moodboardData.title,
      themeColor: moodboardData.themeColor,
      description: moodboardData.description,
      emoji: moodboardData.emoji,
      jlptLevel,
      kanjiList: moodboardData.kanjiList.map((item: any) => ({
        kanji: item.kanji,
        kana: item.kunyomi?.[0] || item.onyomi?.[0] || '',
        meaning: item.meaning,
        jlptLevel: item.jlptLevel,
        examples: item.examples.map((ex: string) => ({
          sentence: ex,
          translation: ''
        })),
        onyomi: item.onyomi || [],
        kunyomi: item.kunyomi || [],
        strokeCount: item.strokeCount,
        tags: item.tags || []
      }))
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error generating mood board:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate mood board' },
      { status: 500 }
    );
  }
}