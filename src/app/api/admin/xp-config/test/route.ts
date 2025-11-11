import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { xpConfigService } from '@/lib/services/XPConfigService'
import logger from '@/lib/logger'

/**
 * POST - Test XP calculation for an activity
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin access
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin status in Firebase
    const userDoc = await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .get()

    const userData = userDoc.exists ? userDoc.data() : null
    const isAdmin = userData?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { activityId } = body

    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID required' },
        { status: 400 }
      )
    }

    // Generate test calculation based on activity type
    let calculation

    switch (activityId) {
      case 'drill':
        // Test with perfect accuracy
        calculation = xpConfigService.calculateDrillXP(100)
        break

      case 'flashcards':
        // Test with good performance
        calculation = xpConfigService.calculateFlashcardsXP(
          10,  // 10 correct
          5,   // 5 card streak
          true, // perfect session
          3    // 3 fast cards
        )
        break

      case 'kanji_mastery':
        // Test with excellent performance
        calculation = xpConfigService.calculateKanjiMasteryXP(
          5,    // 5 kanji
          3,    // 3 perfect
          0.92, // 92% accuracy
          0.7,  // fast completion
          true, // no review needed
          3     // 3 rounds completed
        )
        break

      default:
        // Generic test for other activities
        calculation = xpConfigService.calculateActivityXP(activityId, {
          testMode: true,
          samplePerformance: 'good'
        })
        break
    }

    logger.info(`[XP Config Test] Calculated XP for ${activityId}:`, calculation)

    return NextResponse.json({
      success: true,
      calculation,
      description: getTestDescription(activityId)
    })
  } catch (error) {
    logger.error('[XP Config Test API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to test calculation' },
      { status: 500 }
    )
  }
}

function getTestDescription(activityId: string): string {
  const descriptions: Record<string, string> = {
    drill: 'Test with 100% accuracy (perfect score)',
    flashcards: 'Test with 10 correct, 5-card streak, perfect session, 3 fast cards',
    kanji_mastery: 'Test with 5 kanji, 3 perfect, 92% accuracy, fast completion, no review needed',
    default: 'Test with default good performance metrics'
  }

  return descriptions[activityId] || descriptions.default
}