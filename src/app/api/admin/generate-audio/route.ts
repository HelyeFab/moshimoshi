import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAdminRole } from '@/lib/firebase/auth-admin';
import { getStorage } from 'firebase-admin/storage';
import { initAdmin } from '@/lib/firebase/admin';

// Initialize Firebase Admin
initAdmin();
const storage = getStorage();

export const runtime = 'nodejs';
export const maxDuration = 60;

// Initialize OpenAI client (singleton)
let openaiClient: OpenAI | null = null;
function getOpenAIClient() {
  if (!openaiClient && (process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY)) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return openaiClient;
}

// Voice options for Japanese TTS
const JAPANESE_VOICES = {
  'alloy': 'neutral, balanced',
  'echo': 'male, warm',
  'fable': 'British accent',
  'onyx': 'male, deep',
  'nova': 'female, friendly',
  'shimmer': 'female, soft'
};

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    const authResult = await checkAdminRole(authHeader);
    
    if (!authResult.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Check if OpenAI API key is configured
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.' 
      }, { status: 500 });
    }

    const body = await request.json();
    const { 
      text, 
      voice = 'nova', // Default to female friendly voice
      speed = 0.9, // Slightly slower for language learning
      storyId,
      pageNumber,
      language = 'ja' // Japanese by default
    } = body;

    if (!text) {
      return NextResponse.json({ 
        error: 'Text is required for audio generation' 
      }, { status: 400 });
    }

    // Clean text for TTS (remove HTML tags, ruby annotations, etc.)
    const cleanText = text
      .replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1') // Remove furigana
      .replace(/<[^>]+>/g, '') // Remove any other HTML tags
      .trim();

    if (!cleanText) {
      return NextResponse.json({ 
        error: 'No valid text to convert to speech' 
      }, { status: 400 });
    }

    try {
      // Generate audio with OpenAI TTS
      const mp3Response = await openai.audio.speech.create({
        model: 'tts-1', // or 'tts-1-hd' for higher quality
        voice: voice as any,
        input: cleanText,
        speed: speed,
      });

      // Convert response to buffer
      const buffer = Buffer.from(await mp3Response.arrayBuffer());

      // Upload to Firebase Storage
      const fileName = `ai-stories/${storyId || 'temp'}/audio/page-${pageNumber || Date.now()}.mp3`;
      const file = storage.bucket().file(fileName);
      
      await file.save(buffer, {
        metadata: {
          contentType: 'audio/mpeg',
          metadata: {
            originalText: text.substring(0, 500), // Store first 500 chars
            voice: voice,
            speed: speed.toString(),
            language: language,
            generatedBy: 'openai-tts',
            generatedAt: new Date().toISOString(),
            userId: authResult.userId,
          }
        }
      });

      // Make the file publicly accessible
      await file.makePublic();
      
      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;

      return NextResponse.json({
        success: true,
        audioUrl: publicUrl,
        storagePath: fileName,
        duration: Math.ceil(cleanText.length / 15), // Rough estimate in seconds
        textLength: cleanText.length,
        voice: voice,
      });

    } catch (openaiError: any) {
      console.error('OpenAI TTS error:', openaiError);
      throw openaiError;
    }

  } catch (error) {
    console.error('Audio generation error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate audio',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// Batch audio generation for entire story
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const authResult = await checkAdminRole(authHeader);
    
    if (!authResult.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured' 
      }, { status: 500 });
    }

    const body = await request.json();
    const { pages, storyId, voice = 'nova', speed = 0.9 } = body;

    if (!pages || !Array.isArray(pages)) {
      return NextResponse.json({ 
        error: 'Pages array is required' 
      }, { status: 400 });
    }

    const results = [];
    const errors = [];

    // Process each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageNumber = page.pageNumber || i + 1;
      
      try {
        // Clean text
        const cleanText = (page.text || '')
          .replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1')
          .replace(/<[^>]+>/g, '')
          .trim();

        if (!cleanText) {
          errors.push({ pageNumber, error: 'No valid text' });
          continue;
        }

        // Generate audio
        const mp3Response = await openai.audio.speech.create({
          model: 'tts-1',
          voice: voice as any,
          input: cleanText,
          speed: speed,
        });

        // Convert and save
        const buffer = Buffer.from(await mp3Response.arrayBuffer());
        const fileName = `ai-stories/${storyId}/audio/page-${pageNumber}.mp3`;
        const file = storage.bucket().file(fileName);
        
        await file.save(buffer, {
          metadata: {
            contentType: 'audio/mpeg',
            metadata: {
              pageNumber: pageNumber.toString(),
              voice: voice,
              speed: speed.toString(),
              generatedAt: new Date().toISOString(),
            }
          }
        });

        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;

        results.push({
          pageNumber,
          audioUrl: publicUrl,
          success: true
        });

      } catch (pageError: any) {
        console.error(`Error generating audio for page ${pageNumber}:`, pageError);
        errors.push({
          pageNumber,
          error: pageError.message
        });
      }

      // Add a small delay between requests to avoid rate limiting
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      summary: {
        total: pages.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('Batch audio generation error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate audio batch'
    }, { status: 500 });
  }
}

// GET endpoint to list available voices
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    voices: Object.entries(JAPANESE_VOICES).map(([id, description]) => ({
      id,
      description,
      recommended: id === 'nova' || id === 'echo'
    })),
    defaultVoice: 'nova',
    defaultSpeed: 0.9,
    speedRange: {
      min: 0.25,
      max: 4.0,
      recommended: 0.9
    }
  });
}