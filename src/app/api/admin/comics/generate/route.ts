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
    const expectedAdminKey = process.env.COMIC_SCHEDULER_ADMIN_KEY || 'comic-scheduler-2025'

    let userId: string

    if (adminKey === expectedAdminKey) {
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
      const { seriesId, theme, location, characterRef } = stepData

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

      // Generate outline using OpenAI
      const outlinePrompt = buildOutlinePrompt(theme, location)

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

      await adminFirestore!.collection('comic_drafts').doc(draftId).set({
        seriesId,
        episodeNumber,
        theme,
        location,
        outline,
        characterRef: characterRef || null,
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
      const { outline, theme, location } = draft as any

      // Generate dialogues for each panel
      const dialoguePrompt = buildDialoguePrompt(
        outline,
        theme,
        location
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
      const { draftId, panelNumber, characterRef } = stepData

      const draftDoc = await adminFirestore!.collection('comic_drafts').doc(draftId).get()
      if (!draftDoc.exists) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }

      const draft = draftDoc.data()
      const { panels, theme, location, outline } = draft as any

      const panel = panels?.[panelNumber - 1]
      if (!panel) {
        return NextResponse.json({ error: `Panel ${panelNumber} not found` }, { status: 400 })
      }

      // Build image prompt
      const imagePrompt = buildPanelImagePrompt(panel, theme, location, panelNumber)

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

        // Build character references for consistency
        const characterRefs: Array<{ imageData: string; mimeType?: string; name?: string }> = []
        if (characterRef?.referenceImageData) {
          characterRefs.push({
            imageData: characterRef.referenceImageData,
            mimeType: 'image/png',
            name: 'Moshi',
          })
        }

        // Generate image with character consistency
        let imageResult
        if (characterRefs.length > 0) {
          imageResult = await geminiProcessor.generateWithCharacterConsistency(
            imagePrompt,
            characterRefs,
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

        const imgBuffer = Buffer.from(base64Match[1], 'base64')
        const fileName = `comics/${draftId}/panel-${panelNumber}.png`
        const file = storage.bucket().file(fileName)

        await file.save(imgBuffer, {
          metadata: {
            contentType: 'image/png',
            metadata: { generatedBy: 'gemini', panelNumber: String(panelNumber) },
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

      return NextResponse.json({
        success: true,
        draftId,
        fullAudioUrl: result.fullAudioUrl,
        dialogueCount: result.dialogueCount,
        narrationCount: result.narrationCount,
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

function buildOutlinePrompt(theme: string, location: string): string {
  return `Create an outline for a Japanese learning comic episode.

Theme: ${theme}
Location: ${location}

The main character is Moshi, a friendly red panda visiting Japan for the first time.
This episode shows Moshi exploring ${location} and learning about ${theme}.

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
      "keyDialogue": "Main dialogue in this panel",
      "vocabularyFocus": ["word1", "word2"]
    }
  ]
}

Create 6 panels that tell a complete mini-story with a beginning, middle, and end.
Include useful everyday Japanese phrases appropriate for beginners.`
}

function buildDialoguePrompt(
  outline: any,
  theme: string,
  location: string
): string {
  return `Generate dialogues for a Japanese learning comic.

Outline: ${JSON.stringify(outline)}
Theme: ${theme}
Location: ${location}

The main character is Moshi, a friendly red panda. Moshi speaks in a cute, enthusiastic way.

Generate a JSON array of panels:
[
  {
    "panelNumber": 1,
    "sceneDescription": "Visual description of the scene",
    "dialogues": [
      {
        "characterId": "moshi",
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

Make dialogues natural, educational, and fun! Include common phrases learners would use in real situations.`
}

function buildPanelImagePrompt(
  panel: any,
  theme: string,
  location: string,
  panelNumber: number
): string {
  const sceneDesc = panel.sceneDescription || panel.description || `Scene ${panelNumber}`
  const emotion = panel.dialogues?.[0]?.emotion || 'happy'

  return `Kawaii manga-style comic panel illustration.

Scene: ${sceneDesc}
Location: ${location}, Japan
Theme: ${theme}

Main character: Moshi - a cute red panda with warm reddish-orange fur, cream-colored face markings, big expressive eyes, fluffy striped tail, wearing a small blue backpack. Expression: ${emotion}

Style: Soft pastel colors, clean lines, children's book illustration, Japanese manga influences, safe for children.

IMPORTANT: Do NOT include any text, letters, words, characters, writing, signs, labels, speech bubbles, or sound effects in the image. The image must be purely visual with no text of any kind - text will be added as an overlay separately. Keep the image completely text-free.

The scene should clearly show ${location} with authentic Japanese details and Moshi interacting with the environment.`
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
