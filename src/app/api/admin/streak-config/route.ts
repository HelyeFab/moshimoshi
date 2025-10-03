import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import logger from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'gamification', 'streak.json')

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

    // Read config file
    const configData = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configData)

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
    const { config } = body

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration required' },
        { status: 400 }
      )
    }

    // Validate minXPForStreak
    if (typeof config.minXPForStreak !== 'number' || config.minXPForStreak < 0) {
      return NextResponse.json(
        { error: 'minXPForStreak must be a positive number' },
        { status: 400 }
      )
    }

    // Save config file
    await fs.writeFile(
      CONFIG_PATH,
      JSON.stringify(config, null, 2),
      'utf-8'
    )

    logger.info('[Streak Config API] Configuration saved by admin:', session.email)

    return NextResponse.json({
      success: true,
      message: 'Streak configuration saved successfully'
    })
  } catch (error) {
    logger.error('[Streak Config API] Error saving config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
