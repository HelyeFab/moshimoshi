import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { doc, getDoc } from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';

interface GenerateStoryRequest {
  moodboardId: string;
  targetLength?: 'short' | 'medium' | 'long';
  includeDialogue?: boolean;
  genre?: 'slice-of-life' | 'adventure' | 'folk-tale' | 'modern' | 'historical';
  focusGrammar?: string[];
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

    const body: GenerateStoryRequest = await request.json();
    const {
      moodboardId,
      targetLength = 'medium',
      includeDialogue = true,
      genre = 'slice-of-life',
      focusGrammar = []
    } = body;

    if (!moodboardId) {
      return NextResponse.json({ error: 'Moodboard ID is required' }, { status: 400 });
    }

    // Fetch moodboard data
    const moodboardDoc = await getDoc(doc(db, 'moodboards', moodboardId));
    if (!moodboardDoc.exists()) {
      return NextResponse.json({ error: 'Moodboard not found' }, { status: 404 });
    }

    const moodboard = moodboardDoc.data();
    const kanjiList = moodboard.kanjiList || moodboard.kanji || [];

    // Prepare kanji string for prompt
    const kanjiString = kanjiList.map((k: any) => `${k.kanji || k.char}(${k.meaning})`).join(', ');

    // Determine target character count
    const characterCounts = {
      short: 500,
      medium: 1000,
      long: 2000
    };
    const targetChars = characterCounts[targetLength];

    const openai = new OpenAI({
      apiKey,
      timeout: 50000, // 50 second timeout
      maxRetries: 2
    });

    // Generate story using GPT-4
    const systemPrompt = `You are a Japanese language teacher creating educational stories for ${moodboard.jlptLevel || 'N5'} level students.

Generate a story that naturally incorporates the following kanji: ${kanjiString}

Requirements:
1. Story should be approximately ${targetChars} Japanese characters long
2. Genre: ${genre}
3. Include dialogue: ${includeDialogue ? 'Yes' : 'No'}
4. JLPT Level: ${moodboard.jlptLevel || 'N5'}
5. Use furigana for ALL kanji by wrapping them in ruby tags: <ruby>漢字<rt>かんじ</rt></ruby>
6. Each story page should be 100-200 characters
7. Include an English translation for each page
8. The story should be engaging and educational
${focusGrammar.length > 0 ? `9. Try to incorporate these grammar points: ${focusGrammar.join(', ')}` : ''}

Return ONLY valid JSON in this exact format:
{
  "title": "Story title in English",
  "titleJa": "Japanese title with furigana in ruby tags",
  "description": "Brief description in English",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Japanese text with <ruby>漢字<rt>かんじ</rt></ruby> tags for furigana",
      "translation": "English translation",
      "imageUrl": "",
      "imageAlt": "Description of scene for image generation"
    }
  ],
  "vocabulary": [
    {
      "word": "単語",
      "reading": "たんご",
      "meaning": "word",
      "partOfSpeech": "noun"
    }
  ],
  "quiz": [
    {
      "id": "q1",
      "question": "What did the main character do?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctIndex": 0,
      "explanation": "The correct answer is..."
    }
  ]
}

IMPORTANT:
- All kanji MUST have furigana using ruby tags
- Story should flow naturally and be interesting
- Vocabulary list should include key words from the story
- Quiz should test comprehension of the story`;

    const userPrompt = `Create a ${genre} story for ${moodboard.jlptLevel || 'N5'} level students.
Theme: "${moodboard.title || moodboard.category}"
Target length: ${targetChars} characters
Kanji to include: ${kanjiString}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    const storyData = JSON.parse(result);

    // Add metadata
    const enrichedStory = {
      ...storyData,
      jlptLevel: moodboard.jlptLevel || 'N5',
      theme: moodboard.title || moodboard.category,
      tags: ['ai-generated', 'moodboard-story', ...(moodboard.tags || [])],
      moodBoardId: moodboardId,
      moodBoardTitle: moodboard.title || moodboard.category,
      moodBoardKanji: kanjiList.map((k: any) => k.kanji || k.char),
      status: 'draft',
      authorId: 'ai-generator',
      createdAt: new Date(),
      updatedAt: new Date(),
      viewCount: 0,
      completionCount: 0,
      slug: storyData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    };

    return NextResponse.json(enrichedStory);
  } catch (error) {
    console.error('Error generating story:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate story' },
      { status: 500 }
    );
  }
}