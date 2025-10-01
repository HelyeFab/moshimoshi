/**
 * Practice History Sync API
 * Server-side endpoint for syncing practice history to Firebase
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { practiceHistoryService } from '@/services/practiceHistory/PracticeHistoryService'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Force sync practice history to Firebase
    await practiceHistoryService.forceSyncToFirebase()

    logger.info(`[Practice History Sync] Successfully synced for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      message: 'Practice history synced successfully'
    })

  } catch (error) {
    logger.error('[Practice History Sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to sync practice history' },
      { status: 500 }
    )
  }
}
