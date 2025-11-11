import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import logger from '@/lib/logger'
import { ZodError } from 'zod'
import { getStreakConfig, writeStreakConfig } from '@/config/gamification/streakConfig'

/**
 * GET - Load streak configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await getSession()
    console.log('[Streak Config API] Session:', session?.uid, session?.email)

    if (!session?.uid) {
      console.log('[Streak Config API] Access denied - no session')
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
      console.log('[Streak Config API] Access denied - not admin')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = getStreakConfig()

    return NextResponse.json({
      success: true,
      config
    })
  } catch (error) {
    logger.error('[Streak Config API] Error loading config:', error)
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    )
  }
}

/**
 * POST - Save streak configuration
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
    const { config } = body ?? {}

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration required' },
        { status: 400 }
      )
    }

    const updatedConfig = writeStreakConfig(config)

    logger.info('[Streak Config API] Configuration saved by admin:', session.email)

    return NextResponse.json({
      success: true,
      message: 'Streak configuration saved successfully',
      config: updatedConfig
    })
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('[Streak Config API] Validation error:', error.errors)
      return NextResponse.json(
        {
          error: 'Invalid configuration payload',
          details: error.errors
        },
        { status: 400 }
      )
    }

    logger.error('[Streak Config API] Error saving config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
