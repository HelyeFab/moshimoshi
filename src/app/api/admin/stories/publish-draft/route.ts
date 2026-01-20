import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { Story } from '@/types/story'
import { STORY_SCHEMA_VERSION } from '@/lib/ai/schemas'

/**
 * POST /api/admin/stories/publish-draft
 * Publish a story draft to the stories collection
 */
export async function POST(request: NextRequest) {
  try {
    // Check for admin key authentication (for scheduled functions)
    const adminKey = request.headers.get('X-Admin-Key')
    const expectedAdminKey = process.env.STORY_SCHEDULER_ADMIN_KEY || 'story-scheduler-2025'

    let authorId: string

    if (adminKey === expectedAdminKey) {
      // Authenticated via admin key (scheduled function)
      authorId = 'scheduler-system'
    } else {
      const session = await getSession()
      if (!session?.uid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (!adminFirestore) {
        return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
      }

      // Verify admin status
      const userDoc = await adminFirestore.collection('users').doc(session.uid).get()
      const isAdmin = userDoc.data()?.isAdmin === true

      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
      }

      authorId = session.uid
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const body = await request.json()
    const { draftId, storyData: providedStoryData } = body

    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 })
    }

    // Get the draft from Firestore
    const draftDoc = await adminFirestore.collection('ai_story_drafts').doc(draftId).get()

    if (!draftDoc.exists) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    // Use provided story data if available, otherwise use draft data from Firestore
    const draftData = draftDoc.data() || {}

    // Merge provided data with draft data (provided takes precedence)
    const mergedData = {
      ...draftData,
      ...providedStoryData,
      // Merge nested objects
      outline: { ...draftData.outline, ...providedStoryData?.outline },
      characterSheet: { ...draftData.characterSheet, ...providedStoryData?.characterSheet },
    }

    // Check if still generating (only if no story data provided)
    if (
      !providedStoryData &&
      (mergedData.status === 'generating' || mergedData.status === 'pages_generating')
    ) {
      return NextResponse.json({ error: 'Story is still being generated' }, { status: 400 })
    }

    // Get title from multiple possible sources
    const title =
      providedStoryData?.title ||
      mergedData.outline?.title ||
      mergedData.characterSheet?.title ||
      mergedData.theme ||
      'Untitled Story'

    // Validate required fields
    const pages = providedStoryData?.pages || mergedData.pages || []
    const jlptLevel = providedStoryData?.jlptLevel || mergedData.jlptLevel

    const missingFields = []
    if (!title || title === 'Untitled Story') {
      // Only fail if truly no title anywhere
      if (!mergedData.theme) missingFields.push('title')
    }
    if (!pages || pages.length === 0) missingFields.push('pages')
    if (!jlptLevel) missingFields.push('jlptLevel')

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Draft is missing required fields',
          details: `Missing: ${missingFields.join(', ')}. Draft has: theme=${mergedData.theme}, pages=${pages?.length || 0}, jlptLevel=${jlptLevel}`,
        },
        { status: 400 }
      )
    }

    // POST-GENERATION VALIDATION
    // Comprehensive validation to prevent silent data corruption
    const validationErrors: string[] = []

    // 1. Validate pages have required fields (prevent furigana bug recurrence)
    pages.forEach((page: any, index: number) => {
      const pageNum = index + 1
      const textWithFurigana = page.textWithFurigana || page.textJa || page.text

      if (!textWithFurigana || textWithFurigana.trim() === '') {
        validationErrors.push(`Page ${pageNum}: Missing textWithFurigana`)
      }

      if (!page.text && !page.textJa) {
        validationErrors.push(`Page ${pageNum}: Missing text/textJa`)
      }

      if (!page.translation && !page.textEn) {
        validationErrors.push(`Page ${pageNum}: Missing translation/textEn`)
      }
    })

    // 2. Validate quiz bilingual fields (prevent quiz bug recurrence)
    const quiz = providedStoryData?.quiz || mergedData.quiz
    if (quiz && Array.isArray(quiz)) {
      quiz.forEach((question: any, index: number) => {
        const qNum = index + 1

        if (!question.question || question.question.trim() === '') {
          validationErrors.push(`Quiz Q${qNum}: Missing English question`)
        }

        if (!question.questionJa || question.questionJa.trim() === '') {
          validationErrors.push(`Quiz Q${qNum}: Missing Japanese question (questionJa)`)
        }

        if (!question.explanation || question.explanation.trim() === '') {
          validationErrors.push(`Quiz Q${qNum}: Missing English explanation`)
        }

        if (!question.explanationJa || question.explanationJa.trim() === '') {
          validationErrors.push(`Quiz Q${qNum}: Missing Japanese explanation (explanationJa)`)
        }

        if (!Array.isArray(question.options) || question.options.length !== 4) {
          validationErrors.push(`Quiz Q${qNum}: Must have exactly 4 options`)
        }
      })
    }

    // If validation errors found, reject publishing
    if (validationErrors.length > 0) {
      const errorLogId = `validation_error_${draftId}_${Date.now()}`
      const errorLog = {
        id: errorLogId,
        draftId,
        storyId: draftId.replace('draft_', 'story_'),
        type: 'validation_failure',
        errors: validationErrors,
        timestamp: new Date(),
        jlptLevel,
        theme: mergedData.theme || 'unknown',
        pagesCount: pages.length,
        quizQuestionsCount: quiz?.length || 0,
        authorId,
        metadata: {
          title: title || 'Unknown',
          generationStatus: mergedData.status,
        },
      }

      console.error('[VALIDATION ERROR] Story draft failed validation:', {
        draftId,
        errors: validationErrors,
        timestamp: new Date().toISOString(),
      })

      // Log to Firestore for permanent tracking
      try {
        await adminFirestore.collection('ai_validation_errors').doc(errorLogId).set(errorLog)
      } catch (logError) {
        console.error('[ERROR] Failed to log validation error to Firestore:', logError)
        // Don't fail the response if logging fails
      }

      return NextResponse.json(
        {
          error: 'Story validation failed',
          validationErrors,
          details: `Found ${validationErrors.length} validation error(s). Story cannot be published until all fields are complete.`,
        },
        { status: 400 }
      )
    }

    // titleJa fallback
    const titleJa =
      providedStoryData?.titleJa ||
      mergedData.outline?.titleJa ||
      mergedData.characterSheet?.titleJa ||
      title

    // Transform pages to match Story.pages structure
    // Filter out undefined values as Firestore doesn't accept them
    const storyPages = pages.map((page: any, index: number) => {
      const pageNumber = index + 1
      const storyPage: Record<string, any> = {
        pageNumber,
        text: page.textJa || page.text || '',
        textWithFurigana: page.textWithFurigana || page.textJa || page.text || '',
        translation: page.textEn || page.translation || '',
        vocabularyNotes: page.vocabularyNotes || page.vocabulary || {},
        grammarNotes: page.grammarNotes || page.grammar || {},
      }
      // Only add optional fields if they have values
      // NOTE: pageImages uses string keys ("1", "2") not numeric indices, so use String(pageNumber)
      const imageUrl = page.imageUrl || mergedData.pageImages?.[String(pageNumber)] || mergedData.pageImages?.[pageNumber]
      if (imageUrl) storyPage.imageUrl = imageUrl
      if (page.audioUrl) storyPage.audioUrl = page.audioUrl
      return storyPage
    })

    // Create slug from title
    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString(36)

    // Create story document
    const storyId = draftId.replace('draft_', 'story_')
    const story: Partial<Story> = {
      id: storyId,
      title,
      titleJa,
      description:
        providedStoryData?.description ||
        mergedData.outline?.description ||
        mergedData.characterSheet?.description ||
        `A ${jlptLevel} level Japanese learning story about ${mergedData.theme}`,
      jlptLevel,
      theme: mergedData.theme || 'general',
      tags: mergedData.tags || [jlptLevel, mergedData.theme].filter(Boolean),
      pages: storyPages,

      // Metadata
      authorId: mergedData.userId || authorId,
      createdAt: mergedData.createdAt?.toDate?.() || new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
      status: 'published',

      // Stats
      viewCount: 0,
      completionCount: 0,

      // SEO
      slug,
      seoTitle: `${title} - Japanese Story for ${jlptLevel} Learners`,
      seoDescription: `Learn Japanese with this ${jlptLevel} level story. ${storyPages.length} pages with furigana, translations, and quiz.`,

      // AI Generation Metadata
      isAIGenerated: true,
      schemaVersion: STORY_SCHEMA_VERSION,
    }

    // Log schema version for tracking
    console.log('[SCHEMA VERSION]', {
      version: STORY_SCHEMA_VERSION,
      storyId,
      timestamp: new Date().toISOString(),
    })

    // Add optional fields only if they exist (Firestore doesn't accept undefined)
    // Use first page image as cover (NOT the model sheet - that's for character consistency, not display)
    // NOTE: pageImages uses string keys ("1", "2") not numeric indices
    const firstPageImage = mergedData.pages?.[0]?.imageUrl || mergedData.pageImages?.["1"] || mergedData.pageImages?.[1]
    if (firstPageImage) (story as any).coverImageUrl = firstPageImage

    // quiz is already declared in validation section above
    if (quiz && quiz.length > 0) (story as any).quiz = quiz

    if (mergedData.characterSheet) {
      ;(story as any).characterSheet = mergedData.characterSheet
    }

    // Copy model sheet URL if available (used for character consistency during generation)
    const modelSheetUrl = mergedData.modelSheet?.imageUrl || mergedData.modelSheetUrl
    if (modelSheetUrl) {
      ;(story as any).modelSheetUrl = modelSheetUrl
    }

    // Copy story audio URL if available (full narration)
    const storyAudioUrl = mergedData.fullAudioUrl || mergedData.audioUrl
    if (storyAudioUrl) {
      ;(story as any).audioUrl = storyAudioUrl
    }

    // Remove undefined values for Firestore (shallow clean)
    const cleanStory = Object.fromEntries(Object.entries(story).filter(([_, v]) => v !== undefined))

    // Save to stories collection
    await adminFirestore.collection('stories').doc(storyId).set(cleanStory)

    // Delete the draft since it's now published
    await draftDoc.ref.delete()

    return NextResponse.json({
      success: true,
      storyId,
      message: 'Story published successfully',
    })
  } catch (error) {
    console.error('Error publishing story draft:', error)
    return NextResponse.json(
      {
        error: 'Failed to publish story',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
