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
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60000, // 60 seconds for image generation
      maxRetries: 2,
    });
  }
  return openaiClient;
}

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
    const { prompt, characterSheet, pageNumber, storyId, size = '1024x1024', quality = 'standard' } = body;

    if (!prompt) {
      return NextResponse.json({ 
        error: 'Image prompt is required' 
      }, { status: 400 });
    }

    // Enhance prompt with character consistency and style guidelines
    let enhancedPrompt = prompt;
    
    if (characterSheet) {
      const { mainCharacter, setting, visualStyle, colorPalette } = characterSheet;
      
      enhancedPrompt = `${prompt}

Style: ${visualStyle || 'soft watercolor children\'s book illustration'}
Main character: ${mainCharacter?.visualDescription || ''}
Setting: ${setting?.atmosphere || ''}
Color palette: ${colorPalette?.join(', ') || 'warm and inviting colors'}

Important: Maintain consistent character appearance and art style. Safe for all ages, educational context.`;
    }

    // Add safety guidelines
    enhancedPrompt += '\n\nNo violence, no inappropriate content, child-friendly, educational.';

    try {
      // Generate image with DALL-E 3
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: size as '1024x1024' | '1792x1024' | '1024x1792',
        quality: quality as 'standard' | 'hd',
        style: 'natural', // or 'vivid' for more hyper-real images
      });

      const imageUrl = response.data[0].url;
      
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      // Download the image
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(imageBuffer);

      // Upload to Firebase Storage
      const fileName = `ai-stories/${storyId || 'temp'}/page-${pageNumber || Date.now()}.png`;
      const file = storage.bucket().file(fileName);
      
      await file.save(buffer, {
        metadata: {
          contentType: 'image/png',
          metadata: {
            originalPrompt: prompt,
            enhancedPrompt: enhancedPrompt,
            generatedBy: 'dall-e-3',
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
        imageUrl: publicUrl,
        temporaryUrl: imageUrl, // OpenAI's temporary URL (expires after ~1 hour)
        storagePath: fileName,
        revisedPrompt: response.data[0].revised_prompt, // DALL-E 3 returns the revised prompt it actually used
      });

    } catch (openaiError: any) {
      console.error('OpenAI image generation error:', openaiError);
      
      // Check for specific OpenAI errors
      if (openaiError?.error?.code === 'content_policy_violation') {
        return NextResponse.json({ 
          error: 'The image prompt was flagged by content policy. Please revise the prompt.',
          details: openaiError.error.message
        }, { status: 400 });
      }
      
      throw openaiError;
    }

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate image',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}

// GET endpoint to check status or retrieve existing images
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const authResult = await checkAdminRole(authHeader);
    
    if (!authResult.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get('storyId');
    
    if (!storyId) {
      return NextResponse.json({ 
        error: 'Story ID is required' 
      }, { status: 400 });
    }

    // List all images for a story
    const [files] = await storage.bucket().getFiles({
      prefix: `ai-stories/${storyId}/`,
    });

    const images = files
      .filter(file => file.name.endsWith('.png') || file.name.endsWith('.jpg'))
      .map(file => ({
        name: file.name,
        url: `https://storage.googleapis.com/${storage.bucket().name}/${file.name}`,
        metadata: file.metadata,
      }));

    return NextResponse.json({
      success: true,
      images,
      count: images.length
    });

  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch images'
    }, { status: 500 });
  }
}