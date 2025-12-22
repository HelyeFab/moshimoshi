/**
 * Comic Generation API
 *
 * Multi-step comic episode generation for "Moshi Goes to Japan" series.
 * Each step is called separately to allow progress tracking.
 *
 * Steps:
 * 1. outline - Generate episode outline and create draft
 * 2. dialogues - Generate panel dialogues
 * 3. panel_image - Generate image for a specific panel
 * 4. vocabulary - Extract vocabulary from dialogues
 * 5. cultural_notes - Generate cultural notes
 * 6. quiz - Generate quiz questions
 * 7. audio - Generate audio for dialogues
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, initAdmin } from '@/lib/firebase/admin'
import { GeminiImageProcessor } from '@/lib/ai/processors/GeminiImageProcessor'
import { ProcessorContext } from '@/lib/ai/types'
import { getStorage } from 'firebase-admin/storage'
import OpenAI from 'openai'
import sharp from 'sharp'
import { preGenerateComicSentences } from '@/lib/ai/utils/comicSentencePreGenerator'

// Initialize Firebase Admin
initAdmin()
const storage = getStorage()

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Generate JSON content using OpenAI
 */
async function generateJSON(prompt: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that generates JSON content for Japanese learning comics. Always return valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content returned from OpenAI')
  }

  return JSON.parse(content)
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

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Check for admin key authentication (for scheduled functions)
    const adminKey = request.headers.get('X-Admin-Key')
    // Use same fallback pattern as story scheduler for autonomous operation
    const expectedAdminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025'

    let userId: string

    if (adminKey) {
      // Admin key provided - validate it
      if (adminKey !== expectedAdminKey) {
        return NextResponse.json({ error: 'Invalid admin key' }, { status: 401 })
      }
      userId = 'comic-scheduler'
    } else {
      // Verify admin authentication
      const session = await getSession()

      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      const userData = userDoc?.data()
      if (!userData?.isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      userId = session.uid
    }

    const body = await request.json()
    const { step, ...stepData } = body

    // Step 1: Generate Outline
    if (step === 'outline') {
      const { seriesId, theme, location, characterIds, jlptLevel } = stepData
      let { characterSheet, characterRefs } = stepData

      // If characterIds provided but no characterSheet, load characters from Firestore
      if (characterIds?.length && !characterSheet) {
        try {
          const characters: Array<{
            id: string
            name: string
            nameJa: string
            role: string
            visualDescription: string
            personality: string
            speakingStyle: string
            imageUrl?: string
            base64Image?: string
          }> = []

          for (const charId of characterIds) {
            const charDoc = await adminFirestore!.collection('saved_characters').doc(charId).get()
            if (charDoc.exists) {
              const data = charDoc.data()!
              characters.push({
                id: charId,
                name: data.name || charId,
                nameJa: data.nameJa || '',
                role: data.role || 'supporting',
                visualDescription: data.visualDescription || '',
                personality: data.personality || '',
                speakingStyle: data.speakingStyle || '',
                imageUrl: data.imageUrl,
                base64Image: data.base64Image,
              })
            }
          }

          // Build characterSheet from loaded characters
          const mainChar = characters.find(c => c.role === 'protagonist') || characters[0]
          const supportingChars = characters.filter(c => c.id !== mainChar?.id)

          characterSheet = {
            mainCharacter: mainChar ? {
              id: mainChar.id,
              name: mainChar.name,
              nameJa: mainChar.nameJa,
              visualDescription: mainChar.visualDescription,
              personality: mainChar.personality,
              speakingStyle: mainChar.speakingStyle,
            } : null,
            supportingCharacters: supportingChars.map(c => ({
              id: c.id,
              name: c.name,
              nameJa: c.nameJa,
              role: c.role,
              visualDescription: c.visualDescription,
              personality: c.personality,
              speakingStyle: c.speakingStyle,
            })),
            allCharacters: characters.map(c => ({
              id: c.id,
              name: c.name,
              nameJa: c.nameJa,
              role: c.role,
            })),
          }

          // Build characterRefs for image generation
          // Fetch images from Storage URL if base64 not available
          const charRefsWithImages: Array<{
            id: string
            name: string
            base64Image?: string
            imageUrl?: string
          }> = []

          for (const c of characters.filter(ch => ch.base64Image || ch.imageUrl).slice(0, 3)) {
            let base64 = c.base64Image

            // If no base64 but has URL, fetch and convert
            if (!base64 && c.imageUrl) {
              try {
                console.log(`[Comics] Fetching image for ${c.name} from Storage...`)
                const response = await fetch(c.imageUrl)
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer()
                  base64 = Buffer.from(arrayBuffer).toString('base64')
                  console.log(`[Comics] Fetched and converted image for ${c.name}`)
                }
              } catch (fetchError) {
                console.error(`[Comics] Failed to fetch image for ${c.name}:`, fetchError)
              }
            }

            charRefsWithImages.push({
              id: c.id,
              name: c.name,
              base64Image: base64,
              imageUrl: c.imageUrl,
            })
          }

          characterRefs = charRefsWithImages

          console.log(`[Comics] Loaded ${characters.length} characters from characterIds`)
        } catch (charError) {
          console.error('[Comics] Failed to load characters:', charError)
        }
      }

      // Get next episode number (simple approach - count all episodes)
      let episodeNumber = 1
      try {
        const existingEpisodes = await adminFirestore!
          .collection('comics')
          .where('seriesId', '==', seriesId || 'moshi-goes-to-japan')
          .get()

        episodeNumber = existingEpisodes.size + 1
      } catch (indexError) {
        // Index may not exist yet - start with episode 1
        console.log('Index not ready, starting with episode 1')
        episodeNumber = 1
      }

      // Generate outline using OpenAI with character info
      const outlinePrompt = buildOutlinePrompt(theme, location, characterSheet)

      let outline
      try {
        outline = await generateJSON(outlinePrompt)
      } catch (error) {
        console.error('OpenAI outline generation failed:', error)
        outline = {
          title: `Moshi in ${location}`,
          titleJa: `もしの${location}`,
          synopsis: `Moshi explores ${location}`,
          panelBreakdown: generateDefaultPanels(theme, location, 6),
        }
      }

      // Create draft in Firestore
      const draftId = `comic_draft_${Date.now()}_${episodeNumber}`

      // Sanitize characterRefs for Firestore (remove base64, only store URLs)
      // base64 data is fetched on-demand during image generation
      const sanitizedCharacterRefs = (characterRefs || []).map((ref: any) => ({
        id: ref.id || '',
        name: ref.name || '',
        imageUrl: ref.imageUrl || null,
        // Don't store base64Image in Firestore - too large and causes errors
      }))

      await adminFirestore!.collection('comic_drafts').doc(draftId).set({
        seriesId: seriesId || 'moshi-goes-to-japan',
        episodeNumber,
        theme: theme || '',
        location: location || '',
        jlptLevel: jlptLevel || 'N5',
        characterIds: characterIds || [],
        outline,
        characterSheet: characterSheet || null,
        characterRefs: sanitizedCharacterRefs,
        panels: [],
        status: 'generating',
        currentStep: 'outline',
        progress: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
      })

      return NextResponse.json({
        success: true,
        draftId,
        outline,
        panelCount: outline.panelBreakdown?.length || 6,
      })
    }

    // Step 2: Generate Dialogues
    if (step === 'dialogues') {
      const { draftId } = stepData

      const draftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { outline, theme, location, characterSheet } = draft as any

      // Generate dialogues for each panel with character info
      const dialoguePrompt = buildDialoguePrompt(
        outline,
        theme,
        location,
        characterSheet
      )

      let panels
      try {
        const dialogueData = await generateJSON(dialoguePrompt)
        panels = Array.isArray(dialogueData) ? dialogueData : dialogueData.panels || generateDefaultPanelDialogues(outline, 6)
      } catch (error) {
        console.error('OpenAI dialogue generation failed:', error)
        panels = generateDefaultPanelDialogues(outline, 6)
      }

      // Update draft with dialogues
      await adminFirestore!.collection('comic_drafts').doc(draftId).update({
        panels,
        currentStep: 'dialogues',
        progress: 25,
        updatedAt: new Date(),
      })

      return NextResponse.json({
        success: true,
        draftId,
        panels,
      })
    }

    // Step 3: Generate Panel Image
    if (step === 'panel_image') {
      const { draftId, panelNumber, characterRefs: requestCharacterRefs } = stepData

      const draftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { panels, theme, location, outline, characterSheet, characterRefs: storedCharacterRefs } = draft as any

      const panel = panels?.[panelNumber - 1]
      if (!panel) {
        return NextResponse.json({ error: `Panel ${panelNumber} not found` }, { status: 400 })
      }

      // Use character refs from request or stored in draft
      const charRefs = requestCharacterRefs || storedCharacterRefs || []

      // Build image prompt with multi-character support
      const imagePrompt = buildPanelImagePrompt(panel, theme, location, panelNumber, characterSheet)

      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({
          success: true,
          draftId,
          data: { prompt: imagePrompt, imageUrl: null },
          message: 'GEMINI_API_KEY not configured',
        })
      }

      try {
        const geminiProcessor = new GeminiImageProcessor(createGeminiContext(userId))

        // Build character references for consistency (max 3 for Gemini)
        const geminiCharacterRefs: Array<{ imageData: string; mimeType?: string; name?: string }> = []

        // Get characters that appear in this panel (from panel.characters array or default to all)
        const panelCharacterIds = panel.characters || charRefs.map((c: any) => c.id)

        for (const charRef of charRefs) {
          // Only include characters that appear in this panel
          if (!panelCharacterIds.includes(charRef.id)) continue

          // Get base64 image data - either from stored data or fetch from URL
          let imageData = charRef.referenceImageData || charRef.base64Image

          // If no base64 but has URL, fetch and convert
          if (!imageData && charRef.imageUrl) {
            try {
              console.log(`[Comics] Fetching character image for ${charRef.name} from URL...`)
              const response = await fetch(charRef.imageUrl)
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer()
                imageData = Buffer.from(arrayBuffer).toString('base64')
              }
            } catch (fetchError) {
              console.error(`[Comics] Failed to fetch image for ${charRef.name}:`, fetchError)
            }
          }

          if (imageData) {
            geminiCharacterRefs.push({
              imageData,
              mimeType: 'image/png',
              name: charRef.name || charRef.id,
            })
          }

          // Gemini supports max 3 reference images
          if (geminiCharacterRefs.length >= 3) break
        }

        // Generate image with character consistency
        let imageResult
        if (geminiCharacterRefs.length > 0) {
          console.log(`[Comics] Panel ${panelNumber}: Using ${geminiCharacterRefs.length} character refs: ${geminiCharacterRefs.map(c => c.name).join(', ')}`)
          imageResult = await geminiProcessor.generateWithCharacterConsistency(
            imagePrompt,
            geminiCharacterRefs,
            '3:4' // Vertical panel aspect ratio
          )
        } else {
          imageResult = await geminiProcessor.process({
            prompt: imagePrompt,
            size: '1024x1024',
          })
        }

        if (!imageResult.data?.imageUrl) {
          throw new Error('No image data returned')
        }

        // Extract base64 and save to Firebase Storage
        const base64Match = imageResult.data.imageUrl.match(/^data:image\/\w+;base64,(.+)$/)
        if (!base64Match) {
          throw new Error('Invalid image data format')
        }

        const pngBuffer = Buffer.from(base64Match[1], 'base64')

        // Convert PNG to WebP for smaller file size (~60% reduction)
        const webpBuffer = await sharp(pngBuffer).webp({ quality: 85 }).toBuffer()

        const originalSizeKB = (pngBuffer.length / 1024).toFixed(1)
        const webpSizeKB = (webpBuffer.length / 1024).toFixed(1)
        console.log(
          `[Comics] Panel ${panelNumber} converted: ${originalSizeKB}KB PNG → ${webpSizeKB}KB WebP`
        )

        const fileName = `comics/${draftId}/panel-${panelNumber}.webp`
        const file = storage.bucket().file(fileName)

        await file.save(webpBuffer, {
          metadata: {
            contentType: 'image/webp',
            metadata: {
              generatedBy: 'gemini',
              panelNumber: String(panelNumber),
              originalFormat: 'png',
              originalSizeKB,
            },
          },
        })

        await file.makePublic()
        const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`

        // Update panel with image URL
        const updatedPanels = [...panels]
        updatedPanels[panelNumber - 1] = {
          ...panel,
          imageUrl: publicUrl,
          imagePrompt,
        }

        await adminFirestore!.collection('comic_drafts').doc(draftId).update({
          panels: updatedPanels,
          progress: 25 + (panelNumber / panels.length) * 40, // 25-65%
          updatedAt: new Date(),
        })

        return NextResponse.json({
          success: true,
          draftId,
          panelNumber,
          imageUrl: publicUrl,
        })
      } catch (imageError) {
        console.error('Panel image generation failed:', imageError)
        return NextResponse.json({
          success: false,
          error: imageError instanceof Error ? imageError.message : 'Image generation failed',
        })
      }
    }

    // Step 4: Extract Vocabulary
    if (step === 'vocabulary') {
      const { draftId } = stepData

      const draftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { panels } = draft as any

      // Extract all Japanese text from panels
      const allText = panels
        .map((p: any) => {
          const dialogueText = p.dialogues?.map((d: any) => d.textJa).join(' ') || ''
          const narrationText = p.narration?.textJa || ''
          return `${dialogueText} ${narrationText}`
        })
        .join('\n')

      const vocabPrompt = buildVocabularyPrompt(allText)

      let vocabulary: any[] = []
      try {
        const vocabData = await generateJSON(vocabPrompt)
        vocabulary = Array.isArray(vocabData) ? vocabData : vocabData.vocabulary || []
      } catch (error) {
        console.error('OpenAI vocabulary extraction failed:', error)
        vocabulary = []
      }

      await adminFirestore!.collection('comic_drafts').doc(draftId).update({
        vocabulary,
        currentStep: 'vocabulary',
        progress: 70,
        updatedAt: new Date(),
      })

      return NextResponse.json({
        success: true,
        draftId,
        vocabulary,
      })
    }

    // Step 5: Generate Cultural Notes
    if (step === 'cultural_notes') {
      const { draftId, location } = stepData

      const draftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { theme } = draft as any

      const culturePrompt = buildCulturalNotesPrompt(theme, location)

      let culturalNotes: any[] = []
      try {
        const cultureData = await generateJSON(culturePrompt)
        culturalNotes = Array.isArray(cultureData) ? cultureData : cultureData.notes || []
      } catch (error) {
        console.error('OpenAI cultural notes generation failed:', error)
        culturalNotes = []
      }

      await adminFirestore!.collection('comic_drafts').doc(draftId).update({
        culturalNotes,
        currentStep: 'cultural_notes',
        progress: 80,
        updatedAt: new Date(),
      })

      return NextResponse.json({
        success: true,
        draftId,
        culturalNotes,
      })
    }

    // Step 6: Generate Quiz
    if (step === 'quiz') {
      const { draftId } = stepData

      const draftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { panels, vocabulary, outline } = draft as any

      const quizPrompt = buildQuizPrompt(panels, vocabulary, outline)

      let quiz = { questions: [] as any[], passingScore: 70 }
      try {
        quiz = await generateJSON(quizPrompt)
      } catch (error) {
        console.error('OpenAI quiz generation failed:', error)
        quiz = { questions: [], passingScore: 70 }
      }

      await adminFirestore!.collection('comic_drafts').doc(draftId).update({
        quiz,
        currentStep: 'quiz',
        progress: 90,
        updatedAt: new Date(),
      })

      return NextResponse.json({
        success: true,
        draftId,
        quiz,
      })
    }

    // Step 7: Pre-generate audio (using sentence pre-generator pattern)
    if (step === 'audio') {
      const { draftId } = stepData

      const draftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { panels, outline, seriesId, episodeNumber } = draft as any

      // Get Modal API key for VOICEVOX
      const modalApiKey = process.env.MODAL_API_KEY
      if (!modalApiKey) {
        return NextResponse.json({
          success: false,
          error: 'MODAL_API_KEY not configured',
        })
      }

      // Generate episode ID for sentence data storage
      const episodeId = `${seriesId}-ep${String(episodeNumber).padStart(3, '0')}`

      // Prepare panels data for pre-generator
      const panelsForPregen = panels.map((panel: any, index: number) => ({
        panelNumber: index + 1,
        dialogues: panel.dialogues?.map((d: any) => ({
          characterId: d.characterId || 'moshi',
          characterName: d.characterName || 'Moshi',
          textJa: d.textJa || '',
          textEn: d.textEn || '',
          emotion: d.emotion,
        })),
        narration: panel.narration ? {
          textJa: panel.narration.textJa || '',
          textEn: panel.narration.textEn || '',
        } : undefined,
      }))

      // Pre-generate all audio using the sentence pre-generator
      const result = await preGenerateComicSentences(
        episodeId,
        panelsForPregen,
        outline?.title || `Episode ${episodeNumber}`,
        outline?.titleJa || `第${episodeNumber}話`,
        modalApiKey
      )

      // Update panels with audio URLs from pre-generator result
      // The pre-generator stores everything in comic_sentence_data collection
      // We also need to update the draft panels with the audio URLs
      const sentenceDataDoc = await adminFirestore!.collection('comic_sentence_data').doc(episodeId).get()
      const sentenceData = sentenceDataDoc.data()

      if (sentenceData) {
        const updatedPanels = panels.map((panel: any, pIndex: number) => {
          const panelNumber = pIndex + 1

          // Update dialogue audio URLs
          const updatedDialogues = panel.dialogues?.map((dialogue: any, dIndex: number) => {
            const sentenceDialogue = sentenceData.dialogues?.find(
              (d: any) => d.panelNumber === panelNumber && d.dialogueIndex === dIndex
            )
            return {
              ...dialogue,
              audioUrl: sentenceDialogue?.audioUrl || dialogue.audioUrl || '',
            }
          })

          // Update narration audio URL
          const sentenceNarration = sentenceData.narrations?.find(
            (n: any) => n.panelNumber === panelNumber
          )
          const updatedNarration = panel.narration ? {
            ...panel.narration,
            audioUrl: sentenceNarration?.audioUrl || panel.narration.audioUrl || '',
          } : null

          return {
            ...panel,
            dialogues: updatedDialogues,
            narration: updatedNarration,
          }
        })

        await adminFirestore!.collection('comic_drafts').doc(draftId).update({
          panels: updatedPanels,
          fullAudioUrl: result.fullAudioUrl,
          audioStatus: result.fullAudioUrl ? 'complete' : 'partial',
          audioProvider: 'voicevox',
          currentStep: 'audio',
          progress: 95,
          updatedAt: new Date(),
        })
      }

      // Only return success:true if we actually generated the full audio
      // This ensures the comic scheduler can detect failures and retry
      const success = !!result.fullAudioUrl

      return NextResponse.json({
        success,
        draftId,
        fullAudioUrl: result.fullAudioUrl,
        dialogueCount: result.dialogueCount,
        narrationCount: result.narrationCount,
        ...(success ? {} : { error: 'Audio generation failed - no full audio URL generated' }),
      })
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
  } catch (error) {
    console.error('Comic generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}

// ============ Prompt Builders ============

function buildOutlinePrompt(theme: string, location: string, characterSheet?: any): string {
  // Build character description from sheet or use default
  let characterDesc = 'The main character is Moshi, a friendly red panda visiting Japan for the first time.'

  if (characterSheet?.mainCharacter || characterSheet?.supportingCharacters?.length > 0) {
    const main = characterSheet.mainCharacter
    const supporting = characterSheet.supportingCharacters || []

    characterDesc = `Main Character: ${main?.name || 'Moshi'} (${main?.nameJa || 'もし'}) - ${main?.visualDescription || 'a friendly red panda'}.
