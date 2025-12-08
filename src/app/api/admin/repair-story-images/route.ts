/**
 * Repair Story Images API
 * Regenerates missing images for published stories using their existing characterSheet data.
 *
 * Flow:
 * 1. Load story from Firestore
 * 2. Validate characterSheet exists
 * 3. Check for existing model sheet (story.modelSheet or linked draft)
 * 4. If no model sheet, generate one from characterSheet
 * 5. For each page missing imageUrl, generate image with character consistency
 * 6. Update coverImageUrl if missing
 */

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
export const maxDuration = 300 // 5 minutes for multiple image generations

interface RepairRequest {
  storyId: string
  pageNumbers?: number[] // Optional: specific pages to repair, otherwise all missing
}

interface RepairResult {
  success: boolean
  storyId: string
  modelSheetGenerated: boolean
  pagesRepaired: number[]
  pagesFailed: number[]
  coverRepaired: boolean
  error?: string
}

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

export async function POST(request: NextRequest) {
  console.log('[RepairStoryImages] === POST Request Started ===')

  const result: RepairResult = {
    success: false,
    storyId: '',
    modelSheetGenerated: false,
    pagesRepaired: [],
    pagesFailed: [],
    coverRepaired: false,
  }

  try {
    console.log('[RepairStoryImages] Checking auth...')
    // Check for admin key (for integrity checker calls) or session auth
    const adminKey = request.headers.get('X-Admin-Key')
    let userId: string

    if (adminKey === process.env.INTEGRITY_CHECKER_ADMIN_KEY) {
      userId = 'integrity-checker-system'
      console.log('[RepairStoryImages] Auth: Admin key accepted')
    } else {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Check if user is admin
      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      const userData = userDoc?.data()
      if (!userData?.isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
      userId = session.uid
      console.log('[RepairStoryImages] Auth: Session user accepted')
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }
    console.log('[RepairStoryImages] Gemini API key: configured')

    const body: RepairRequest = await request.json()
    const { storyId, pageNumbers } = body

    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

    result.storyId = storyId
    console.log(`[RepairStoryImages] Starting repair for story: ${storyId}`)

    // 1. Load story from Firestore
    console.log('[RepairStoryImages] Loading story from Firestore...')
    const storyDoc = await adminFirestore!.collection('stories').doc(storyId).get()
    console.log('[RepairStoryImages] Story loaded, exists:', storyDoc.exists)
    if (!storyDoc.exists) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const story = storyDoc.data()!
    const { characterSheet, pages, modelSheet: existingModelSheet } = story

    // 2. Validate characterSheet exists
    if (!characterSheet) {
      result.error = 'Story has no characterSheet - cannot generate consistent images'
      console.warn(`[RepairStoryImages] ${result.error}`, { storyId })
      return NextResponse.json(result, { status: 400 })
    }

    if (!pages || pages.length === 0) {
      result.error = 'Story has no pages'
      return NextResponse.json(result, { status: 400 })
    }

    // 3. Check for existing model sheet
    let modelSheet = existingModelSheet

    // If no model sheet on story, check linked draft
    if (!modelSheet?.referenceImageData) {
      // Try to find draft with matching pattern
      const draftId = storyId.replace('story_', 'draft_')
      const draftDoc = await adminFirestore!.collection('ai_story_drafts').doc(draftId).get()

      if (draftDoc.exists) {
        const draft = draftDoc.data()
        if (draft?.modelSheet?.referenceImageData) {
          modelSheet = draft.modelSheet
          console.log(`[RepairStoryImages] Found model sheet in draft: ${draftId}`)
        }
      }
    }

    // 4. Generate model sheet if missing
    const geminiProcessor = new GeminiImageProcessor(createGeminiContext(userId))

    if (!modelSheet?.referenceImageData) {
      console.log(`[RepairStoryImages] Generating new model sheet for ${storyId}`)

      try {
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
          throw new Error('No model sheet data returned from Gemini')
        }

        // Extract base64 data and save to Firebase Storage
        console.log('[RepairStoryImages] Step 1: Extracting base64 from image URL')
        const base64Match = modelSheetResult.data.imageUrl.match(/^data:image\/\w+;base64,(.+)$/)
        if (!base64Match) {
          throw new Error('Invalid model sheet image format')
        }
        console.log('[RepairStoryImages] Step 2: Base64 extracted, length:', base64Match[1].length)

        const imgBuffer = Buffer.from(base64Match[1], 'base64')
        console.log('[RepairStoryImages] Step 3: Buffer created, size:', imgBuffer.length)

        const fileName = `ai-stories/${storyId}/model-sheet.png`
        const file = storage.bucket().file(fileName)
        console.log('[RepairStoryImages] Step 4: Saving to storage:', fileName)

        await file.save(imgBuffer, {
          metadata: {
            contentType: 'image/png',
            metadata: {
              generatedBy: 'gemini-nano-banana-pro',
              repairJob: 'true',
              userId,
            },
          },
        })
        console.log('[RepairStoryImages] Step 5: Saved to storage')

        await file.makePublic()
        console.log('[RepairStoryImages] Step 6: Made public')

        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`
        console.log('[RepairStoryImages] Step 7: Public URL:', publicUrl)

        modelSheet = {
          imageUrl: publicUrl,
          referenceImageData: base64Match[1],
        }
        console.log('[RepairStoryImages] Step 8: modelSheet object created')

        // Update story with model sheet
        console.log('[RepairStoryImages] Step 9: Updating Firestore...')
        await adminFirestore!
          .collection('stories')
          .doc(storyId)
          .update({
            modelSheet: {
              imageUrl: publicUrl,
              referenceImageData: base64Match[1],
            },
            updatedAt: new Date(),
          })
        console.log('[RepairStoryImages] Step 10: Firestore updated')

        result.modelSheetGenerated = true
        console.log(`[RepairStoryImages] Model sheet generated and saved for ${storyId}`)
      } catch (modelSheetError: any) {
        console.error(`[RepairStoryImages] Model sheet generation failed:`, modelSheetError)
        console.error(`[RepairStoryImages] Error name:`, modelSheetError?.name)
        console.error(`[RepairStoryImages] Error code:`, modelSheetError?.code)
        console.error(
          `[RepairStoryImages] Error stack:`,
          modelSheetError?.stack?.split('\n').slice(0, 5).join('\n')
        )
        result.error = `Model sheet generation failed: ${modelSheetError instanceof Error ? modelSheetError.message : 'Unknown error'}`
        return NextResponse.json(result, { status: 500 })
      }
    }

    // 5. Find pages that need image repair
    const pagesToRepair = pageNumbers
      ? pages.filter((p: any) => pageNumbers.includes(p.pageNumber) && !p.imageUrl)
      : pages.filter((p: any) => !p.imageUrl)

    console.log(
      `[RepairStoryImages] Pages to repair: ${pagesToRepair.map((p: any) => p.pageNumber).join(', ')}`
    )

    // Build character references for consistency
    const characterRefs: Array<{ imageData: string; mimeType?: string; name?: string }> = []
    if (modelSheet?.referenceImageData) {
      characterRefs.push({
        imageData: modelSheet.referenceImageData,
        mimeType: 'image/png',
        name: characterSheet?.mainCharacter?.name || 'Main Character',
      })
    }

    // 6. Generate images for each page
    const updatedPages = [...pages]
    const visualStyle =
      characterSheet?.visualStyle || "soft watercolor children's book illustration"

    for (const page of pagesToRepair) {
      const pageNumber = page.pageNumber
      console.log(`[RepairStoryImages] Generating image for page ${pageNumber}`)

      try {
        // Build prompt from page text and character info
        const pageText = page.text || page.textJa || ''
        const pageTranslation = page.translation || page.textEn || ''

        const prompt = buildPageImagePrompt(pageText, pageTranslation, characterSheet, visualStyle)

        // Generate image with character consistency
        let imageResult
        if (characterRefs.length > 0) {
          imageResult = await geminiProcessor.generateWithCharacterConsistency(
            prompt,
            characterRefs,
            '1:1' // Square format for story pages
          )
        } else {
          imageResult = await geminiProcessor.process({
            prompt,
            size: '1024x1024',
            quality: 'standard',
          })
        }

        if (!imageResult.data?.imageUrl) {
          throw new Error('No image data returned from Gemini')
        }

        // Extract base64 and upload to Storage
        const base64Match = imageResult.data.imageUrl.match(/^data:image\/\w+;base64,(.+)$/)
        if (!base64Match) {
          throw new Error('Invalid image format from Gemini')
        }

        const imgBuffer = Buffer.from(base64Match[1], 'base64')
        const fileName = `ai-stories/${storyId}/page-${pageNumber}.png`
        const file = storage.bucket().file(fileName)

        await file.save(imgBuffer, {
          metadata: {
            contentType: 'image/png',
            metadata: {
              generatedBy:
                characterRefs.length > 0 ? 'gemini-nano-banana-pro' : 'gemini-nano-banana',
              pageNumber: pageNumber.toString(),
              repairJob: 'true',
              userId,
            },
          },
        })

        await file.makePublic()
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`

        // Update page in array
        const pageIndex = updatedPages.findIndex((p: any) => p.pageNumber === pageNumber)
        if (pageIndex !== -1) {
          updatedPages[pageIndex] = {
            ...updatedPages[pageIndex],
            imageUrl: publicUrl,
          }
        }

        result.pagesRepaired.push(pageNumber)
        console.log(`[RepairStoryImages] Page ${pageNumber} image generated successfully`)
      } catch (pageError) {
        console.error(`[RepairStoryImages] Page ${pageNumber} image generation failed:`, pageError)
        result.pagesFailed.push(pageNumber)
      }
    }

    // 7. Update coverImageUrl if missing
    if (!story.coverImageUrl && result.pagesRepaired.length > 0) {
      // Use first page image as cover
      const firstPageImage = updatedPages.find((p: any) => p.imageUrl)?.imageUrl
      if (firstPageImage) {
        await adminFirestore!.collection('stories').doc(storyId).update({
          coverImageUrl: firstPageImage,
        })
        result.coverRepaired = true
      }
    }

    // 8. Save updated pages to Firestore
    if (result.pagesRepaired.length > 0) {
      await adminFirestore!.collection('stories').doc(storyId).update({
        pages: updatedPages,
        updatedAt: new Date(),
      })
    }

    result.success = result.pagesRepaired.length > 0 || result.modelSheetGenerated
    console.log(`[RepairStoryImages] Repair complete for ${storyId}:`, {
      modelSheetGenerated: result.modelSheetGenerated,
      pagesRepaired: result.pagesRepaired.length,
      pagesFailed: result.pagesFailed.length,
      coverRepaired: result.coverRepaired,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[RepairStoryImages] Error:', error)
    result.error = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(result, { status: 500 })
  }
}

/**
 * Build a prompt for page image generation from story data
 */
function buildPageImagePrompt(
  pageText: string,
  pageTranslation: string,
  characterSheet: any,
  visualStyle: string
): string {
  const mainChar = characterSheet?.mainCharacter
  const setting = characterSheet?.setting

  // Strip HTML/ruby tags from text for cleaner prompt
  const cleanText = pageText.replace(/<[^>]*>/g, '').substring(0, 200)
  const cleanTranslation = pageTranslation.substring(0, 200)

  let prompt = `Illustration for a Japanese children's story page.

Scene: ${cleanTranslation || cleanText}
`

  if (mainChar?.visualDescription) {
    prompt += `
Main Character: ${mainChar.name || 'Main character'} - ${mainChar.visualDescription}
`
  }

  if (setting?.atmosphere) {
    prompt += `
Setting: ${setting.atmosphere}
`
  }

  prompt += `
Style: ${visualStyle}. Child-friendly, educational content, no violence or inappropriate imagery.
Maintain consistent character appearance from reference images.`

  return prompt
}

// GET endpoint to check repair status or get story image info
export async function GET(request: NextRequest) {
  try {
    // Check for admin key (for integrity checker calls) or session auth
    const adminKey = request.headers.get('X-Admin-Key')

    if (adminKey === process.env.INTEGRITY_CHECKER_ADMIN_KEY) {
      // Admin key auth - proceed
    } else {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      const userData = userDoc?.data()
      if (!userData?.isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)
    const storyId = searchParams.get('storyId')

    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

    const storyDoc = await adminFirestore!.collection('stories').doc(storyId).get()
    if (!storyDoc.exists) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const story = storyDoc.data()!
    const pages = story.pages || []

    const analysis = {
      storyId,
      hasCharacterSheet: !!story.characterSheet,
      hasModelSheet: !!story.modelSheet?.referenceImageData,
      hasCoverImage: !!story.coverImageUrl,
      totalPages: pages.length,
      pagesWithImages: pages.filter((p: any) => p.imageUrl).length,
      pagesMissingImages: pages.filter((p: any) => !p.imageUrl).map((p: any) => p.pageNumber),
      canRepair: !!story.characterSheet,
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('[RepairStoryImages] GET Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
