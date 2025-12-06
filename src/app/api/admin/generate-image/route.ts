import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'
import { GeminiImageProcessor } from '@/lib/ai/processors/GeminiImageProcessor'
import { ProcessorContext } from '@/lib/ai/types'

// Initialize Firebase Admin
initAdmin()
const storage = getStorage()

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication using session (works with credentials: 'include')
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin from Firebase
    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
    const userData = userDoc?.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const userId = session.uid

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.',
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const {
      prompt,
      characterSheet,
      pageNumber,
      storyId,
      size = '1024x1024',
      quality = 'standard',
    } = body

    if (!prompt) {
      return NextResponse.json(
        {
          error: 'Image prompt is required',
        },
        { status: 400 }
      )
    }

    // Enhance prompt with character consistency and style guidelines
    let enhancedPrompt = prompt

    if (characterSheet) {
      const { mainCharacter, setting, visualStyle, colorPalette } = characterSheet

      enhancedPrompt = `${prompt}

Style: ${visualStyle || "soft watercolor children's book illustration"}
Main character: ${mainCharacter?.visualDescription || ''}
Setting: ${setting?.atmosphere || ''}
Color palette: ${colorPalette?.join(', ') || 'warm and inviting colors'}

Important: Maintain consistent character appearance and art style. Safe for all ages, educational context.`
    }

    // Add safety guidelines
    enhancedPrompt += '\n\nNo violence, no inappropriate content, child-friendly, educational.'

    try {
      // Create processor context
      const context: ProcessorContext = {
        model: 'gemini-2.5-flash-image',
        config: {
          timeout: 60000,
          maxRetries: 2,
        },
        userId,
      }

      // Generate image with Gemini (Nano Banana)
      const geminiProcessor = new GeminiImageProcessor(context)
      const result = await geminiProcessor.process({
        prompt: enhancedPrompt,
        size: size as '1024x1024' | '1792x1024' | '1024x1792',
        quality: quality as 'standard' | 'hd',
      })

      if (!result.data?.imageUrl) {
        throw new Error('No image data returned from Gemini')
      }

      // Extract base64 data from data URL
      const base64Match = result.data.imageUrl.match(/^data:image\/\w+;base64,(.+)$/)
      if (!base64Match) {
        throw new Error('Invalid image data format from Gemini')
      }
      const buffer = Buffer.from(base64Match[1], 'base64')

      // Upload to Firebase Storage
      const fileName = `ai-stories/${storyId || 'temp'}/page-${pageNumber || Date.now()}.png`
      const file = storage.bucket().file(fileName)

      await file.save(buffer, {
        metadata: {
          contentType: 'image/png',
          metadata: {
            originalPrompt: prompt,
            enhancedPrompt: enhancedPrompt,
            generatedBy: 'gemini-nano-banana',
            generatedAt: new Date().toISOString(),
            userId: userId,
          },
        },
      })

      // Make the file publicly accessible
      await file.makePublic()

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`

      return NextResponse.json({
        success: true,
        imageUrl: publicUrl,
        storagePath: fileName,
        revisedPrompt: result.data.revisedPrompt,
        provider: 'gemini',
      })
    } catch (geminiError: any) {
      console.error('Gemini image generation error:', geminiError)

      // Check for content policy violations
      if (geminiError?.code === 'CONTENT_POLICY_VIOLATION') {
        return NextResponse.json(
          {
            error: 'The image prompt was flagged by content policy. Please revise the prompt.',
            details: geminiError.message,
          },
          { status: 400 }
        )
      }

      throw geminiError
    }
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate image',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check status or retrieve existing images
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication using session
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin from Firebase
    const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
    const userData = userDoc?.data()
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const storyId = searchParams.get('storyId')

    if (!storyId) {
      return NextResponse.json(
        {
          error: 'Story ID is required',
        },
        { status: 400 }
      )
    }

    // List all images for a story
    const [files] = await storage.bucket().getFiles({
      prefix: `ai-stories/${storyId}/`,
    })

    const images = files
      .filter(file => file.name.endsWith('.png') || file.name.endsWith('.jpg'))
      .map(file => ({
        name: file.name,
        url: `https://storage.googleapis.com/${storage.bucket().name}/${file.name}`,
        metadata: file.metadata,
      }))

    return NextResponse.json({
      success: true,
      images,
      count: images.length,
    })
  } catch (error) {
    console.error('Error fetching images:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch images',
      },
      { status: 500 }
    )
  }
}
