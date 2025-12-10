import { NextRequest, NextResponse } from 'next/server'
import { JLPTLevel } from '@/types/ai-story'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'
import { AIService } from '@/lib/ai/AIService'
import { MultiStepStoryRequest } from '@/lib/ai/processors/MultiStepStoryProcessor'
import { GeminiImageProcessor } from '@/lib/ai/processors/GeminiImageProcessor'
import { ProcessorContext } from '@/lib/ai/types'
import { getStorage } from 'firebase-admin/storage'

// Initialize Firebase Admin
initAdmin()
const storage = getStorage()

// Initialize AI Service
const aiService = AIService.getInstance()

// Helper to create Gemini processor context
function createGeminiContext(userId: string): ProcessorContext {
  return {
    model: 'gemini-2.5-flash-image',
    config: {
      timeout: 60000,
      maxRetries: 2,
    },
    userId,
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Check for admin key authentication (for scheduled functions)
    const adminKey = request.headers.get('X-Admin-Key')
    const expectedAdminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025'

    let userId: string

    if (adminKey === expectedAdminKey) {
      // Authenticated via admin key (scheduled function)
      userId = 'scheduler-system'
    } else {
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

      userId = session.uid
    }

    const body = await request.json()
    const { step, theme, jlptLevel, pageCount, ...stepData } = body

    // Step 1: Generate Character Sheet
    if (step === 'character_sheet') {
      // Prepare request for AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'character_sheet',
        theme,
        jlptLevel,
        pageCount,
      }

      // Call unified AI service
      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: userId,
          step: 'character_sheet',
        },
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate character sheet')
      }

      // Save to Firestore for later steps
      const draftId = `draft_${Date.now()}_${userId}`
      await adminFirestore!.collection('ai_story_drafts').doc(draftId).set({
        characterSheet: response.data,
        theme,
        jlptLevel,
        pageCount,
        userId: userId,
        createdAt: new Date(),
        status: 'character_created',
      })

      return NextResponse.json({
        success: true,
        draftId,
        data: response.data,
        usage: response.usage,
        cached: response.cached,
      })
    }

    // Step 2: Generate Story Outline
    if (step === 'outline') {
      const { draftId } = stepData

      // Retrieve draft from Firestore
      const draftDoc = await adminFirestore!.collection('ai_story_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { characterSheet } = draft as any

      // Prepare request for AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'outline',
        theme,
        jlptLevel,
        pageCount,
        characterSheet,
        draftId,
      }

      // Call unified AI service
      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: userId,
          step: 'outline',
          draftId,
        },
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate outline')
      }

      // Update draft in Firestore
      await adminFirestore!.collection('ai_story_drafts').doc(draftId).update({
        outline: response.data,
        status: 'outline_created',
        updatedAt: new Date(),
      })

      return NextResponse.json({
        success: true,
        draftId,
        data: response.data,
        usage: response.usage,
        cached: response.cached,
      })
    }

    // Step 3: Generate Story Pages
    if (step === 'generate_page') {
      const { draftId, pageNumber } = stepData

      // Retrieve draft from Firestore
      const draftDoc = await adminFirestore!.collection('ai_story_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { characterSheet, outline } = draft as any

      // Prepare request for AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'generate_page',
        jlptLevel,
        pageNumber,
        characterSheet,
        outline,
        draftId,
      }

      // Call unified AI service
      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: userId,
          step: 'generate_page',
          draftId,
          pageNumber,
        },
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate page')
      }

      // Update draft with the new page
      const pages = draft?.pages || []
      pages[pageNumber - 1] = response.data

      await adminFirestore!
        .collection('ai_story_drafts')
        .doc(draftId)
        .update({
          pages,
          [`pageStatus.${pageNumber}`]: 'generated',
          updatedAt: new Date(),
        })

      return NextResponse.json({
        success: true,
        draftId,
        data: response.data,
        usage: response.usage,
        cached: response.cached,
      })
    }

    // Step 4: Generate Quiz
    if (step === 'generate_quiz') {
      const { draftId } = stepData

      // Retrieve draft from Firestore
      const draftDoc = await adminFirestore!.collection('ai_story_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { pages, outline } = draft as any

      // Prepare request for AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'generate_quiz',
        jlptLevel,
        pages,
        outline,
        draftId,
      }

      // Call unified AI service
      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: userId,
          step: 'generate_quiz',
          draftId,
        },
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate quiz')
      }

      // Update draft with quiz
      await adminFirestore!.collection('ai_story_drafts').doc(draftId).update({
        quiz: response.data,
        status: 'complete',
        updatedAt: new Date(),
      })

      return NextResponse.json({
        success: true,
        draftId,
        data: response.data,
        usage: response.usage,
        cached: response.cached,
      })
    }

    // Step 5: Generate Model Sheet (character reference for consistent images)
    if (step === 'generate_model_sheet') {
      const { draftId } = stepData

      // Retrieve draft from Firestore
      const draftDoc = await adminFirestore!.collection('ai_story_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { characterSheet } = draft as any

      if (!characterSheet) {
        return NextResponse.json({ error: 'Character sheet not found in draft' }, { status: 400 })
      }

      // Generate model sheet prompt using AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'generate_model_sheet',
        characterSheet,
        draftId,
      }

      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel: draft?.jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: userId,
          step: 'generate_model_sheet',
          draftId,
        },
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate model sheet prompt')
      }

      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        // Store prompt but skip image generation
        await adminFirestore!.collection('ai_story_drafts').doc(draftId).update({
          modelSheetPrompt: response.data.prompt,
          updatedAt: new Date(),
        })

        return NextResponse.json({
          success: true,
          draftId,
          data: { prompt: response.data.prompt, imageUrl: null },
          message:
            'Model sheet prompt generated, but GEMINI_API_KEY not configured for image generation',
        })
      }

      try {
        // Generate model sheet with Gemini (Nano Banana Pro for better quality)
        const geminiProcessor = new GeminiImageProcessor(createGeminiContext(userId))
        const modelSheetResult = await geminiProcessor.generateModelSheet({
          character: {
            name: characterSheet.mainCharacter?.name || 'Main Character',
            nameJa:
              characterSheet.mainCharacter?.nameJa ||
              characterSheet.mainCharacter?.name ||
              '主人公',
            description: characterSheet.mainCharacter?.description || '',
            visualDescription: characterSheet.mainCharacter?.visualDescription || '',
          },
          visualStyle:
            characterSheet.visualStyle || "anime/manga style, children's book illustration",
        })

        if (!modelSheetResult.data?.imageUrl) {
          throw new Error('No image data returned from Gemini')
        }

        // Extract base64 data and save to Firebase Storage
        const base64Match = modelSheetResult.data.imageUrl.match(/^data:image\/\w+;base64,(.+)$/)
        if (!base64Match) {
          throw new Error('Invalid image data format from Gemini')
        }
        const imgBuffer = Buffer.from(base64Match[1], 'base64')
        const fileName = `ai-stories/${draftId}/model-sheet.png`
        const file = storage.bucket().file(fileName)

        await file.save(imgBuffer, {
          metadata: {
            contentType: 'image/png',
            metadata: { generatedBy: 'gemini-nano-banana-pro', userId: userId },
          },
        })

        await file.makePublic()
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`

        // Update draft with model sheet (including reference image data for character consistency)
        await adminFirestore!
          .collection('ai_story_drafts')
          .doc(draftId)
          .update({
            modelSheet: {
              prompt: response.data.prompt,
              imageUrl: publicUrl,
              characterId: response.data.characterId,
              // Store base64 reference for character consistency in page images
              referenceImageData: base64Match[1],
            },
            updatedAt: new Date(),
          })

        return NextResponse.json({
          success: true,
          draftId,
          data: { prompt: response.data.prompt, imageUrl: publicUrl },
          provider: 'gemini',
        })
      } catch (imageError) {
        console.error('Model sheet image generation failed:', imageError)
        // Still return success with just the prompt
        return NextResponse.json({
          success: true,
          draftId,
          data: { prompt: response.data.prompt, imageUrl: null },
          warning: 'Image generation failed, prompt saved',
        })
      }
    }

    // Step 6: Generate Page Image
    if (step === 'generate_page_image') {
      const { draftId, pageNumber } = stepData

      // Retrieve draft from Firestore
      const draftDoc = await adminFirestore!.collection('ai_story_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { characterSheet, pages, modelSheet } = draft as any

      if (!pages || !pages[pageNumber - 1]) {
        return NextResponse.json(
          { error: `Page ${pageNumber} not found in draft` },
          { status: 400 }
        )
      }

      const page = pages[pageNumber - 1]

      // Generate image prompt using AI service
      const aiRequest: MultiStepStoryRequest = {
        step: 'generate_page_image',
        characterSheet,
        pageText: page.textJa || page.text,
        pageTranslation: page.textEn || page.translation,
        pageNumber,
        characterProfile: modelSheet,
        draftId,
      }

      const response = await aiService.process({
        task: 'generate_story_multistep',
        content: aiRequest,
        config: { jlptLevel: draft?.jlptLevel },
        metadata: {
          source: 'admin-story-generator',
          userId: userId,
          step: 'generate_page_image',
          draftId,
          pageNumber,
        },
      })

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate page image prompt')
      }

      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({
          success: true,
          draftId,
          data: { prompt: response.data.imagePrompt, imageUrl: null },
          message: 'Image prompt generated, but GEMINI_API_KEY not configured',
        })
      }

      try {
        const visualStyle =
          characterSheet?.visualStyle || "soft watercolor children's book illustration"
        const enhancedPrompt = `${response.data.imagePrompt}\n\nStyle: ${visualStyle}. Child-friendly, educational, no violence or inappropriate content.`

        // Create Gemini processor
        const geminiProcessor = new GeminiImageProcessor(createGeminiContext(userId))

        // Build character references for consistency (if model sheet exists)
        const characterRefs: Array<{ imageData: string; mimeType?: string; name?: string }> = []
        if (modelSheet?.referenceImageData) {
          characterRefs.push({
            imageData: modelSheet.referenceImageData,
            mimeType: 'image/png',
            name: characterSheet?.mainCharacter?.name || 'Main Character',
          })
        }

        // Generate image with character consistency
        let imageResult
        if (characterRefs.length > 0) {
          // Use character consistency for better results
          imageResult = await geminiProcessor.generateWithCharacterConsistency(
            enhancedPrompt,
            characterRefs,
            '1:1' // Square format for story pages
          )
        } else {
          // Fallback to standard generation
          imageResult = await geminiProcessor.process({
            prompt: enhancedPrompt,
            size: '1024x1024',
            quality: 'standard',
          })
        }

        if (!imageResult.data?.imageUrl) {
          throw new Error('No image data returned from Gemini')
        }

        // Extract base64 data and save to Firebase Storage
        const base64Match = imageResult.data.imageUrl.match(/^data:image\/\w+;base64,(.+)$/)
        if (!base64Match) {
          throw new Error('Invalid image data format from Gemini')
        }
        const imgBuffer = Buffer.from(base64Match[1], 'base64')
        const fileName = `ai-stories/${draftId}/page-${pageNumber}.png`
        const file = storage.bucket().file(fileName)

        await file.save(imgBuffer, {
          metadata: {
            contentType: 'image/png',
            metadata: {
              generatedBy:
                characterRefs.length > 0 ? 'gemini-nano-banana-pro' : 'gemini-nano-banana',
              pageNumber: pageNumber.toString(),
              userId: userId,
              characterConsistency: characterRefs.length > 0 ? 'enabled' : 'disabled',
            },
          },
        })

        await file.makePublic()
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`

        // Update page in draft with image URL using a transaction
        // IMPORTANT: Use transaction to prevent race conditions when multiple page images are generated concurrently
        // Firestore field paths like `pages.0.imageUrl` convert arrays to objects, so we must read-modify-write
        const draftRef = adminFirestore!.collection('ai_story_drafts').doc(draftId)
        await adminFirestore!.runTransaction(async (transaction) => {
          const draftSnapshot = await transaction.get(draftRef)
          if (!draftSnapshot.exists) {
            throw new Error('Draft not found during image update')
          }
          const currentPages = draftSnapshot.data()?.pages || []
          if (currentPages[pageNumber - 1]) {
            currentPages[pageNumber - 1] = {
              ...currentPages[pageNumber - 1],
              imageUrl: publicUrl,
            }
          }
          transaction.update(draftRef, {
            pages: currentPages,
            [`pageImages.${pageNumber}`]: publicUrl,
            updatedAt: new Date(),
          })
        })

        return NextResponse.json({
          success: true,
          draftId,
          data: { prompt: response.data.imagePrompt, imageUrl: publicUrl, pageNumber },
          provider: 'gemini',
          characterConsistency: characterRefs.length > 0,
        })
      } catch (imageError) {
        console.error(`Page ${pageNumber} image generation failed:`, imageError)
        return NextResponse.json({
          success: true,
          draftId,
          data: { prompt: response.data.imagePrompt, imageUrl: null, pageNumber },
          warning: 'Image generation failed',
        })
      }
    }

    // Step 7: Generate Audio (VOICEVOX - FREE, high-quality Japanese TTS)
    if (step === 'generate_audio') {
      const { draftId, voice = 'nemo' } = stepData

      // Retrieve draft from Firestore
      const draftDoc = await adminFirestore!.collection('ai_story_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { pages } = draft as any

      if (!pages || pages.length === 0) {
        return NextResponse.json({ error: 'No pages found in draft' }, { status: 400 })
      }

      // Check if VOICEVOX/Modal is configured
      if (!process.env.MODAL_API_KEY) {
        return NextResponse.json({
          success: true,
          draftId,
          data: { audioGenerated: false },
          message: 'Audio generation skipped - MODAL_API_KEY not configured',
        })
      }

      try {
        // Call the generate-story-audio endpoint
        const audioResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/generate-story-audio`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              storyId: draftId,
              pages: pages.map((p: any) => ({
                pageNumber: p.pageNumber,
                text: p.textJa || p.text,
              })),
              voice,
              generateFullAudio: true,
              generatePageAudio: true,
            }),
          }
        )

        const audioResult = await audioResponse.json()

        if (!audioResponse.ok) {
          throw new Error(audioResult.error || 'Audio generation failed')
        }

        // Update draft with audio info
        await adminFirestore!
          .collection('ai_story_drafts')
          .doc(draftId)
          .update({
            fullAudioUrl: audioResult.fullAudioUrl,
            audioGeneratedAt: new Date(),
            audioProvider: 'voicevox',
            audioVoice: voice,
            audioStatus: audioResult.errors?.length > 0 ? 'partial' : 'complete',
            updatedAt: new Date(),
          })

        return NextResponse.json({
          success: true,
          draftId,
          data: {
            fullAudioUrl: audioResult.fullAudioUrl,
            pageAudioCount: audioResult.pageAudioCount,
            provider: 'voicevox',
            voice: audioResult.voice,
          },
          errors: audioResult.errors,
        })
      } catch (audioError) {
        console.error('Audio generation failed:', audioError)
        return NextResponse.json({
          success: true,
          draftId,
          data: { audioGenerated: false },
          warning: `Audio generation failed: ${audioError instanceof Error ? audioError.message : 'Unknown error'}`,
        })
      }
    }

    return NextResponse.json(
      {
        error:
          'Invalid step parameter. Valid steps: character_sheet, outline, generate_page, generate_quiz, generate_model_sheet, generate_page_image, generate_audio',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Story generation error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate story content',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 }
    )
  }
}
