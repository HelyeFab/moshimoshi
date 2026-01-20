import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { STORY_SCHEMA_VERSION } from '@/lib/ai/schemas'

/**
 * GET /api/admin/stories/validate
 * Validate all published stories for data integrity issues
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
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

    // Get all published stories
    const storiesSnapshot = await adminFirestore
      .collection('stories')
      .where('status', '==', 'published')
      .get()

    // Debug: Log current schema version
    console.log('[VALIDATION] Current STORY_SCHEMA_VERSION:', STORY_SCHEMA_VERSION, typeof STORY_SCHEMA_VERSION)

    const validationResults = {
      totalStories: storiesSnapshot.size,
      validStories: 0,
      storiesWithIssues: 0,
      issues: [] as any[],
      schemaVersions: {} as Record<string, number>,
      summary: {
        missingFurigana: 0,
        missingQuizFields: 0,
        incompletePages: 0,
        outdatedSchema: 0,
      },
    }

    // Validate each story
    for (const doc of storiesSnapshot.docs) {
      const story = doc.data()
      const storyId = doc.id
      const storyIssues: string[] = []

      // Track schema versions
      const schemaVersion = story.schemaVersion || 'unknown'
      validationResults.schemaVersions[schemaVersion] =
        (validationResults.schemaVersions[schemaVersion] || 0) + 1

      // Check if schema version is outdated
      // Only flag as outdated if it's actually different AND not unknown
      if (schemaVersion !== 'unknown' && schemaVersion !== STORY_SCHEMA_VERSION) {
        storyIssues.push(
          `Outdated schema version: ${schemaVersion} (current: ${STORY_SCHEMA_VERSION})`
        )
        validationResults.summary.outdatedSchema++
      }

      // Validate pages
      if (story.pages && Array.isArray(story.pages)) {
        story.pages.forEach((page: any, index: number) => {
          const pageNum = index + 1

          // Check for textWithFurigana
          if (!page.textWithFurigana || page.textWithFurigana.trim() === '') {
            storyIssues.push(`Page ${pageNum}: Missing textWithFurigana`)
            validationResults.summary.missingFurigana++
          }

          // Check for other required fields
          if (!page.text || page.text.trim() === '') {
            storyIssues.push(`Page ${pageNum}: Missing text`)
            validationResults.summary.incompletePages++
          }

          if (!page.translation || page.translation.trim() === '') {
            storyIssues.push(`Page ${pageNum}: Missing translation`)
            validationResults.summary.incompletePages++
          }
        })
      }

      // Validate quiz if present
      if (story.quiz && Array.isArray(story.quiz)) {
        story.quiz.forEach((question: any, index: number) => {
          const qNum = index + 1

          if (!question.questionJa || question.questionJa.trim() === '') {
            storyIssues.push(`Quiz Q${qNum}: Missing Japanese question (questionJa)`)
            validationResults.summary.missingQuizFields++
          }

          if (!question.explanationJa || question.explanationJa.trim() === '') {
            storyIssues.push(`Quiz Q${qNum}: Missing Japanese explanation (explanationJa)`)
            validationResults.summary.missingQuizFields++
          }

          if (!question.question || question.question.trim() === '') {
            storyIssues.push(`Quiz Q${qNum}: Missing English question`)
            validationResults.summary.missingQuizFields++
          }

          if (!question.explanation || question.explanation.trim() === '') {
            storyIssues.push(`Quiz Q${qNum}: Missing English explanation`)
            validationResults.summary.missingQuizFields++
          }
        })
      }

      // Record results
      if (storyIssues.length > 0) {
        validationResults.storiesWithIssues++
        validationResults.issues.push({
          storyId,
          title: story.title || 'Unknown',
          titleJa: story.titleJa || '',
          jlptLevel: story.jlptLevel || 'Unknown',
          publishedAt: story.publishedAt?.toDate?.()?.toISOString() || 'Unknown',
          schemaVersion: story.schemaVersion || 'unknown',
          issues: storyIssues,
          issueCount: storyIssues.length,
        })
      } else {
        validationResults.validStories++
      }
    }

    // Calculate health score
    const healthScore =
      validationResults.totalStories > 0
        ? Math.round((validationResults.validStories / validationResults.totalStories) * 100)
        : 100

    return NextResponse.json({
      success: true,
      healthScore,
      currentSchemaVersion: STORY_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      ...validationResults,
    })
  } catch (error) {
    console.error('Error validating stories:', error)
    return NextResponse.json(
      {
        error: 'Failed to validate stories',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
