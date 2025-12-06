import { NextRequest, NextResponse } from 'next/server'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { firestore as db } from '@/lib/firebase/client'
import { AIService } from '@/lib/ai/AIService'
import { MultiStepStoryRequest } from '@/lib/ai/processors/MultiStepStoryProcessor'
import { validateSession } from '@/lib/auth/session'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'

interface GenerateStoryRequest {
  moodboardId: string
  targetLength?: 'short' | 'medium' | 'long'
  includeDialogue?: boolean
  genre?: 'slice-of-life' | 'adventure' | 'folk-tale' | 'modern' | 'historical'
  focusGrammar?: string[]
}

// Configure for API route
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds max execution time

// Initialize AI Service
const aiService = AIService.getInstance()

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting story generation from moodboard')

    // Ensure Firebase Admin is initialized
    ensureAdminInitialized()

    // Validate session from cookie
    const session = await validateSession(request)
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.payload.uid

    const body: GenerateStoryRequest = await request.json()
    const {
      moodboardId,
      targetLength = 'medium',
      includeDialogue = true,
      genre = 'slice-of-life',
      focusGrammar = [],
    } = body

    console.log('📝 Request params:', { moodboardId, targetLength, genre })

    if (!moodboardId) {
      console.error('❌ Moodboard ID is missing')
      return NextResponse.json({ error: 'Moodboard ID is required' }, { status: 400 })
    }

    // Fetch moodboard data
    const moodboardDoc = await getDoc(doc(db, 'moodBoards', moodboardId))
    if (!moodboardDoc.exists()) {
      console.error('❌ Moodboard not found:', moodboardId)
      return NextResponse.json({ error: 'Moodboard not found' }, { status: 404 })
    }

    const moodboard = moodboardDoc.data()
    const kanjiList = moodboard.kanjiList || moodboard.kanji || []

    console.log('📚 Moodboard data:', {
      title: moodboard.title,
      kanjiCount: kanjiList.length,
      jlptLevel: moodboard.jlptLevel || moodboard.jlpt,
    })

    // Prepare kanji list with details
    const kanjiDetails = kanjiList.map((item: any) => ({
      kanji: item.kanji || item.char,
      meaning: item.meaning || item.meanings?.join(', ') || '',
      onyomi: item.onyomi || [],
      kunyomi: item.kunyomi || [],
      jlpt: item.jlptLevel || item.jlpt || 'N5',
    }))

    const jlptLevel = moodboard.jlptLevel || moodboard.jlpt || 'N5'
    const pageCount = targetLength === 'short' ? 3 : targetLength === 'long' ? 10 : 5

    console.log('🎯 Generating story with:', {
      kanjiCount: kanjiDetails.length,
      pageCount,
      jlptLevel,
    })

    // Build theme from moodboard with kanji requirements
    const theme = `${moodboard.title || moodboard.category || 'General'} - MUST use these kanji: ${kanjiDetails.map((k: any) => `${k.kanji}(${k.meaning})`).join(', ')}`

    // Step 1: Generate Character Sheet
    const characterRequest: MultiStepStoryRequest = {
      step: 'character_sheet',
      theme,
      jlptLevel,
      pageCount,
      // Pass moodboard kanji for context
      moodboardKanji: kanjiDetails,
    }

    console.log('📝 Step 1: Generating character sheet...')
    const characterResponse = await aiService.process({
      task: 'generate_story_multistep',
      content: characterRequest,
      config: { jlptLevel },
      metadata: {
        source: 'moodboard-story-generator',
        userId,
        step: 'character_sheet',
        moodboardId,
      },
    })

    if (!characterResponse.success || !characterResponse.data) {
      throw new Error(characterResponse.error || 'Failed to generate character sheet')
    }

    const characterSheet = characterResponse.data

    // Step 2: Generate Outline
    const outlineRequest: MultiStepStoryRequest = {
      step: 'outline',
      theme,
      jlptLevel,
      pageCount,
      characterSheet,
      moodboardKanji: kanjiDetails,
    }

    console.log('📝 Step 2: Generating outline...')
    const outlineResponse = await aiService.process({
      task: 'generate_story_multistep',
      content: outlineRequest,
      config: { jlptLevel },
      metadata: {
        source: 'moodboard-story-generator',
        userId,
        step: 'outline',
        moodboardId,
      },
    })

    if (!outlineResponse.success || !outlineResponse.data) {
      throw new Error(outlineResponse.error || 'Failed to generate outline')
    }

    const outline = outlineResponse.data

    // Step 3: Generate Pages
    const pages: any[] = []
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      console.log(`📝 Step 3.${pageNum}: Generating page ${pageNum}...`)

      const pageRequest: MultiStepStoryRequest = {
        step: 'generate_page',
        jlptLevel,
        pageNumber: pageNum,
        characterSheet,
        outline,
        moodboardKanji: kanjiDetails,
      }

      const pageResponse = await aiService.process({
        task: 'generate_story_multistep',
        content: pageRequest,
        config: { jlptLevel },
        metadata: {
          source: 'moodboard-story-generator',
          userId,
          step: 'generate_page',
          pageNumber: pageNum,
          moodboardId,
        },
      })

      if (!pageResponse.success || !pageResponse.data) {
        console.warn(`⚠️ Failed to generate page ${pageNum}, using placeholder`)
        pages.push({
          pageNumber: pageNum,
          text: '',
          translation: '',
          imageUrl: '',
        })
      } else {
        pages.push({
          pageNumber: pageNum,
          text: pageResponse.data.textJa || pageResponse.data.text || '',
          translation: pageResponse.data.textEn || pageResponse.data.translation || '',
          imageUrl: '',
          imageAlt: pageResponse.data.imagePrompt || '',
        })
      }
    }

    // Step 4: Generate Quiz
    console.log('📝 Step 4: Generating quiz...')
    const quizRequest: MultiStepStoryRequest = {
      step: 'generate_quiz',
      jlptLevel,
      pages,
      outline,
      moodboardKanji: kanjiDetails,
    }

    const quizResponse = await aiService.process({
      task: 'generate_story_multistep',
      content: quizRequest,
      config: { jlptLevel },
      metadata: {
        source: 'moodboard-story-generator',
        userId,
        step: 'generate_quiz',
        moodboardId,
      },
    })

    const quiz = quizResponse.success && quizResponse.data ? quizResponse.data : []

    console.log('✅ Story generated successfully')

    // Generate unique ID and slug
    const storyId = `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const titleEn =
      characterSheet.storyTitle || outline.title || moodboard.title || 'Moodboard Story'
    const slug =
      titleEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Date.now()

    // Create the story document
    const storyData = {
      id: storyId,
      title: titleEn,
      titleJa: characterSheet.storyTitleJa || outline.titleJa || '',
      description:
        characterSheet.synopsis ||
        outline.description ||
        `A story featuring kanji from the ${moodboard.title} moodboard`,
      theme: moodboard.title || moodboard.category || 'Mood Board Story',
      jlptLevel: jlptLevel,
      pages: pages,
      quiz: quiz,
      characterSheet: characterSheet,

      // Metadata
      authorId: 'ai-generator',
      status: 'published',

      // Stats
      viewCount: 0,
      completionCount: 0,

      // SEO
      slug: slug,
      tags: ['ai-generated', 'moodboard-story', jlptLevel, ...(moodboard.tags || [])],
      coverImageUrl: '',
      seoDescription: `A story created from the "${moodboard.title || moodboard.category}" kanji mood board, featuring ${kanjiList.length} kanji.`,

      // Moodboard reference
      moodBoardId: moodboardId,
      moodBoardTitle: moodboard.title || moodboard.category,
      moodBoardKanji: kanjiDetails.map((k: any) => k.kanji),

      // Provider info
      provider: 'ollama',

      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    }

    // Save to Firestore
    await setDoc(doc(db, 'stories', storyId), storyData)

    console.log('💾 Story saved to Firestore:', storyId)

    // Step 5: Generate Audio (VOICEVOX - FREE, high-quality Japanese TTS)
    let audioResult: any = null
    if (process.env.MODAL_API_KEY) {
      console.log('🎵 Step 5: Generating audio...')
      try {
        const audioResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/generate-story-audio`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              storyId,
              pages: pages.map((p: any) => ({
                pageNumber: p.pageNumber,
                text: p.text,
              })),
              voice: 'nemo',
              generateFullAudio: true,
              generatePageAudio: true,
            }),
          }
        )

        audioResult = await audioResponse.json()

        if (audioResponse.ok && audioResult.fullAudioUrl) {
          console.log('✅ Audio generated:', audioResult.fullAudioUrl)
        } else {
          console.warn('⚠️ Audio generation returned errors:', audioResult.errors)
        }
      } catch (audioError) {
        console.error('⚠️ Audio generation failed (non-blocking):', audioError)
      }
    } else {
      console.log('⏭️ Skipping audio generation - MODAL_API_KEY not configured')
    }

    return NextResponse.json({
      success: true,
      storyId,
      story: storyData,
      provider: 'ollama',
      audio: audioResult
        ? {
            fullAudioUrl: audioResult.fullAudioUrl,
            pageAudioCount: audioResult.pageAudioCount,
            provider: 'voicevox',
          }
        : null,
    })
  } catch (error) {
    console.error('Error generating story:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate story' },
      { status: 500 }
    )
  }
}
