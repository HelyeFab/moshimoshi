import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { AIService } from '@/lib/ai/AIService';
import { StoryGenerationRequest } from '@/lib/ai/types';
import OpenAI from 'openai';
import { validateSession } from '@/lib/auth/session';
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin';

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

// Initialize AI Service
const aiService = AIService.getInstance();

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting story generation from moodboard');

    // Ensure Firebase Admin is initialized
    ensureAdminInitialized();

    // Validate session from cookie
    const session = await validateSession(request);
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Note: We're not checking for admin status here since regular users
    // should be able to generate stories from moodboards too
    // If you want to restrict this to admins only, uncomment the following:
    /*
    const userDoc = await adminFirestore!.collection('users').doc(session.payload.uid).get();
    const userData = userDoc?.data();
    if (!userData?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }
    */

    const body: GenerateStoryRequest = await request.json();
    const {
      moodboardId,
      targetLength = 'medium',
      includeDialogue = true,
      genre = 'slice-of-life',
      focusGrammar = []
    } = body;

    console.log('📝 Request params:', { moodboardId, targetLength, genre });

    if (!moodboardId) {
      console.error('❌ Moodboard ID is missing');
      return NextResponse.json({ error: 'Moodboard ID is required' }, { status: 400 });
    }

    // Fetch moodboard data
    const moodboardDoc = await getDoc(doc(db, 'moodBoards', moodboardId));
    if (!moodboardDoc.exists()) {
      console.error('❌ Moodboard not found:', moodboardId);
      return NextResponse.json({ error: 'Moodboard not found' }, { status: 404 });
    }

    const moodboard = moodboardDoc.data();
    const kanjiList = moodboard.kanjiList || moodboard.kanji || [];

    console.log('📚 Moodboard data:', {
      title: moodboard.title,
      kanjiCount: kanjiList.length,
      jlptLevel: moodboard.jlptLevel || moodboard.jlpt
    });

    // Initialize OpenAI client for direct generation
    const apiKey = process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OpenAI API key is missing');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey,
      timeout: 50000,
      maxRetries: 2
    });

    // Prepare kanji list with details
    const kanjiDetails = kanjiList.map((item: any) => ({
      kanji: item.kanji || item.char,
      meaning: item.meaning || item.meanings?.join(', ') || '',
      onyomi: item.onyomi || [],
      kunyomi: item.kunyomi || [],
      jlpt: item.jlptLevel || item.jlpt || 'N5'
    }));

    const jlptLevel = moodboard.jlptLevel || moodboard.jlpt || 'N5';
    const pageCount = targetLength === 'short' ? 3 : targetLength === 'long' ? 10 : 5;

    console.log('🎯 Generating story with:', {
      kanjiCount: kanjiDetails.length,
      pageCount,
      jlptLevel
    });

    // Generate story using direct OpenAI call (like doshi-sensei)
    const storyPrompt = `You are creating an educational Japanese story for learners.

MOODBOARD THEME: ${moodboard.title || moodboard.category || 'General'}
MOODBOARD DESCRIPTION: ${moodboard.description || 'Educational kanji practice'}

REQUIRED KANJI (MUST use ALL of these):
${kanjiDetails.map((k: any) => `${k.kanji} (${k.meaning})`).join('\n')}

Create a ${pageCount}-page story that:
1. Is appropriate for ${jlptLevel} level learners
2. Uses EVERY kanji from the list above at least once
3. Has 8-10 sentences per page
4. Has an engaging plot with a clear beginning, middle, and end
5. Teaches a positive moral or life lesson
${includeDialogue ? '6. Includes natural dialogue between characters' : ''}
${genre ? `7. Genre: ${genre}` : ''}

For each kanji from the mood board, wrap it in special markers: {{MOODKANJI}}kanji{{/MOODKANJI}}
Example: 今日は{{MOODKANJI}}家{{/MOODKANJI}}に帰ります。

IMPORTANT: Use proper furigana with <ruby> tags for ALL kanji.
Example: <ruby>{{MOODKANJI}}家{{/MOODKANJI}}<rt>いえ</rt></ruby>

Return JSON with this structure:
{
  "title": "Story title in Japanese with furigana",
  "titleEn": "Story title in English",
  "description": "Brief description in English",
  "pages": [
    {
      "japaneseText": "Japanese text with furigana ruby tags and {{MOODKANJI}} markers",
      "englishText": "English translation",
      "imagePrompt": "A brief scene description for context"
    }
  ],
  "quiz": [
    {
      "question": "Question in English",
      "questionJa": "Question in Japanese",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": 0,
      "explanation": "Explanation of the answer"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert Japanese language educator creating stories for learners. Always use proper furigana with <ruby> tags and ensure all required kanji are used."
        },
        {
          role: "user",
          content: storyPrompt
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const generatedStoryData = JSON.parse(completion.choices[0].message.content || '{}');

    console.log('✅ Story generated successfully:', generatedStoryData.title);

    // Process pages to handle moodboard kanji markers
    const processedPages = generatedStoryData.pages.map((page: any, index: number) => {
      // Remove the moodboard kanji markers for clean display
      let processedText = page.japaneseText;
      processedText = processedText.replace(/{{MOODKANJI}}/g, '');
      processedText = processedText.replace(/{{\/MOODKANJI}}/g, '');

      return {
        pageNumber: index + 1,
        imageUrl: '', // No images for now
        text: processedText,
        translation: page.englishText,
        imageAlt: page.imagePrompt || ''
      };
    });

    // Generate unique ID and slug
    const storyId = `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const slug = generatedStoryData.titleEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
      '-' + Date.now();

    // Create the story document
    const storyData = {
      id: storyId,
      title: generatedStoryData.titleEn,
      titleJa: generatedStoryData.title,
      description: generatedStoryData.description,
      theme: moodboard.title || moodboard.category || 'Mood Board Story',
      jlptLevel: jlptLevel,
      pages: processedPages,
      quiz: generatedStoryData.quiz || [],

      // Metadata
      authorId: 'ai-generator',
      status: 'published',

      // Stats
      viewCount: 0,
      completionCount: 0,

      // SEO
      slug: slug,
      tags: ['ai-generated', 'moodboard-story', ...(moodboard.tags || [])],
      coverImageUrl: '',
      seoDescription: `A story created from the "${moodboard.title || moodboard.category}" kanji mood board, featuring ${kanjiList.length} kanji.`,

      // Moodboard reference
      moodBoardId: moodboardId,
      moodBoardTitle: moodboard.title || moodboard.category,
      moodBoardKanji: kanjiDetails.map((k: any) => k.kanji),

      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date()
    };

    // Save to Firestore
    await setDoc(doc(db, 'stories', storyId), storyData);

    console.log('💾 Story saved to Firestore:', storyId);

    return NextResponse.json({
      success: true,
      storyId,
      story: storyData
    });
  } catch (error) {
    console.error('Error generating story:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate story' },
      { status: 500 }
    );
  }
}