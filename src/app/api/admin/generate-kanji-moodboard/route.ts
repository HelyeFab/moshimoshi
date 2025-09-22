import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai/AIService';
import { MoodboardGenerationRequest } from '@/lib/ai/types';

interface GenerateMoodboardRequest {
  theme: string;
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  kanjiCount?: number;
  tags?: string[];
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

    const body: GenerateMoodboardRequest = await request.json();
    const { theme, jlptLevel = 'N5', kanjiCount = 15, tags = [] } = body;

    if (!theme) {
      return NextResponse.json({ error: 'Theme is required' }, { status: 400 });
    }

    // Prepare AI request
    const aiRequest: MoodboardGenerationRequest = {
      theme,
      kanjiCount,
      tags,
      focusAreas: [] // You can add focus areas if needed
    };

    // Call unified AI service
    const response = await aiService.process({
      task: 'generate_moodboard',
      content: aiRequest,
      config: {
        jlptLevel
      },
      metadata: {
        source: 'admin-moodboard-generator',
        userId: 'admin' // Extract actual user ID from auth if needed
      }
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to generate moodboard');
    }

    const moodboardData = response.data;

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
        examples: item.examples || [],
        onyomi: item.onyomi || [],
        kunyomi: item.kunyomi || [],
        strokeCount: item.strokeCount,
        tags: item.tags || []
      })),
      usage: response.usage, // Include token usage info
      cached: response.cached // Include cache hit info
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