Personality: ${main?.personality || 'curious and enthusiastic'}.
Speaking style: ${main?.speakingStyle || 'casual and friendly'}.`

    if (supporting.length > 0) {
      characterDesc += '\n\nSupporting Characters in this episode:'
      for (const char of supporting) {
        characterDesc += `\n- ${char.name} (${char.nameJa}) - ${char.role}: ${char.visualDescription}
  Personality: ${char.personality}
  Speaking style: ${char.speakingStyle || 'varies by character'}`
      }
    }
  }

  return `Create an outline for a Japanese learning comic episode with multiple characters.

Theme: ${theme}
Location: ${location}

${characterDesc}

This episode shows the characters exploring ${location} and learning about ${theme}.

Generate a JSON outline with:
{
  "title": "English title",
  "titleJa": "Japanese title",
  "synopsis": "Brief synopsis in English",
  "synopsisJa": "Brief synopsis in Japanese",
  "learningObjectives": ["objective 1", "objective 2", "objective 3"],
  "panelBreakdown": [
    {
      "panelNumber": 1,
      "description": "Scene description",
      "characters": ["character-id-1", "character-id-2"],
      "keyDialogue": "Main dialogue in this panel",
      "vocabularyFocus": ["word1", "word2"]
    }
  ]
}

Create 6 panels that tell a complete mini-story with a beginning, middle, and end.
Include useful everyday Japanese phrases appropriate for beginners.
Make sure the characters interact naturally based on their personalities.
Each panel should specify which characters appear in the "characters" array.`
}

function buildDialoguePrompt(
  outline: any,
  theme: string,
  location: string,
  characterSheet?: any
): string {
  // Build character info for dialogue generation
  let characterDesc = 'The main character is Moshi (もし), a friendly red panda. Moshi speaks in a cute, enthusiastic way.'

  if (characterSheet?.mainCharacter || characterSheet?.allCharacters?.length > 0) {
    const allChars = characterSheet.allCharacters || []
    const main = characterSheet.mainCharacter

    characterDesc = `Characters in this episode:\n`

    if (main) {
      characterDesc += `\n1. ${main.name} (${main.nameJa}) [ID: ${main.id || 'moshi-master'}] - Main protagonist
   Speaking style: ${main.speakingStyle || 'casual and friendly'}
   Personality: ${main.personality || 'curious and enthusiastic'}`
    }

    const supporting = characterSheet.supportingCharacters || []
    for (let i = 0; i < supporting.length; i++) {
      const char = supporting[i]
      characterDesc += `\n\n${i + 2}. ${char.name} (${char.nameJa}) [ID: ${char.id}] - ${char.role}
   Speaking style: ${char.speakingStyle || 'varies'}
   Personality: ${char.personality}`
    }
  }

  return `Generate dialogues for a Japanese learning comic with multiple characters.

