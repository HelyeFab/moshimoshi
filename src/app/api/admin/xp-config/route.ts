import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import logger from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'xp-config.json')

/**
 * GET - Load XP configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await getSession()
    console.log('[XP Config API] Session:', session?.uid, session?.email)

    if (!session?.uid) {
      console.log('[XP Config API] Access denied - no session')
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
      console.log('[XP Config API] Access denied - not admin')
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
    logger.error('[XP Config API] Error loading config:', error)
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    )
  }
}

/**
 * POST - Save XP configuration
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

    // Update last updated timestamp
    config.lastUpdated = new Date().toISOString().split('T')[0]

    // Save config file
    await fs.writeFile(
      CONFIG_PATH,
      JSON.stringify(config, null, 2),
      'utf-8'
    )

    logger.info('[XP Config API] Configuration saved by admin')

    // Clear any cached config in memory (force reload)
    // This ensures the XPConfigService picks up changes
    // Note: The config will be reloaded from disk on next import

    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully'
    })
  } catch (error) {
    logger.error('[XP Config API] Error saving config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}