import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { AIService } from '@/lib/ai/AIService';
import { StoryGenerationRequest } from '@/lib/ai/types';

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
    // Check for admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    // Prepare AI request
    const aiRequest: StoryGenerationRequest = {
      theme: moodboard.title || moodboard.category || 'General',
      pageCount: targetLength === 'short' ? 3 : targetLength === 'long' ? 10 : 5,
      metadata: {
        moodboardId,
        moodboardTitle: moodboard.title || moodboard.category,
        moodboardKanji: kanjiList.map((k: any) => k.kanji || k.char),
        kanjiList,
        genre,
        includeDialogue
      }
    };

    // Call unified AI service
    const response = await aiService.process({
      task: 'generate_story',
      content: aiRequest,
      config: {
        jlptLevel: moodboard.jlptLevel || 'N5',
        targetLength,
        genre,
        includeDialogue,
        customPrompt: focusGrammar.length > 0
          ? `Try to incorporate these grammar points: ${focusGrammar.join(', ')}`
          : undefined
      },
      metadata: {
        source: 'admin-moodboard-story',
        userId: 'admin' // You might want to extract actual user ID from auth
      }
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to generate story');
    }

    const storyData = response.data;

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
      slug: storyData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      usage: response.usage, // Include token usage info
      cached: response.cached // Include cache hit info
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