Outline: ${JSON.stringify(outline)}
Theme: ${theme}
Location: ${location}

${characterDesc}

Generate a JSON array of panels:
[
  {
    "panelNumber": 1,
    "sceneDescription": "Visual description of the scene",
    "characters": ["character-id-1", "character-id-2"],
    "dialogues": [
      {
        "characterId": "moshi-master",
        "characterName": "Moshi",
        "textJa": "Japanese text (use beginner-friendly grammar/vocab)",
        "textEn": "English translation",
        "furigana": "Japanese with furigana markup like 日本(にほん)",
        "bubbleStyle": "speech|thought|shout|whisper",
        "emotion": "happy|surprised|confused|excited|neutral"
      }
    ],
    "narration": {
      "textJa": "Optional narration in Japanese",
      "textEn": "Optional narration in English"
    },
    "soundEffects": [
      {
        "textJa": "ドキドキ",
        "meaning": "heart pounding"
      }
    ]
  }
]

IMPORTANT:
- Use the correct characterId for each character (e.g., "moshi-master", "sensei-panda", "yuki-sloth", "koa-koala")
- Make each character speak according to their personality and speaking style
- Have natural interactions between characters
- Include the "characters" array listing which characters appear in each panel
- Make dialogues educational and fun! Include common phrases learners would use in real situations.`
}

function buildPanelImagePrompt(
  panel: any,
  theme: string,
  location: string,
  panelNumber: number,
  characterSheet?: any
): string {
  const sceneDesc = panel.sceneDescription || panel.description || `Scene ${panelNumber}`
  const emotion = panel.dialogues?.[0]?.emotion || 'happy'

  // Build character descriptions for image generation
  let characterDescs = ''

  if (characterSheet?.mainCharacter || characterSheet?.supportingCharacters?.length > 0) {
    const main = characterSheet.mainCharacter
    const supporting = characterSheet.supportingCharacters || []
    const panelChars = panel.characters || []

    // Get which characters appear in this panel
    const mainInPanel = panelChars.length === 0 || panelChars.includes(main?.id || 'moshi-master')
    const supportingInPanel = supporting.filter((s: any) => panelChars.includes(s.id))

    if (mainInPanel && main) {
      const mainEmotion = panel.dialogues?.find((d: any) => d.characterId === main.id || d.characterId === 'moshi-master')?.emotion || emotion
      characterDescs += `\nMain character: ${main.name} (${main.nameJa}) - ${main.visualDescription}. Expression: ${mainEmotion}`
    }

    for (const char of supportingInPanel) {
      const charEmotion = panel.dialogues?.find((d: any) => d.characterId === char.id)?.emotion || 'neutral'
      characterDescs += `\nSupporting character: ${char.name} (${char.nameJa}) - ${char.visualDescription}. Expression: ${charEmotion}`
    }
  }

  // Default to Moshi if no character sheet
  if (!characterDescs) {
    characterDescs = `\nMain character: Moshi - a cute red panda with warm reddish-orange fur, cream-colored face markings, big expressive eyes, fluffy striped tail, wearing a small blue backpack. Expression: ${emotion}`
  }

  return `Kawaii manga-style comic panel illustration.

Scene: ${sceneDesc}
Location: ${location}, Japan
Theme: ${theme}

Characters in this panel:${characterDescs}

Style: Soft pastel colors, clean lines, children's book illustration, Japanese manga influences, safe for children.

IMPORTANT: Do NOT include any text, letters, words, characters, writing, signs, labels, speech bubbles, or sound effects in the image. The image must be purely visual with no text of any kind - text will be added as an overlay separately. Keep the image completely text-free.

The scene should clearly show ${location} with authentic Japanese details. Show the characters interacting naturally with each other and the environment.`
}

function buildVocabularyPrompt(text: string): string {
  return `Extract vocabulary from this Japanese text for beginner learners:

${text}

Return a JSON array of vocabulary items:
[
  {
    "word": "kanji/kana word",
    "reading": "hiragana reading",
    "meaning": "English meaning",
    "partOfSpeech": "noun/verb/adjective/etc",
    "exampleFromComic": "sentence from the comic using this word"
  }
]

Focus on the most useful and relevant vocabulary for beginner learners.
Include 8-12 vocabulary items.`
}

function buildCulturalNotesPrompt(theme: string, location: string): string {
  return `Create cultural notes for a Japanese learning comic about ${theme} at ${location}.

Return a JSON array:
[
  {
    "title": "Cultural topic title",
    "titleJa": "Japanese title",
    "content": "2-3 sentences explaining this cultural aspect",
    "contentJa": "Japanese explanation",
    "iconEmoji": "relevant emoji like 🏯 or 🍱"
  }
]

Include 2-3 cultural notes that would help language learners understand Japanese culture better.
Focus on practical, interesting facts that relate to the comic's theme.`
}

function buildQuizPrompt(
  panels: any[],
  vocabulary: any[],
  outline: any
): string {
  return `Create a quiz for a Japanese learning comic.

Panels: ${JSON.stringify(panels.slice(0, 3))}
Vocabulary: ${JSON.stringify(vocabulary?.slice(0, 5) || [])}
Outline: ${JSON.stringify(outline)}

Return JSON:
{
  "questions": [
    {
      "type": "multiple-choice",
      "questionJa": "Question in Japanese",
      "questionEn": "Question in English",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": 0,
      "explanation": "Why this answer is correct",
      "explanationJa": "Japanese explanation"
    }
  ],
  "passingScore": 70
}

Create 4-5 questions testing:
- Vocabulary from the comic
- Reading comprehension
- Cultural understanding
- Basic grammar points`
}

// ============ Default Generators ============

function generateDefaultPanels(theme: string, location: string, count: number) {
  const panels = []
  for (let i = 1; i <= count; i++) {
    panels.push({
      panelNumber: i,
      description: `Panel ${i} of Moshi at ${location}`,
      keyDialogue: `Dialogue for panel ${i}`,
      vocabularyFocus: [],
    })
  }
  return panels
}

function generateDefaultPanelDialogues(outline: any, count: number) {
  const panels = []
  for (let i = 1; i <= count; i++) {
    panels.push({
      panelNumber: i,
      sceneDescription: outline?.panelBreakdown?.[i - 1]?.description || `Scene ${i}`,
      dialogues: [
        {
          characterId: 'moshi',
          characterName: 'Moshi',
          textJa: 'すごい！',
          textEn: 'Amazing!',
          bubbleStyle: 'speech',
          emotion: 'excited',
        },
      ],
    })
  }
  return panels
}
